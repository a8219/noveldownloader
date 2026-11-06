//! Route table.

use axum::{
    middleware,
    routing::{any, get, post},
    Router,
};
use tower_http::{cors::CorsLayer, trace::TraceLayer};

use crate::api::auth::admin_auth;
use crate::api::handlers;
use crate::server::AppState;

pub fn build_router(state: AppState) -> Router {
    Router::new()
        .route("/", get(handlers::index))
        .route("/health", get(handlers::health))
        .route("/read", get(handlers::read_page))
        .route("/read/", get(handlers::read_page))
        // catalog
        .route("/api/search", get(handlers::api_search))
        .route("/api/detail", get(handlers::api_detail))
        .route("/api/directory", get(handlers::api_directory))
        .route("/api/content", get(handlers::api_content))
        .route("/api/update", get(handlers::api_update))
        // download / export
        .route("/api/download", get(handlers::api_download))
        .route("/api/export", get(handlers::api_export))
        .route("/api/export/zip", get(handlers::api_export_zip))
        // config / misc
        .route("/api/config", any(handlers::api_config))
        .route("/api/proxy/pool", any(handlers::api_proxy_pool))
        // multi-source (qimao)
        .route("/api/caps", get(handlers::api_caps))
        .route("/api/qimao/search", get(handlers::api_qimao_search))
        .route("/api/qimao/directory", get(handlers::api_qimao_directory))
        .route("/api/qimao/content", get(handlers::api_qimao_content))
        // library / jobs
        .route(
            "/api/library",
            get(handlers::list_library).post(handlers::add_library),
        )
        .route(
            "/api/library/:book_id",
            axum::routing::delete(handlers::remove_library),
        )
        .route(
            "/api/jobs",
            get(handlers::list_jobs).post(handlers::create_job),
        )
        .route("/api/jobs/:id", get(handlers::get_job))
        // telegram
        .route("/tg/webhook", post(handlers::tg_webhook))
        .route("/tg/setup", get(handlers::tg_setup))
        // Admin basic-auth on all non-public routes (must be layered before
        // `with_state` so the middleware and routes share the same state).
        .layer(middleware::from_fn_with_state(state.clone(), admin_auth))
        .layer(CorsLayer::very_permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
