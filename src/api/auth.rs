//! Basic-auth middleware for admin-only endpoints.
//!
//! When `FANQIE_ADMIN_USERNAME` and `FANQIE_ADMIN_PASSWORD` are set,
//! every non-public route requires matching HTTP Basic credentials.
//! Public read-only endpoints stay open so monitoring / the web reader work.

use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
};
use base64::Engine;

use crate::server::AppState;

/// Paths that are public (no auth required).
fn is_public(path: &str) -> bool {
    matches!(
        path,
        "/" | "/health" | "/read" | "/read/" | "/api/config" | "/api/proxy/pool"
    )
}

pub async fn admin_auth(
    State(state): State<AppState>,
    req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // No admin credentials configured → the service is open (documented).
    let (Some(user), Some(pass)) = (&state.config.admin_username, &state.config.admin_password)
    else {
        return Ok(next.run(req).await);
    };

    // Public endpoints never need auth.
    if is_public(req.uri().path()) {
        return Ok(next.run(req).await);
    }

    let provided = req
        .headers()
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .unwrap_or("")
        .to_string();

    let expected = format!(
        "Basic {}",
        base64::engine::general_purpose::STANDARD.encode(format!("{user}:{pass}"))
    );

    // Constant-time compare to avoid a timing oracle on the credentials.
    if consteq(&provided, &expected) {
        Ok(next.run(req).await)
    } else {
        Err(StatusCode::UNAUTHORIZED)
    }
}

/// Simple constant-time string compare.
fn consteq(a: &str, b: &str) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.bytes()
        .zip(b.bytes())
        .fold(0u8, |acc, (x, y)| acc | (x ^ y))
        == 0
}
