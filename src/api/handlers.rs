//! HTTP handlers.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{Html, IntoResponse, Response},
    Json,
};
use serde_json::{json, Value};
use std::collections::HashMap;
use uuid::Uuid;

use crate::crypto::chapter::ChapterFetcher;
use crate::export::{export_html, export_txt, export_zip, ChapterText};
use crate::server::AppState;
use crate::telegram::TelegramBot;

type Params = Query<HashMap<String, String>>;

pub async fn index(State(state): State<AppState>) -> Json<Value> {
    Json(json!({
        "code": 200,
        "name": "noveldownloader-rust",
        "version": env!("CARGO_PKG_VERSION"),
        "upstream": state.upstream_url.is_some(),
        "endpoints": [
            "/read",
            "/api/search?key=",
            "/api/detail?book_id=",
            "/api/directory?book_id=",
            "/api/content?item_id=",
            "/api/download?book_id=&start=&count=",
            "/api/export?book_id=&format=txt|html",
            "/api/export/zip?book_id=&format=txt|html",
            "/api/update?book_id=",
            "/api/library",
            "/api/jobs",
            "POST /tg/webhook",
            "GET /tg/setup"
        ],
        "font_map_entries": crate::font_map::FONT_MAP.len(),
    }))
}

pub async fn health(State(state): State<AppState>) -> Json<Value> {
    Json(json!({
        "code": 200,
        "status": "ok",
        "cookie_configured": state.config.fanqie_cookie.is_some(),
        "proxy_configured": state.config.proxy_api.is_some(),
        "tg_configured": state.config.tg_bot_token.is_some(),
        "upstream_configured": state.upstream_url.is_some(),
        "online_read": state.config.online_read,
        "device_registered": state.device.read().await.is_some(),
    }))
}

pub async fn read_page(State(state): State<AppState>) -> Response {
    if !state.config.online_read {
        return err(StatusCode::FORBIDDEN, "online reading disabled");
    }
    Html(crate::read_page::READ_PAGE_HTML).into_response()
}

// ---------------- search ----------------

pub async fn api_search(State(state): State<AppState>, Query(q): Params) -> Response {
    let key = q.get("key").cloned().unwrap_or_default();
    if key.trim().is_empty() {
        return err(StatusCode::BAD_REQUEST, "key required");
    }

    if let Some(proxy) = &state.config.proxy_api {
        match crate::search::search_via_proxy(&key, proxy, &state.http).await {
            Ok(list) if !list.is_empty() => {
                return Json(json!({
                    "code": 200, "from": "proxy",
                    "data": { "search_book_data_list": list, "total_count": list.len() }
                }))
                .into_response();
            }
            Ok(_) => tracing::debug!("proxy search returned no results"),
            Err(e) => tracing::warn!("proxy search failed: {e}"),
        }
    }

    match crate::search::search_native(&key, &state.config).await {
        Ok(list) if !list.is_empty() => Json(json!({
            "code": 200, "from": "app",
            "data": { "search_book_data_list": list, "total_count": list.len() }
        }))
        .into_response(),
        Ok(_) => {
            if is_book_id(&key) {
                Json(json!({
                    "code": 200, "from": "id",
                    "data": { "book_ids": [key] },
                    "note": "treated as book_id"
                }))
                .into_response()
            } else {
                err(
                    StatusCode::NOT_IMPLEMENTED,
                    "search unavailable (no proxy configured)",
                )
            }
        }
        Err(e) => {
            if is_book_id(&key) {
                Json(json!({
                    "code": 200, "from": "id",
                    "data": { "book_ids": [key] },
                    "note": "treated as book_id"
                }))
                .into_response()
            } else {
                err(StatusCode::NOT_IMPLEMENTED, &format!("search failed: {e}"))
            }
        }
    }
}

// ---------------- book meta ----------------

pub async fn api_detail(State(state): State<AppState>, Query(q): Params) -> Response {
    let Some(book_id) = pick_book_id(&q) else {
        return err(StatusCode::BAD_REQUEST, "book_id required");
    };
    match fetch_book_page(&state, &book_id).await {
        Ok(page) => Json(json!({
            "code": 200, "from": "web",
            "data": {
                "book_id": book_id,
                "book_name": str_of(&page, "bookName"),
                "author": str_of(&page, "author"),
                "abstract": str_of(&page, "abstract"),
                "status": str_of(&page, "status"),
                "word_number": int_of(&page, "wordNumber"),
                "chapter_total": int_of(&page, "chapterTotal"),
                "last_chapter_title": str_of(&page, "lastChapterTitle"),
            }
        }))
        .into_response(),
        Err(e) => err(StatusCode::BAD_GATEWAY, &format!("detail failed: {e}")),
    }
}

pub async fn api_directory(State(state): State<AppState>, Query(q): Params) -> Response {
    let Some(book_id) = pick_book_id(&q) else {
        return err(StatusCode::BAD_REQUEST, "book_id required");
    };
    match fetch_directory(&state, &book_id).await {
        Ok((book_name, author, lists)) => Json(json!({
            "code": 200, "from": "web",
            "data": {
                "book_id": book_id,
                "book_name": book_name,
                "author": author,
                "chapter_total": lists.len(),
                "lists": lists,
            }
        }))
        .into_response(),
        Err(e) => err(StatusCode::BAD_GATEWAY, &format!("directory failed: {e}")),
    }
}

// ---------------- chapter content ----------------

pub async fn api_content(State(state): State<AppState>, Query(q): Params) -> Response {
    let Some(item_id) = q.get("item_id").cloned().filter(|s| !s.is_empty()) else {
        return err(StatusCode::BAD_REQUEST, "item_id required");
    };
    match fetch_chapter(&state, &item_id).await {
        Ok(ch) => Json(json!({
            "code": 200, "from": ch.source,
            "data": {
                "item_id": item_id,
                "title": ch.title,
                "book_name": ch.book_name,
                "content": ch.content,
                "locked": false,
                "truncated": ch.truncated,
            }
        }))
        .into_response(),
        Err(e) => err(StatusCode::BAD_GATEWAY, &format!("content failed: {e}")),
    }
}

// ---------------- download / export ----------------

pub async fn api_download(State(state): State<AppState>, Query(q): Params) -> Response {
    let Some(book_id) = pick_book_id(&q) else {
        return err(StatusCode::BAD_REQUEST, "book_id required");
    };
    let start: usize = q.get("start").and_then(|v| v.parse().ok()).unwrap_or(0);
    let count: usize = q
        .get("count")
        .and_then(|v| v.parse().ok())
        .unwrap_or(20)
        .clamp(1, 30);

    let (book_name, _, lists) = match fetch_directory(&state, &book_id).await {
        Ok(v) => v,
        Err(e) => return err(StatusCode::BAD_GATEWAY, &format!("directory failed: {e}")),
    };

    if start >= lists.len() {
        return err(StatusCode::RANGE_NOT_SATISFIABLE, "start out of range");
    }
    let end = (start + count).min(lists.len());
    let slice = &lists[start..end];

    let chapters = collect_chapters(&state, slice).await;
    let text = chapters
        .iter()
        .map(|c| format!("## {}\n\n{}", c.title, c.content))
        .collect::<Vec<_>>()
        .join("\n\n");

    Json(json!({
        "code": 200,
        "book_id": book_id,
        "book_name": book_name,
        "total": lists.len(),
        "start": start,
        "count": slice.len(),
        "next": if end < lists.len() { Some(end) } else { None },
        "text": text,
    }))
    .into_response()
}

pub async fn api_export(State(state): State<AppState>, Query(q): Params) -> Response {
    let Some(book_id) = pick_book_id(&q) else {
        return err(StatusCode::BAD_REQUEST, "book_id required");
    };
    let format = q.get("format").cloned().unwrap_or_else(|| "txt".into());
    let start: usize = q.get("start").and_then(|v| v.parse().ok()).unwrap_or(0);
    let count: usize = q
        .get("count")
        .and_then(|v| v.parse().ok())
        .unwrap_or(20)
        .clamp(1, 45);

    let (book_name, _, lists) = match fetch_directory(&state, &book_id).await {
        Ok(v) => v,
        Err(e) => return err(StatusCode::BAD_GATEWAY, &format!("directory failed: {e}")),
    };
    if start >= lists.len() {
        return err(StatusCode::RANGE_NOT_SATISFIABLE, "start out of range");
    }
    let end = (start + count).min(lists.len());
    let chapters = collect_chapters(&state, &lists[start..end]).await;

    match format.as_str() {
        "txt" => {
            let body = export_txt(&book_name, &chapters);
            Json(json!({
                "code": 200, "format": "txt", "book_id": book_id, "book_name": book_name,
                "total": lists.len(), "start": start, "count": chapters.len(),
                "next": if end < lists.len() { Some(end) } else { None },
                "text": String::from_utf8_lossy(&body),
            }))
            .into_response()
        }
        "html" => {
            let body = export_html(&book_name, &chapters);
            Json(json!({
                "code": 200, "format": "html", "book_id": book_id, "book_name": book_name,
                "total": lists.len(), "start": start, "count": chapters.len(),
                "next": if end < lists.len() { Some(end) } else { None },
                "html": String::from_utf8_lossy(&body),
            }))
            .into_response()
        }
        other => err(
            StatusCode::BAD_REQUEST,
            &format!("unsupported format: {other}"),
        ),
    }
}

pub async fn api_export_zip(State(state): State<AppState>, Query(q): Params) -> Response {
    let Some(book_id) = pick_book_id(&q) else {
        return err(StatusCode::BAD_REQUEST, "book_id required");
    };
    let start: usize = q.get("start").and_then(|v| v.parse().ok()).unwrap_or(0);
    let count: usize = q
        .get("count")
        .and_then(|v| v.parse().ok())
        .unwrap_or(20)
        .clamp(1, 40);

    let (book_name, _, lists) = match fetch_directory(&state, &book_id).await {
        Ok(v) => v,
        Err(e) => return err(StatusCode::BAD_GATEWAY, &format!("directory failed: {e}")),
    };
    if start >= lists.len() {
        return err(StatusCode::RANGE_NOT_SATISFIABLE, "start out of range");
    }
    let end = (start + count).min(lists.len());
    let chapters = collect_chapters(&state, &lists[start..end]).await;

    let zip = match export_zip(&book_name, &chapters) {
        Ok(z) => z,
        Err(e) => {
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                &format!("zip failed: {e}"),
            )
        }
    };

    let safe: String = book_name
        .chars()
        .map(|c| if is_path_safe(c) { c } else { '_' })
        .collect();
    let fname = format!("{safe}_{}-{}.zip", start + 1, end);

    axum::response::Response::builder()
        .status(StatusCode::OK)
        .header("content-type", "application/zip")
        .header(
            "content-disposition",
            format!("attachment; filename=\"{fname}\""),
        )
        .header("x-total", lists.len().to_string())
        .header("x-start", start.to_string())
        .header("x-count", chapters.len().to_string())
        .header(
            "x-next",
            if end < lists.len() {
                end.to_string()
            } else {
                String::new()
            },
        )
        .body(axum::body::Body::from(zip))
        .unwrap_or_else(|e| err(StatusCode::INTERNAL_SERVER_ERROR, &format!("{e}")))
}

pub async fn api_update(State(state): State<AppState>, Query(q): Params) -> Response {
    let Some(book_id) = pick_book_id(&q) else {
        return err(StatusCode::BAD_REQUEST, "book_id required");
    };
    let (book_name, _, lists) = match fetch_directory(&state, &book_id).await {
        Ok(v) => v,
        Err(e) => return err(StatusCode::BAD_GATEWAY, &format!("directory failed: {e}")),
    };
    let total = lists.len();
    let mut records = state.records.write().await;
    let last_seen = records.get(&book_id).copied().unwrap_or(0);
    if total > last_seen {
        records.insert(book_id.clone(), total);
    }
    let new_chapters = if last_seen == 0 {
        total
    } else {
        total.saturating_sub(last_seen)
    };
    Json(json!({
        "code": 200, "book_id": book_id, "book_name": book_name,
        "total": total, "last_seen": last_seen, "new_chapters": new_chapters,
        "next_start": last_seen,
    }))
    .into_response()
}

// ---------------- config / misc ----------------

pub async fn api_config(State(state): State<AppState>) -> Response {
    Json(json!({
        "code": 200,
        "proxy_api": state.config.proxy_api,
        "cookie_configured": state.config.fanqie_cookie.is_some(),
        "upstream_configured": state.upstream_url.is_some(),
    }))
    .into_response()
}

pub async fn api_proxy_pool() -> Response {
    Json(json!({ "code": 200, "pool": [] })).into_response()
}

// ---------------- library ----------------

pub async fn list_library(State(state): State<AppState>) -> Response {
    let books: Vec<Value> = state.library.read().await.values().cloned().collect();
    Json(json!({ "code": 200, "data": books })).into_response()
}

pub async fn add_library(State(state): State<AppState>, Json(body): Json<Value>) -> Response {
    let Some(id) = body
        .get("book_id")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
    else {
        return err(StatusCode::BAD_REQUEST, "book_id required");
    };
    state
        .library
        .write()
        .await
        .insert(id.to_string(), body.clone());
    Json(json!({ "code": 200, "data": body })).into_response()
}

pub async fn remove_library(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
) -> Response {
    let removed = state.library.write().await.remove(&book_id).is_some();
    Json(json!({ "code": 200, "deleted": removed })).into_response()
}

// ---------------- jobs ----------------

pub async fn create_job(State(state): State<AppState>, Json(body): Json<Value>) -> Response {
    let job = json!({
        "id": Uuid::new_v4().to_string(),
        "book_id": body.get("book_id").and_then(|v| v.as_str()).unwrap_or(""),
        "format": body.get("format").and_then(|v| v.as_str()).unwrap_or("txt"),
        "status": "queued",
        "created_at": now_secs(),
    });
    let id = job["id"].as_str().unwrap_or_default().to_string();
    state.jobs.write().await.insert(id, job.clone());
    Json(json!({ "code": 202, "data": job })).into_response()
}

pub async fn list_jobs(State(state): State<AppState>) -> Response {
    let jobs: Vec<Value> = state.jobs.read().await.values().cloned().collect();
    Json(json!({ "code": 200, "data": jobs })).into_response()
}

pub async fn get_job(State(state): State<AppState>, Path(id): Path<String>) -> Response {
    match state.jobs.read().await.get(&id).cloned() {
        Some(job) => Json(json!({ "code": 200, "data": job })).into_response(),
        None => err(StatusCode::NOT_FOUND, "job not found"),
    }
}

// ---------------- telegram ----------------

pub async fn tg_webhook(State(state): State<AppState>, body: axum::body::Bytes) -> Response {
    let Ok(update) = serde_json::from_slice::<Value>(&body) else {
        return err(StatusCode::BAD_REQUEST, "invalid JSON");
    };

    let msg = update.get("message").or_else(|| update.get("channel_post"));
    let Some(msg) = msg else {
        return Json(json!({ "code": 200, "note": "no message" })).into_response();
    };

    let Some(chat_id) = msg
        .get("chat")
        .and_then(|c| c.get("id"))
        .and_then(|i| i.as_i64())
    else {
        return Json(json!({ "code": 200, "note": "no chat id" })).into_response();
    };
    let chat_id = chat_id.to_string();
    let text = msg
        .get("text")
        .and_then(|t| t.as_str())
        .unwrap_or("")
        .trim();

    let Some(bot) = TelegramBot::from_config(&state.config) else {
        return err(
            StatusCode::SERVICE_UNAVAILABLE,
            "TG_BOT_TOKEN not configured",
        );
    };

    if text == "/start" || text == "/help" {
        let reply = "📖 NovelDownloader\n\n发送小说链接或书籍 ID 即可下载。\n示例：https://fanqienovel.com/page/7615694942362422297";
        let _ = bot.send_message(&chat_id, reply).await;
        return Json(json!({ "code": 200 })).into_response();
    }

    let Some(book_id) = extract_book_id(text) else {
        let _ = bot
            .send_message(&chat_id, "⚠️ 未识别到书籍链接或 ID，请重试。")
            .await;
        return Json(json!({ "code": 200 })).into_response();
    };

    // Do the work in the background: TG expects a fast 200 response.
    let st = state.clone();
    let cid = chat_id.clone();
    tokio::spawn(async move {
        let _ = bot
            .send_message(&cid, &format!("📥 开始处理 {book_id} ..."))
            .await;
        match fetch_directory(&st, &book_id).await {
            Err(e) => {
                let _ = bot
                    .send_message(&cid, &format!("❌ 获取目录失败: {e}"))
                    .await;
            }
            Ok((book_name, _, lists)) => {
                if lists.is_empty() {
                    let _ = bot.send_message(&cid, "❌ 目录为空").await;
                    return;
                }
                let total = lists.len();
                let _ = bot
                    .send_message(&cid, &format!("《{book_name}》共 {total} 章，开始抓取…"))
                    .await;

                let chapters = collect_chapters(&st, &lists).await;
                let payload = export_txt(&book_name, &chapters);
                let filename = format!("{}.txt", sanitize(&book_name));

                if let Err(e) = bot
                    .send_document(
                        &cid,
                        &filename,
                        payload,
                        &format!("《{book_name}》共 {total} 章"),
                    )
                    .await
                {
                    let _ = bot
                        .send_message(&cid, &format!("❌ 发送文件失败: {e}"))
                        .await;
                }
            }
        }
    });

    Json(json!({ "code": 200, "accepted": true })).into_response()
}

pub async fn tg_setup(State(state): State<AppState>) -> Response {
    let Some(token) = state.config.tg_bot_token.clone() else {
        return err(StatusCode::BAD_REQUEST, "TG_BOT_TOKEN not configured");
    };
    let Some(base) = state.config.base_url.clone() else {
        return err(
            StatusCode::BAD_REQUEST,
            "BASE_URL not configured (needed to register webhook)",
        );
    };

    let bot = TelegramBot::from_token(token);
    let hook = format!("{base}/tg/webhook");
    let secret = std::env::var("TG_WEBHOOK_SECRET")
        .ok()
        .filter(|s| !s.is_empty());

    match bot.set_webhook(&hook, secret.as_deref()).await {
        Ok(()) => Json(json!({ "code": 200, "webhook": hook })).into_response(),
        Err(e) => err(StatusCode::BAD_GATEWAY, &format!("setWebhook failed: {e}")),
    }
}

// ================= helpers =================

struct FetchedChapter {
    title: String,
    book_name: String,
    content: String,
    truncated: bool,
    source: &'static str,
}

/// Shared device/key cache: register once, reuse afterwards.
async fn device_fetcher(state: &AppState) -> ChapterFetcher {
    let mut fetcher = ChapterFetcher::new(state.http.clone());
    let cached = state.device.read().await.clone();
    if let Some(d) = cached {
        fetcher.restore(d.device_id, d.install_id, d.device_type, d.key, d.keyver);
    }
    fetcher
}

async fn save_device(state: &AppState, fetcher: &ChapterFetcher) {
    if let Some(d) = fetcher.export() {
        *state.device.write().await = Some(d);
    }
}

/// Try APP endpoint (signed+decrypted), fall back to the public reader page.
async fn fetch_chapter(state: &AppState, item_id: &str) -> anyhow::Result<FetchedChapter> {
    let mut fetcher = device_fetcher(state).await;
    let app_result = fetcher.get_full_chapter(item_id).await;
    save_device(state, &fetcher).await;

    if let Ok(ch) = app_result {
        if !ch.content.trim().is_empty() {
            return Ok(FetchedChapter {
                title: ch.title,
                book_name: ch.book_name,
                content: ch.content,
                truncated: false,
                source: "app",
            });
        }
    }

    // Fallback: public reader page (may be a short preview for locked chapters).
    let html = fetch_html(state, &format!("https://fanqienovel.com/reader/{item_id}")).await?;
    let st = extract_state(&html)?;
    let cd = st
        .pointer("/reader/chapterData")
        .ok_or_else(|| anyhow::anyhow!("reader page has no chapterData"))?;

    let raw = cd.get("content").and_then(|v| v.as_str()).unwrap_or("");
    let content = crate::font_map::decode_font(&strip_tags(raw));
    let title = cd
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let book_name = cd
        .get("bookName")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let truncated = content.chars().count() < 500;

    Ok(FetchedChapter {
        title,
        book_name,
        content,
        truncated,
        source: "web",
    })
}

async fn collect_chapters(state: &AppState, lists: &[Value]) -> Vec<ChapterText> {
    let mut out = Vec::with_capacity(lists.len());
    for (i, item) in lists.iter().enumerate() {
        let item_id = item
            .get("item_id")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();
        let fallback_title = item
            .get("title")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .unwrap_or_else(|| format!("第 {} 章", i + 1));

        match fetch_chapter(state, &item_id).await {
            Ok(ch) => {
                let title = if ch.title.is_empty() {
                    fallback_title
                } else {
                    ch.title
                };
                out.push(ChapterText {
                    title,
                    content: ch.content,
                });
            }
            Err(e) => {
                tracing::warn!("chapter {item_id} failed: {e}");
                out.push(ChapterText {
                    title: fallback_title,
                    content: "[获取失败]".into(),
                });
            }
        }
    }
    out
}

async fn fetch_book_page(state: &AppState, book_id: &str) -> anyhow::Result<Value> {
    let html = fetch_html(state, &format!("https://fanqienovel.com/page/{book_id}")).await?;
    let st = extract_state(&html)?;
    st.pointer("/page")
        .cloned()
        .ok_or_else(|| anyhow::anyhow!("page state missing"))
}

async fn fetch_directory(
    state: &AppState,
    book_id: &str,
) -> anyhow::Result<(String, String, Vec<Value>)> {
    let page = fetch_book_page(state, book_id).await?;

    let book_name = str_of(&page, "bookName");
    let author = str_of(&page, "author");

    // itemIds is newest-first on the page; reverse to reading order.
    let mut ids: Vec<String> = page
        .get("itemIds")
        .and_then(|v| v.as_array())
        .map(|a| {
            a.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();
    ids.reverse();

    let title_map: HashMap<String, String> = page
        .get("chapterList")
        .and_then(|v| v.as_array())
        .map(|a| {
            a.iter()
                .filter_map(|c| {
                    let id = c.get("itemId").and_then(|v| v.as_str())?;
                    let t = c.get("title").and_then(|v| v.as_str()).unwrap_or("");
                    Some((id.to_string(), t.to_string()))
                })
                .collect()
        })
        .unwrap_or_default();

    let lists = ids
        .iter()
        .enumerate()
        .map(|(i, id)| {
            json!({
                "item_id": id,
                "title": title_map.get(id).cloned().unwrap_or_default(),
                "order": i + 1,
            })
        })
        .collect();

    Ok((book_name, author, lists))
}

async fn fetch_html(state: &AppState, url: &str) -> anyhow::Result<String> {
    let mut req = state.http.get(url).header(
        reqwest::header::USER_AGENT,
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) \
         Chrome/124.0 Mobile Safari/537.36",
    );
    if let Some(cookie) = &state.config.fanqie_cookie {
        req = req.header(reqwest::header::COOKIE, cookie);
    }
    let resp = req.send().await?;
    if !resp.status().is_success() {
        anyhow::bail!("{url} -> HTTP {}", resp.status());
    }
    Ok(resp.text().await?)
}

/// Extract `window.__INITIAL_STATE__` without a regex dependency.
pub fn extract_state(html: &str) -> anyhow::Result<Value> {
    const MARKER: &str = "window.__INITIAL_STATE__=";
    let idx = html
        .find(MARKER)
        .ok_or_else(|| anyhow::anyhow!("__INITIAL_STATE__ not found"))?;
    let rest = &html[idx + MARKER.len()..];

    let mut depth = 0i32;
    let mut in_str = false;
    let mut escaped = false;
    let mut end = None;

    for (i, ch) in rest.char_indices() {
        if in_str {
            if escaped {
                escaped = false;
            } else if ch == '\\' {
                escaped = true;
            } else if ch == '"' {
                in_str = false;
            }
            continue;
        }
        match ch {
            '"' => in_str = true,
            '{' => depth += 1,
            '}' => {
                depth -= 1;
                if depth == 0 {
                    end = Some(i + 1);
                    break;
                }
            }
            _ => {}
        }
    }

    let end = end.ok_or_else(|| anyhow::anyhow!("unbalanced __INITIAL_STATE__"))?;
    Ok(serde_json::from_str(&rest[..end])?)
}

/// Align with the workers `xhtmlToText`: block-level tags (`</p>`, `<br…>`,
/// `</h1>`) become line breaks, all other tags are stripped, then HTML
/// entities are decoded. This preserves paragraph separation in the web
/// fallback path (chapter bodies are split by `<p>`, with no literal `\n`).
fn strip_tags(html: &str) -> String {
    let mut out = String::with_capacity(html.len());
    let mut i = 0;
    while i < html.len() {
        let byte = html.as_bytes()[i];
        if byte == b'<' {
            if let Some(rel) = html[i..].find('>') {
                let end = i + rel + 1;
                let tag = html[i..end].to_ascii_lowercase();
                let newline =
                    matches!(tag.as_str(), "</p>" | "</h1>" | "<br>" | "<br/>" | "<br />");
                if newline {
                    out.push('\n');
                }
                i = end;
                continue;
            }
            out.push('<');
            i += 1;
            continue;
        }
        if !byte.is_ascii() {
            let ch = html[i..].chars().next().unwrap();
            out.push(ch);
            i += ch.len_utf8();
            continue;
        }
        let rest = &html[i..];
        let next = rest.find('<').unwrap_or(rest.len());
        out.push_str(&rest[..next]);
        i += next;
    }

    out.replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
        .trim()
        .to_string()
}

fn pick_book_id(q: &HashMap<String, String>) -> Option<String> {
    q.get("book_id")
        .or_else(|| q.get("id"))
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .map(|s| extract_book_id(&s).unwrap_or(s))
}

fn extract_book_id(text: &str) -> Option<String> {
    let candidate = text.rsplit('/').next().unwrap_or(text).trim();
    if candidate.len() >= 15 && candidate.chars().all(|c| c.is_ascii_digit()) {
        return Some(candidate.to_string());
    }
    let digits: String = text.chars().filter(|c| c.is_ascii_digit()).collect();
    if text.contains("fanqie") && digits.len() >= 15 {
        return Some(digits);
    }
    None
}

fn is_book_id(s: &str) -> bool {
    s.len() >= 15 && s.chars().all(|c| c.is_ascii_digit())
}

fn is_path_safe(c: char) -> bool {
    !matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|')
}

fn sanitize(name: &str) -> String {
    let s: String = name
        .chars()
        .map(|c| if is_path_safe(c) { c } else { '_' })
        .collect();
    if s.trim().is_empty() {
        "novel".into()
    } else {
        s
    }
}

fn str_of(v: &Value, key: &str) -> String {
    v.get(key)
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string()
}

fn int_of(v: &Value, key: &str) -> i64 {
    v.get(key)
        .and_then(|x| {
            x.as_i64()
                .or_else(|| x.as_str().and_then(|s| s.parse().ok()))
        })
        .unwrap_or(0)
}

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn err(status: StatusCode, message: &str) -> Response {
    (
        status,
        Json(json!({ "code": status.as_u16(), "message": message })),
    )
        .into_response()
}
