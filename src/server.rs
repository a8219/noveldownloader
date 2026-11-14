//! Application state and server bootstrap.

use axum::Router;
use std::{collections::HashMap, sync::Arc};
use tokio::sync::RwLock;

use crate::api::routes;
use crate::config::Config;

/// Registered device + chapter key, cached process-wide.
#[derive(Clone, Debug)]
pub struct DeviceCache {
    pub device_id: String,
    pub install_id: String,
    pub device_type: String,
    pub key: Option<Vec<u8>>,
    pub keyver: Option<String>,
}

#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    pub http: reqwest::Client,
    pub upstream_url: Option<String>,
    pub library: Arc<RwLock<HashMap<String, serde_json::Value>>>,
    pub jobs: Arc<RwLock<HashMap<String, serde_json::Value>>>,
    pub device: Arc<RwLock<Option<DeviceCache>>>,
    pub records: Arc<RwLock<HashMap<String, usize>>>,
    pub web: Arc<crate::web_account::WebAccountStore>,
}

pub async fn run(config: Config) -> anyhow::Result<()> {
    let http = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(config.request_timeout_secs))
        .user_agent("NovelDownloader/0.3")
        .brotli(true)
        .gzip(true)
        .pool_max_idle_per_host(32)
        .build()?;

    let upstream_url = config.upstream_url.clone();

    let state = AppState {
        config,
        http,
        upstream_url,
        library: Arc::new(RwLock::new(HashMap::new())),
        jobs: Arc::new(RwLock::new(HashMap::new())),
        device: Arc::new(RwLock::new(None)),
        records: Arc::new(RwLock::new(HashMap::new())),
        web: Arc::new(crate::web_account::WebAccountStore::new(
            std::env::var("DATA_DIR").unwrap_or_else(|_| ".".to_string()),
        )),
    };

    let app: Router = routes::build_router(state.clone());
    let addr: std::net::SocketAddr = state_addr(&state.config.bind_addr)?;
    tracing::info!(%addr, "NovelDownloader listening");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

fn state_addr(bind: &str) -> anyhow::Result<std::net::SocketAddr> {
    let addr: std::net::SocketAddr = bind.parse()?;
    Ok(addr)
}
