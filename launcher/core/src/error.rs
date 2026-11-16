use serde::{Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("{}", describe_http(.0))]
    Http(#[from] reqwest::Error),
    #[error("Erro de arquivo: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON inválido: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Arquivo compactado inválido: {0}")]
    Zip(#[from] zip::result::ZipError),
    #[error("{0}")]
    Msg(String),
}

fn describe_http(e: &reqwest::Error) -> String {
    let host = e.url().and_then(|u| u.host_str()).unwrap_or("o servidor").to_string();
    if e.is_timeout() {
        format!("{host} demorou demais para responder. Tente de novo.")
    } else if e.is_connect() || e.is_request() {
        format!("Sem conexão com {host}. Verifique sua internet ou firewall.")
    } else if let Some(status) = e.status() {
        format!("{host} respondeu com erro {}.", status.as_u16())
    } else {
        format!("Erro de rede com {host}: {e}")
    }
}

impl Error {
    pub fn msg(s: impl Into<String>) -> Self {
        Error::Msg(s.into())
    }
}

/// Permite devolver o erro direto para o front-end (vira uma string legível).
impl Serialize for Error {
    fn serialize<S: Serializer>(&self, s: S) -> std::result::Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

pub type Result<T> = std::result::Result<T, Error>;
