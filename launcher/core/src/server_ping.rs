//! Ping de servidores (Server List Ping, o mesmo da lista de multiplayer):
//! online/offline, latência, jogadores, versão, MOTD e ícone.
//! Resolve o registro SRV `_minecraft._tcp` como o jogo faz.

use crate::{Error, Result};
use serde::Serialize;
use std::net::{IpAddr, SocketAddr};
use std::time::{Duration, Instant};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpStream, UdpSocket};
use tokio::time::timeout;

const TIMEOUT: Duration = Duration::from_secs(4);
const DNS_SERVERS: [&str; 2] = ["1.1.1.1:53", "8.8.8.8:53"];

#[derive(Debug, Clone, Serialize, Default)]
pub struct ServerStatus {
    pub address: String,
    pub online: bool,
    pub ping_ms: Option<u32>,
    pub players_online: Option<i64>,
    pub players_max: Option<i64>,
    pub version: Option<String>,
    /// MOTD sem códigos de cor.
    pub motd: Option<String>,
    /// `data:image/png;base64,...`
    pub favicon: Option<String>,
    pub error: Option<String>,
}

/// Nunca falha: servidor fora do ar vira `online: false` com a mensagem em `error`.
pub async fn ping(address: &str) -> ServerStatus {
    match timeout(TIMEOUT * 2, ping_inner(address)).await {
        Ok(Ok(s)) => s,
        Ok(Err(e)) => ServerStatus { address: address.into(), error: Some(e.to_string()), ..Default::default() },
        Err(_) => ServerStatus { address: address.into(), error: Some("Sem resposta".into()), ..Default::default() },
    }
}

/// Vários servidores em paralelo, na mesma ordem.
pub async fn ping_many(addresses: &[String]) -> Vec<ServerStatus> {
    futures::future::join_all(addresses.iter().take(24).map(|a| ping(a))).await
}

/// "host", "host:porta" ou "[ipv6]:porta" → (host, porta explícita).
pub fn split_address(address: &str) -> (String, Option<u16>) {
    let a = address.trim();
    if let Some(rest) = a.strip_prefix('[') {
        if let Some((h, p)) = rest.split_once(']') {
            return (h.to_string(), p.strip_prefix(':').and_then(|p| p.parse().ok()));
        }
    }
    match a.rsplit_once(':') {
        Some((h, p)) if !h.contains(':') => match p.parse() {
            Ok(port) => (h.to_string(), Some(port)),
            Err(_) => (a.to_string(), None),
        },
        _ => (a.to_string(), None),
    }
}

async fn ping_inner(address: &str) -> Result<ServerStatus> {
    let (host, port) = split_address(address);
    if host.is_empty() {
        return Err(Error::msg("Endereço vazio"));
    }
    // SRV só quando não há porta e o host não é um IP
    let (connect_host, connect_port) = match port {
        Some(p) => (host.clone(), p),
        None if host.parse::<IpAddr>().is_err() => match resolve_srv(&host).await {
            Some((h, p)) => (h, p),
            None => (host.clone(), 25565),
        },
        None => (host.clone(), 25565),
    };

    let addr: SocketAddr = tokio::net::lookup_host((connect_host.as_str(), connect_port))
        .await
        .map_err(|_| Error::msg("Endereço não encontrado"))?
        .next()
        .ok_or_else(|| Error::msg("Endereço não encontrado"))?;
    let mut stream = timeout(TIMEOUT, TcpStream::connect(addr))
        .await
        .map_err(|_| Error::msg("Sem resposta"))?
        .map_err(|_| Error::msg("Offline"))?;
    stream.set_nodelay(true).ok();

    // handshake (estado 1 = status) + pedido de status
    let mut hs = Vec::new();
    write_varint(&mut hs, 0x00);
    write_varint(&mut hs, -1); // versão "qualquer", aceita por servidores vanilla e proxies
    write_string(&mut hs, &host);
    hs.extend_from_slice(&connect_port.to_be_bytes());
    write_varint(&mut hs, 1);
    let mut out = Vec::new();
    write_packet(&mut out, &hs);
    write_packet(&mut out, &[0x00]);
    stream.write_all(&out).await?;

    let body = timeout(TIMEOUT, read_packet(&mut stream)).await.map_err(|_| Error::msg("Sem resposta"))??;
    let mut cur = &body[..];
    let id = read_varint_slice(&mut cur)?;
    if id != 0x00 {
        return Err(Error::msg("Resposta inesperada"));
    }
    let len = read_varint_slice(&mut cur)? as usize;
    let json_text = std::str::from_utf8(cur.get(..len).ok_or_else(|| Error::msg("Resposta cortada"))?)
        .map_err(|_| Error::msg("Resposta inválida"))?;
    let json: serde_json::Value = serde_json::from_str(json_text)?;

    // ping/pong para medir a latência
    let started = Instant::now();
    let mut p = vec![0x01];
    p.extend_from_slice(&(chrono::Utc::now().timestamp_millis()).to_be_bytes());
    let mut out = Vec::new();
    write_packet(&mut out, &p);
    stream.write_all(&out).await?;
    let ping_ms = match timeout(TIMEOUT, read_packet(&mut stream)).await {
        Ok(Ok(_)) => Some(started.elapsed().as_millis() as u32),
        _ => None,
    };

    Ok(ServerStatus {
        address: address.into(),
        online: true,
        ping_ms,
        players_online: json["players"]["online"].as_i64(),
        players_max: json["players"]["max"].as_i64(),
        version: json["version"]["name"].as_str().map(strip_codes),
        motd: Some(strip_codes(&flatten_text(&json["description"])).trim().to_string()).filter(|s| !s.is_empty()),
        favicon: json["favicon"].as_str().filter(|f| f.starts_with("data:image/")).map(|f| f.replace('\n', "")),
        error: None,
    })
}

/// Componente de chat (string, {"text","extra"} ou lista) → texto puro.
pub fn flatten_text(v: &serde_json::Value) -> String {
    match v {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Array(a) => a.iter().map(flatten_text).collect(),
        serde_json::Value::Object(o) => {
            let mut s = o.get("text").and_then(|t| t.as_str()).unwrap_or_default().to_string();
            if let Some(extra) = o.get("extra") {
                s.push_str(&flatten_text(extra));
            }
            s
        }
        _ => String::new(),
    }
}

/// Remove códigos de cor "§a".
pub fn strip_codes(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut skip = false;
    for c in s.chars() {
        if skip {
            skip = false;
        } else if c == '§' {
            skip = true;
        } else {
            out.push(c);
        }
    }
    out
}

// ---------- protocolo ----------

fn write_varint(buf: &mut Vec<u8>, value: i32) {
    let mut v = value as u32;
    loop {
        if v & !0x7F == 0 {
            buf.push(v as u8);
            return;
        }
        buf.push((v as u8 & 0x7F) | 0x80);
        v >>= 7;
    }
}

fn write_string(buf: &mut Vec<u8>, s: &str) {
    write_varint(buf, s.len() as i32);
    buf.extend_from_slice(s.as_bytes());
}

fn write_packet(out: &mut Vec<u8>, body: &[u8]) {
    write_varint(out, body.len() as i32);
    out.extend_from_slice(body);
}

async fn read_varint(stream: &mut TcpStream) -> Result<i32> {
    let mut result = 0i32;
    for i in 0..5 {
        let b = stream.read_u8().await?;
        result |= ((b & 0x7F) as i32) << (7 * i);
        if b & 0x80 == 0 {
            return Ok(result);
        }
    }
    Err(Error::msg("VarInt grande demais"))
}

fn read_varint_slice(cur: &mut &[u8]) -> Result<i32> {
    let mut result = 0i32;
    for i in 0..5 {
        let (&b, rest) = cur.split_first().ok_or_else(|| Error::msg("Resposta cortada"))?;
        *cur = rest;
        result |= ((b & 0x7F) as i32) << (7 * i);
        if b & 0x80 == 0 {
            return Ok(result);
        }
    }
    Err(Error::msg("VarInt grande demais"))
}

async fn read_packet(stream: &mut TcpStream) -> Result<Vec<u8>> {
    let len = read_varint(stream).await?;
    if !(1..=2 * 1024 * 1024).contains(&len) {
        return Err(Error::msg("Resposta inválida"));
    }
    let mut buf = vec![0u8; len as usize];
    stream.read_exact(&mut buf).await?;
    Ok(buf)
}

// ---------- SRV (DNS sobre UDP, sem dependências) ----------

async fn resolve_srv(host: &str) -> Option<(String, u16)> {
    let name = format!("_minecraft._tcp.{host}");
    let query = build_srv_query(&name, rand_id())?;
    for server in DNS_SERVERS {
        let Ok(sock) = UdpSocket::bind("0.0.0.0:0").await else { continue };
        if sock.send_to(&query, server).await.is_err() {
            continue;
        }
        let mut buf = [0u8; 1500];
        if let Ok(Ok((n, _))) = timeout(Duration::from_millis(1500), sock.recv_from(&mut buf)).await {
            return parse_srv_response(&buf[..n]);
        }
    }
    None
}

fn rand_id() -> u16 {
    (chrono::Utc::now().timestamp_subsec_nanos() & 0xFFFF) as u16
}

fn build_srv_query(name: &str, id: u16) -> Option<Vec<u8>> {
    let mut q = Vec::with_capacity(64);
    q.extend_from_slice(&id.to_be_bytes());
    q.extend_from_slice(&[0x01, 0x00, 0, 1, 0, 0, 0, 0, 0, 0]); // recursão; 1 pergunta
    for label in name.trim_end_matches('.').split('.') {
        if label.is_empty() || label.len() > 63 {
            return None;
        }
        q.push(label.len() as u8);
        q.extend_from_slice(label.as_bytes());
    }
    q.push(0);
    q.extend_from_slice(&[0, 33, 0, 1]); // tipo SRV, classe IN
    Some(q)
}

fn skip_name(msg: &[u8], mut pos: usize) -> Option<usize> {
    loop {
        let len = *msg.get(pos)? as usize;
        if len == 0 {
            return Some(pos + 1);
        }
        if len & 0xC0 == 0xC0 {
            return Some(pos + 2);
        }
        pos += 1 + len;
    }
}

fn read_name(msg: &[u8], mut pos: usize) -> Option<String> {
    let mut labels = Vec::new();
    for _ in 0..64 {
        let len = *msg.get(pos)? as usize;
        if len == 0 {
            return Some(labels.join("."));
        }
        if len & 0xC0 == 0xC0 {
            pos = ((len & 0x3F) << 8) | *msg.get(pos + 1)? as usize;
            continue;
        }
        labels.push(String::from_utf8_lossy(msg.get(pos + 1..pos + 1 + len)?).to_string());
        pos += 1 + len;
    }
    None
}

fn parse_srv_response(msg: &[u8]) -> Option<(String, u16)> {
    let u16_at = |p: usize| -> Option<u16> { Some(u16::from_be_bytes([*msg.get(p)?, *msg.get(p + 1)?])) };
    if msg.len() < 12 || msg[3] & 0x0F != 0 {
        return None;
    }
    let qd = u16_at(4)?;
    let an = u16_at(6)?;
    let mut pos = 12;
    for _ in 0..qd {
        pos = skip_name(msg, pos)? + 4;
    }
    let mut best: Option<(u16, String, u16)> = None;
    for _ in 0..an {
        pos = skip_name(msg, pos)?;
        let kind = u16_at(pos)?;
        let rdlen = u16_at(pos + 8)? as usize;
        let rdata = pos + 10;
        if kind == 33 && rdlen >= 7 {
            let priority = u16_at(rdata)?;
            let port = u16_at(rdata + 4)?;
            let target = read_name(msg, rdata + 6)?;
            if !target.is_empty() && best.as_ref().map_or(true, |b| priority < b.0) {
                best = Some((priority, target, port));
            }
        }
        pos = rdata + rdlen;
    }
    best.map(|(_, t, p)| (t, p))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn enderecos() {
        assert_eq!(split_address("mc.exemplo.com"), ("mc.exemplo.com".into(), None));
        assert_eq!(split_address("mc.exemplo.com:25570"), ("mc.exemplo.com".into(), Some(25570)));
        assert_eq!(split_address("[::1]:25565"), ("::1".into(), Some(25565)));
    }

    #[test]
    fn varint() {
        let mut b = Vec::new();
        write_varint(&mut b, 300);
        assert_eq!(b, vec![0xAC, 0x02]);
        let mut b2 = Vec::new();
        write_varint(&mut b2, -1);
        assert_eq!(b2.len(), 5);
        let mut s = &b[..];
        assert_eq!(read_varint_slice(&mut s).unwrap(), 300);
    }

    #[test]
    fn motd() {
        let v = serde_json::json!({"text":"§aKairo ","extra":[{"text":"PvP"},"!"]});
        assert_eq!(strip_codes(&flatten_text(&v)), "Kairo PvP!");
    }

    #[test]
    fn srv_resposta() {
        // resposta montada à mão: 1 pergunta, 1 resposta SRV → play.exemplo.com:25570
        let mut m = build_srv_query("_minecraft._tcp.exemplo.com", 7).unwrap();
        m[2] = 0x81;
        m[3] = 0x80;
        m[7] = 1; // ANCOUNT = 1
        m.extend_from_slice(&[0xC0, 0x0C, 0, 33, 0, 1, 0, 0, 0, 60]);
        let mut rdata = vec![0, 0, 0, 5];
        rdata.extend_from_slice(&25570u16.to_be_bytes());
        for l in ["play", "exemplo", "com"] {
            rdata.push(l.len() as u8);
            rdata.extend_from_slice(l.as_bytes());
        }
        rdata.push(0);
        m.extend_from_slice(&(rdata.len() as u16).to_be_bytes());
        m.extend_from_slice(&rdata);
        assert_eq!(parse_srv_response(&m), Some(("play.exemplo.com".into(), 25570)));
    }
}
