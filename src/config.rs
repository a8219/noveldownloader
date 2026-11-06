use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub bind_addr: String,
    pub request_timeout_secs: u64,
    pub fanqie_cookie: Option<String>,
    pub proxy_api: Option<String>,
    pub tg_bot_token: Option<String>,
    pub tg_webhook_secret: Option<String>,
    pub admin_username: Option<String>,
    pub admin_password: Option<String>,
    pub online_read: bool,
    /// Optional upstream Worker for features not yet ported natively.
    pub upstream_url: Option<String>,
    pub base_url: Option<String>,
}

impl Config {
    pub fn from_env() -> Self {
        fn opt(k: &str) -> Option<String> {
            env::var(k)
                .ok()
                .map(|v| v.trim().to_string())
                .filter(|v| !v.is_empty())
        }
        Self {
            bind_addr: env::var("BIND_ADDR").unwrap_or_else(|_| "0.0.0.0:8080".into()),
            request_timeout_secs: env::var("REQUEST_TIMEOUT_SECS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(45),
            fanqie_cookie: opt("FANQIE_COOKIE"),
            proxy_api: opt("FANQIE_PROXY_API").map(|v| v.trim_end_matches('/').to_string()),
            tg_bot_token: opt("TG_BOT_TOKEN"),
            tg_webhook_secret: opt("TG_WEBHOOK_SECRET"),
            admin_username: opt("FANQIE_ADMIN_USERNAME"),
            admin_password: opt("FANQIE_ADMIN_PASSWORD"),
            online_read: env::var("FANQIE_ONLINE_READ")
                .map(|v| v != "0")
                .unwrap_or(true),
            upstream_url: opt("WORKER_UPSTREAM_URL").map(|v| v.trim_end_matches('/').to_string()),
            base_url: opt("BASE_URL").map(|v| v.trim_end_matches('/').to_string()),
        }
    }
}
