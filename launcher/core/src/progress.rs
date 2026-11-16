use serde::Serialize;
use std::sync::Arc;

/// Evento de progresso enviado para a interface.
#[derive(Debug, Clone, Serialize)]
pub struct Progress {
    pub stage: String,
    pub message: String,
    pub current: u64,
    pub total: u64,
}

pub type ProgressFn = Arc<dyn Fn(Progress) + Send + Sync>;

pub fn report(cb: &ProgressFn, stage: &str, message: impl Into<String>, current: u64, total: u64) {
    cb(Progress {
        stage: stage.to_string(),
        message: message.into(),
        current,
        total,
    });
}
