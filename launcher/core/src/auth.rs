//! Login Microsoft (device code) → Xbox Live → XSTS → Minecraft, e contas offline.
//!
//! Para o login Microsoft funcionar você precisa de um "client id" do Azure
//! (app pública com device code habilitado) aprovado pela Mojang para a API do
//! Minecraft. Veja o README.

use crate::http::client;
use crate::{Error, Result};
use md5::{Digest, Md5};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::Duration;

const SCOPE: &str = "XboxLive.signin offline_access";
const DEVICE_URL: &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode";
const TOKEN_URL: &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AccountKind {
    Microsoft,
    Offline,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    /// UUID do jogador, sem hífens.
    pub uuid: String,
    pub name: String,
    pub kind: AccountKind,
    #[serde(default)]
    pub access_token: String,
    #[serde(default)]
    pub refresh_token: Option<String>,
    /// Unix timestamp (segundos) de expiração do token do Minecraft.
    #[serde(default)]
    pub expires_at: i64,
    #[serde(default)]
    pub xuid: Option<String>,
    #[serde(default)]
    pub skin_url: Option<String>,
}

impl Account {
    pub fn user_type(&self) -> &'static str {
        match self.kind {
            AccountKind::Microsoft => "msa",
            AccountKind::Offline => "legacy",
        }
    }

    pub fn needs_refresh(&self) -> bool {
        self.kind == AccountKind::Microsoft && chrono::Utc::now().timestamp() > self.expires_at - 300
    }
}

/// Conta offline: mesmo UUID que o servidor gera em modo offline ("OfflinePlayer:<nome>").
pub fn offline(name: &str) -> Result<Account> {
    let name = name.trim();
    let valid = (3..=16).contains(&name.len()) && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_');
    if !valid {
        return Err(Error::msg("Nick inválido: use 3 a 16 caracteres (letras, números e _)"));
    }
    let mut hash: [u8; 16] = Md5::digest(format!("OfflinePlayer:{name}").as_bytes()).into();
    hash[6] = (hash[6] & 0x0f) | 0x30; // versão 3
    hash[8] = (hash[8] & 0x3f) | 0x80; // variante IETF
    Ok(Account {
        uuid: hex::encode(hash),
        name: name.to_string(),
        kind: AccountKind::Offline,
        access_token: "0".into(),
        refresh_token: None,
        expires_at: i64::MAX,
        xuid: None,
        skin_url: None,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceCode {
    pub user_code: String,
    pub device_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
    #[serde(default)]
    pub message: String,
}

pub async fn start_device_code(client_id: &str) -> Result<DeviceCode> {
    let resp = client()
        .post(DEVICE_URL)
        .form(&[("client_id", client_id), ("scope", SCOPE)])
        .send()
        .await?;
    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(Error::msg(format!("A Microsoft recusou o pedido de login: {body}")));
    }
    Ok(resp.json().await?)
}

#[derive(Deserialize)]
struct MsToken {
    access_token: String,
    refresh_token: Option<String>,
}

#[derive(Deserialize)]
struct MsError {
    error: String,
    error_description: Option<String>,
}

/// Aguarda o usuário digitar o código em microsoft.com/link e conclui o login.
pub async fn poll_device_code(client_id: &str, code: &DeviceCode) -> Result<Account> {
    let mut interval = code.interval.max(2);
    let deadline = std::time::Instant::now() + Duration::from_secs(code.expires_in);
    loop {
        if std::time::Instant::now() > deadline {
            return Err(Error::msg("O código expirou. Tente entrar de novo."));
        }
        tokio::time::sleep(Duration::from_secs(interval)).await;
        let resp = client()
            .post(TOKEN_URL)
            .form(&[
                ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
                ("client_id", client_id),
                ("device_code", code.device_code.as_str()),
            ])
            .send()
            .await?;
        if resp.status().is_success() {
            let token: MsToken = resp.json().await?;
            return finish_login(&token.access_token, token.refresh_token).await;
        }
        let err: MsError = resp.json().await.unwrap_or(MsError { error: "unknown".into(), error_description: None });
        match err.error.as_str() {
            "authorization_pending" => continue,
            "slow_down" => interval += 5,
            "authorization_declined" => return Err(Error::msg("Login cancelado na página da Microsoft.")),
            "expired_token" => return Err(Error::msg("O código expirou. Tente entrar de novo.")),
            other => {
                return Err(Error::msg(format!(
                    "Falha no login Microsoft ({other}): {}",
                    err.error_description.unwrap_or_default()
                )))
            }
        }
    }
}

/// Renova a sessão sem pedir login de novo.
pub async fn refresh(client_id: &str, account: &Account) -> Result<Account> {
    let refresh_token = account
        .refresh_token
        .as_deref()
        .ok_or_else(|| Error::msg("Conta sem refresh token; entre novamente"))?;
    let resp = client()
        .post(TOKEN_URL)
        .form(&[
            ("grant_type", "refresh_token"),
            ("client_id", client_id),
            ("refresh_token", refresh_token),
            ("scope", SCOPE),
        ])
        .send()
        .await?;
    if !resp.status().is_success() {
        return Err(Error::msg("Sessão expirada. Entre com a conta Microsoft novamente."));
    }
    let token: MsToken = resp.json().await?;
    finish_login(&token.access_token, token.refresh_token.or_else(|| account.refresh_token.clone())).await
}

#[derive(Deserialize)]
#[serde(rename_all = "PascalCase")]
struct XboxResponse {
    token: String,
    display_claims: XboxClaims,
}
#[derive(Deserialize)]
struct XboxClaims {
    xui: Vec<XboxUser>,
}
#[derive(Deserialize)]
struct XboxUser {
    uhs: String,
    #[serde(default)]
    xid: Option<String>,
}

#[derive(Deserialize)]
struct McLogin {
    access_token: String,
    expires_in: i64,
}

#[derive(Deserialize)]
struct McProfile {
    id: String,
    name: String,
    #[serde(default)]
    skins: Vec<McSkin>,
}
#[derive(Deserialize)]
struct McSkin {
    url: String,
    state: String,
}

async fn finish_login(ms_access_token: &str, refresh_token: Option<String>) -> Result<Account> {
    // 1) Xbox Live
    let xbl: XboxResponse = client()
        .post("https://user.auth.xboxlive.com/user/authenticate")
        .json(&json!({
            "Properties": {
                "AuthMethod": "RPS",
                "SiteName": "user.auth.xboxlive.com",
                "RpsTicket": format!("d={ms_access_token}")
            },
            "RelyingParty": "http://auth.xboxlive.com",
            "TokenType": "JWT"
        }))
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    // 2) XSTS
    let resp = client()
        .post("https://xsts.auth.xboxlive.com/xsts/authorize")
        .json(&json!({
            "Properties": { "SandboxId": "RETAIL", "UserTokens": [xbl.token] },
            "RelyingParty": "rp://api.minecraftservices.com/",
            "TokenType": "JWT"
        }))
        .send()
        .await?;
    if resp.status().as_u16() == 401 {
        let body: serde_json::Value = resp.json().await.unwrap_or_default();
        let msg = match body.get("XErr").and_then(|v| v.as_u64()) {
            Some(2148916233) => "Essa conta Microsoft não tem perfil Xbox. Crie um em xbox.com e tente de novo.",
            Some(2148916235) => "Xbox Live não está disponível no seu país.",
            Some(2148916236) | Some(2148916237) => "A conta precisa de verificação de idade em xbox.com.",
            Some(2148916238) => "Conta de menor: precisa ser adicionada a uma Família Microsoft.",
            _ => "O Xbox Live recusou o login.",
        };
        return Err(Error::msg(msg));
    }
    let xsts: XboxResponse = resp.error_for_status()?.json().await?;
    let user = xsts.display_claims.xui.first().ok_or_else(|| Error::msg("Resposta do Xbox sem usuário"))?;

    // 3) Minecraft
    let resp = client()
        .post("https://api.minecraftservices.com/authentication/login_with_xbox")
        .json(&json!({ "identityToken": format!("XBL3.0 x={};{}", user.uhs, xsts.token) }))
        .send()
        .await?;
    if resp.status().as_u16() == 403 {
        return Err(Error::msg(
            "A Mojang recusou o login: o Client ID do Azure ainda não foi aprovado para a API do Minecraft.",
        ));
    }
    let mc: McLogin = resp.error_for_status()?.json().await?;

    // 4) Perfil (falha = conta não tem o jogo)
    let resp = client()
        .get("https://api.minecraftservices.com/minecraft/profile")
        .bearer_auth(&mc.access_token)
        .send()
        .await?;
    if resp.status().as_u16() == 404 {
        return Err(Error::msg("Essa conta não possui o Minecraft: Java Edition."));
    }
    let profile: McProfile = resp.error_for_status()?.json().await?;
    let skin_url = profile.skins.iter().find(|s| s.state == "ACTIVE").map(|s| s.url.clone());

    Ok(Account {
        uuid: profile.id,
        name: profile.name,
        kind: AccountKind::Microsoft,
        access_token: mc.access_token,
        refresh_token,
        expires_at: chrono::Utc::now().timestamp() + mc.expires_in,
        xuid: user.xid.clone(),
        skin_url,
    })
}

#[cfg(test)]
mod tests {
    #[test]
    fn offline_uuid_igual_ao_do_servidor() {
        // UUID.nameUUIDFromBytes("OfflinePlayer:Notch") no Java
        let acc = super::offline("Notch").unwrap();
        assert_eq!(acc.uuid, "b50ad385829d3141a2167e7d7539ba7f");
        assert!(super::offline("a b").is_err());
    }
}
