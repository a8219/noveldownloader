//! Self-contained book download core (used by mobile apps via FFI).
//!
//! Independent of the axum HTTP server: it performs device registration,
//! chapter-key provisioning, signed request signing, AES-CBC decryption,
//! custom-font decoding and web fallback on its own. No external backend or
//! the deployed Cloudflare worker is required.

use std::collections::HashMap;

use serde_json::Value;

use crate::crypto::chapter::ChapterFetcher;
use crate::export::{export_txt, ChapterText};
use crate::search;

/// One chapter in a book's reading order.
#[derive(Debug, Clone, serde::Serialize)]
pub struct ChapterRef {
    pub item_id: String,
    pub title: String,
    pub order: usize,
}

/// Result of a full-book download.
#[derive(Debug, Clone)]
pub struct DownloadResult {
    pub book_name: String,
    pub chapter_count: usize,
    pub output_path: String,
}

fn http_client(cookie: Option<&str>, timeout_secs: u64) -> anyhow::Result<reqwest::Client> {
    let mut b = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(timeout_secs))
        .user_agent(
            "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) \
             Chrome/124.0 Mobile Safari/537.36",
        )
        .brotli(true)
        .gzip(true);
    if let Some(c) = cookie {
        if let Ok(val) = reqwest::header::HeaderValue::from_str(c) {
            let mut h = reqwest::header::HeaderMap::new();
            h.insert(reqwest::header::COOKIE, val);
            b = b.default_headers(h);
        }
    }
    Ok(b.build()?)
}

async fn fetch_html(
    http: &reqwest::Client,
    cookie: Option<&str>,
    url: &str,
) -> anyhow::Result<String> {
    let mut req = http.get(url).header(
        reqwest::header::USER_AGENT,
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) \
         Chrome/124.0 Mobile Safari/537.36",
    );
    if let Some(c) = cookie {
        req = req.header(reqwest::header::COOKIE, c);
    }
    let resp = req.send().await?;
    if !resp.status().is_success() {
        anyhow::bail!("{url} -> HTTP {}", resp.status());
    }
    Ok(resp.text().await?)
}

/// Extract `window.__INITIAL_STATE__` from HTML without a regex dependency.
fn extract_state(html: &str) -> anyhow::Result<Value> {
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

/// Convert block-level HTML tags to newlines, strip the rest, decode entities.
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

/// Fetch the chapter list (reading order) for a book from the public page.
pub async fn fetch_directory(
    book_id: &str,
    cookie: Option<&str>,
) -> anyhow::Result<(String, String, Vec<ChapterRef>)> {
    let http = http_client(cookie, 45)?;
    let html = fetch_html(
        &http,
        cookie,
        &format!("https://fanqienovel.com/page/{book_id}"),
    )
    .await?;
    let st = extract_state(&html)?;
    let page = st
        .pointer("/page")
        .cloned()
        .ok_or_else(|| anyhow::anyhow!("page state missing"))?;

    let book_name = page
        .get("bookName")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let author = page
        .get("author")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

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

    let chapters = ids
        .iter()
        .enumerate()
        .map(|(i, id)| ChapterRef {
            item_id: id.clone(),
            title: title_map.get(id).cloned().unwrap_or_default(),
            order: i + 1,
        })
        .collect();

    Ok((book_name, author, chapters))
}

/// Fetch a single chapter body. Tries the APP signed/decrypt path first, then
/// falls back to the public reader page (may be a preview for locked chapters).
async fn fetch_chapter(
    http: &reqwest::Client,
    cookie: Option<&str>,
    item_id: &str,
    fetcher: &mut ChapterFetcher,
) -> anyhow::Result<(String, String, String)> {
    let app_result = fetcher.get_full_chapter(item_id).await;

    if let Ok(ch) = app_result {
        if !ch.content.trim().is_empty() {
            return Ok((ch.title, ch.book_name, ch.content));
        }
    }

    let html = fetch_html(
        http,
        cookie,
        &format!("https://fanqienovel.com/reader/{item_id}"),
    )
    .await?;
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
    Ok((title, book_name, content))
}

/// Download a book (or a slice of it) and write a `.txt` file into `out_dir`.
///
/// `start`/`count` are 0-based / inclusive slice bounds into reading order;
/// `count == 0` means "all remaining from start".
pub async fn download_book(
    book_id: &str,
    out_dir: &str,
    cookie: Option<&str>,
    start: usize,
    count: usize,
) -> anyhow::Result<DownloadResult> {
    let (book_name, _author, chapters) = fetch_directory(book_id, cookie).await?;
    let total = chapters.len();
    let end = if count == 0 {
        total
    } else {
        (start + count).min(total)
    };
    let slice = &chapters[start..end];

    let http = http_client(cookie, 45)?;
    let mut fetcher = ChapterFetcher::new(http.clone());

    let mut parts: Vec<ChapterText> = Vec::with_capacity(slice.len());
    let mut book_name = book_name.clone();
    for (i, ch) in slice.iter().enumerate() {
        let fallback_title = if ch.title.is_empty() {
            format!("第 {} 章", ch.order)
        } else {
            ch.title.clone()
        };
        match fetch_chapter(&http, cookie, &ch.item_id, &mut fetcher).await {
            Ok((title, bn, content)) => {
                if !bn.is_empty() {
                    book_name = bn;
                }
                parts.push(ChapterText {
                    title: if title.is_empty() {
                        fallback_title
                    } else {
                        title
                    },
                    content,
                });
            }
            Err(e) => {
                tracing::warn!("chapter {} failed: {e}", i + 1);
                parts.push(ChapterText {
                    title: fallback_title,
                    content: "[获取失败]".to_string(),
                });
            }
        }
    }

    let bytes = export_txt(&book_name, &parts);
    std::fs::create_dir_all(out_dir)?;
    let fname = format!("{book_id}.txt");
    let path = std::path::Path::new(out_dir).join(fname);
    std::fs::write(&path, &bytes)?;

    Ok(DownloadResult {
        book_name,
        chapter_count: parts.len(),
        output_path: path.to_string_lossy().to_string(),
    })
}

/// App-facing search: proxy first, then native APP endpoint, then book-id.
pub async fn search_books(
    keyword: &str,
    proxy_api: Option<&str>,
    cookie: Option<&str>,
) -> anyhow::Result<Vec<Value>> {
    let cfg = crate::config::Config {
        bind_addr: String::new(),
        request_timeout_secs: 45,
        fanqie_cookie: cookie.map(|s| s.to_string()),
        proxy_api: proxy_api.map(|s| s.to_string()),
        tg_bot_token: None,
        admin_username: None,
        admin_password: None,
        online_read: true,
        upstream_url: None,
        base_url: None,
    };

    if let Some(proxy) = proxy_api {
        let http = http_client(cookie, 45)?;
        if let Ok(list) = search::search_via_proxy(keyword, proxy, &http).await {
            if !list.is_empty() {
                let v: Vec<Value> = list
                    .into_iter()
                    .map(|s| serde_json::to_value(s).unwrap_or(Value::Null))
                    .collect();
                return Ok(v);
            }
        }
    }

    match search::search_native(keyword, &cfg).await {
        Ok(list) if !list.is_empty() => Ok(list
            .into_iter()
            .map(|s| serde_json::to_value(s).unwrap_or(Value::Null))
            .collect()),
        _ => Ok(Vec::new()),
    }
}

/// Extract a numeric book id from a pasted URL or raw text.
pub fn extract_book_id(text: &str) -> Option<String> {
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
