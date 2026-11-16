use crate::{Error, Result};
use futures::{stream, StreamExt};
use serde::de::DeserializeOwned;
use sha1::{Digest, Sha1};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, OnceLock};
use std::time::Duration;
use tokio::io::AsyncWriteExt;

pub const USER_AGENT: &str = concat!("CarlosBR177/Kairo-Launcher/", env!("CARGO_PKG_VERSION"), " (github.com/CarlosBR177/Kairo-Launcher)");

pub fn client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .user_agent(USER_AGENT)
            .connect_timeout(Duration::from_secs(15))
            .timeout(Duration::from_secs(120))
            .pool_max_idle_per_host(32)
            .build()
            .expect("cliente HTTP")
    })
}

pub async fn get_json<T: DeserializeOwned>(url: &str) -> Result<T> {
    let resp = client().get(url).send().await?.error_for_status()?;
    Ok(resp.json::<T>().await?)
}

/// Um arquivo para baixar. `sha1`/`size` são opcionais, mas evitam baixar de novo.
#[derive(Debug, Clone)]
pub struct Job {
    pub url: String,
    pub path: PathBuf,
    pub sha1: Option<String>,
    pub size: Option<u64>,
}

pub fn sha1_file(path: &Path) -> Result<String> {
    let mut file = std::fs::File::open(path)?;
    let mut hasher = Sha1::new();
    std::io::copy(&mut file, &mut hasher)?;
    Ok(hex::encode(hasher.finalize()))
}

/// Verificação rápida: tamanho quando conhecido; hash apenas quando não há tamanho.
fn is_valid(job: &Job) -> bool {
    let Ok(meta) = std::fs::metadata(&job.path) else { return false };
    if let Some(size) = job.size {
        return meta.len() == size;
    }
    match &job.sha1 {
        Some(expected) => sha1_file(&job.path).map(|h| h.eq_ignore_ascii_case(expected)).unwrap_or(false),
        None => true,
    }
}

/// Arquivo temporário exclusivo deste download.
/// Antes era `with_extension("part")`, e arquivos com o mesmo nome-base na mesma pasta
/// (ex.: `bin/java.exe` e `bin/java.dll`, `lib/jvm.cfg` e `lib/jvm.lib`, `1.21.1.jar` e `1.21.1.json`)
/// escreviam no MESMO `.part` em paralelo — o hash passava (é calculado na memória), mas o arquivo
/// final saía misturado. Foi isso que corrompeu o `jvm.cfg` do Java.
fn temp_path(path: &Path) -> PathBuf {
    static SEQ: AtomicU64 = AtomicU64::new(0);
    let n = SEQ.fetch_add(1, Ordering::Relaxed);
    let name = path.file_name().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
    path.with_file_name(format!("{name}.{}-{n}.part", std::process::id()))
}

async fn download_once(job: &Job) -> Result<()> {
    if let Some(parent) = job.path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    let tmp = temp_path(&job.path);
    let mut resp = client().get(&job.url).send().await?.error_for_status()?;
    let mut file = tokio::fs::File::create(&tmp).await?;
    let mut hasher = Sha1::new();
    while let Some(chunk) = resp.chunk().await? {
        hasher.update(&chunk);
        file.write_all(&chunk).await?;
    }
    file.flush().await?;
    drop(file);
    if let Some(expected) = &job.sha1 {
        let got = hex::encode(hasher.finalize());
        if !got.eq_ignore_ascii_case(expected) {
            let _ = tokio::fs::remove_file(&tmp).await;
            return Err(Error::msg(format!("Arquivo corrompido ({}), hash não confere", job.url)));
        }
    }
    tokio::fs::rename(&tmp, &job.path).await?;
    Ok(())
}

pub async fn download(job: &Job) -> Result<()> {
    if is_valid(job) {
        return Ok(());
    }
    let mut last = None;
    for attempt in 0..3 {
        match download_once(job).await {
            Ok(()) => return Ok(()),
            Err(e) => {
                last = Some(e);
                tokio::time::sleep(Duration::from_millis(400 * (attempt + 1))).await;
            }
        }
    }
    Err(last.unwrap_or_else(|| Error::msg("falha no download")))
}

/// Baixa vários arquivos em paralelo. `on_progress(concluídos, total)`.
pub async fn download_all<F>(jobs: Vec<Job>, concurrency: usize, on_progress: F) -> Result<()>
where
    F: Fn(u64, u64) + Send + Sync,
{
    let total = jobs.len() as u64;
    let done = Arc::new(AtomicU64::new(0));
    on_progress(0, total);
    let mut results = stream::iter(jobs.into_iter().map(|job| {
        let done = done.clone();
        async move {
            let r = download(&job).await;
            done.fetch_add(1, Ordering::Relaxed);
            r
        }
    }))
    .buffer_unordered(concurrency.max(1));

    let mut first_err = None;
    let mut last_report = 0u64;
    while let Some(r) = results.next().await {
        if let Err(e) = r {
            first_err.get_or_insert(e);
        }
        let d = done.load(Ordering::Relaxed);
        // evita inundar a interface com milhares de eventos
        if d == total || d - last_report >= (total / 200).max(1) {
            last_report = d;
            on_progress(d, total);
        }
    }
    match first_err {
        Some(e) => Err(e),
        None => Ok(()),
    }
}

#[cfg(test)]
mod tmp_tests {
    use super::*;

    /// `java.exe` e `java.dll` (mesmo nome-base) não podem dividir o arquivo temporário.
    #[test]
    fn temporarios_nao_colidem() {
        let a = temp_path(Path::new("bin/java.exe"));
        let b = temp_path(Path::new("bin/java.dll"));
        let c = temp_path(Path::new("bin/java.exe"));
        assert_ne!(a, b);
        assert_ne!(a, c);
        assert!(a.to_string_lossy().contains("java.exe."));
        assert_eq!(a.parent(), Some(Path::new("bin")));
    }
}
