//! 七猫中文网书源。
//!
//! 七猫是**免费阅读站**（广告变现，全书免费），不存在付费墙。本模块只抓取
//! 公开可访问的内容；若接口返回的 `is_vip != "0"`（极少数版权受限作品），
//! 则按统一策略返回 `paid: true`，正文留空 —— 不做任何绕过尝试。
//!
//! # 已验证的公开接口
//!
//! | 用途 | 端点 | 方法 |
//! |---|---|---|
//! | 搜索 | `/api/search/result?keyword=<kw>` | GET |
//! | 目录 | `/api/book/chapter-list?book_id=<id>` | GET |
//! | 正文 | `/api/book/chapter` + form `book_id`,`chapter_id` | POST |
//!
//! 三者都要求桌面 UA 与 `Referer: https://www.qimao.com/shuku/<book_id>/`，
//! 否则部分接口返回 404。

use serde_json::Value;

use crate::sources::{paragraphs, urlencode, Fetched, DESKTOP_UA};

const BASE: &str = "https://www.qimao.com";

fn referer(book_id: &str) -> String {
    format!("{BASE}/shuku/{book_id}/")
}

/// 搜索。返回 `(book_id, title, author, intro, cover, status)` 结构化的 JSON 数组。
pub async fn search(http: &reqwest::Client, keyword: &str) -> anyhow::Result<Vec<Value>> {
    let url = format!("{BASE}/api/search/result?keyword={}", urlencode(keyword));
    let resp = http
        .get(&url)
        .header(reqwest::header::USER_AGENT, DESKTOP_UA)
        .header(reqwest::header::ACCEPT, "application/json")
        .header(reqwest::header::REFERER, format!("{BASE}/"))
        .send()
        .await?;

    if !resp.status().is_success() {
        anyhow::bail!("qimao search HTTP {}", resp.status());
    }
    let v: Value = resp.json().await?;

    let list = v
        .pointer("/data/search_list")
        .and_then(|x| x.as_array())
        .cloned()
        .unwrap_or_default();

    let mut out = Vec::with_capacity(list.len());
    for item in list {
        let Some(book_id) = item.get("book_id").and_then(|x| x.as_str()) else {
            continue;
        };
        if book_id.is_empty() {
            continue;
        }
        out.push(serde_json::json!({
            "book_id": book_id,
            "book_name": item.get("title").and_then(|x| x.as_str()).unwrap_or(""),
            "author": item.get("author").and_then(|x| x.as_str()).unwrap_or(""),
            "book_abstract": item.get("intro").and_then(|x| x.as_str()).unwrap_or(""),
            "thumb_url": item.get("image_link").and_then(|x| x.as_str()).unwrap_or(""),
            "creation_status": item.get("status").and_then(|x| x.as_str()).unwrap_or(""),
            "source": "qimao",
        }));
    }
    Ok(out)
}

/// 目录。返回 `(book_name, author, chapters)`，章节元素与番茄源同构。
pub async fn directory(
    http: &reqwest::Client,
    book_id: &str,
) -> anyhow::Result<(String, String, Vec<Value>)> {
    // 书名 / 作者优先从第一章的正文接口拿（`/api/book/chapter` 返回
    // `book_title` + `author`，与目录接口同域同风控，稳定可用）；
    // 书页 `/shuku/` 对 rustls 有 TLS 指纹要求，仅作增强尝试，失败静默。
    let mut book_name = String::new();
    let mut author = String::new();

    // 目录
    let url = format!("{BASE}/api/book/chapter-list?book_id={}", urlencode(book_id));
    let resp = http
        .get(&url)
        .header(reqwest::header::USER_AGENT, DESKTOP_UA)
        .header(reqwest::header::ACCEPT, "application/json")
        .header(reqwest::header::REFERER, referer(book_id))
        .send()
        .await?;

    if !resp.status().is_success() {
        anyhow::bail!("qimao chapter-list HTTP {}", resp.status());
    }
    let v: Value = resp.json().await?;

    let arr = v
        .pointer("/data/chapters")
        .and_then(|x| x.as_array())
        .cloned()
        .unwrap_or_default();

    let mut lists = Vec::with_capacity(arr.len());
    for (i, c) in arr.iter().enumerate() {
        let Some(id) = c.get("id").and_then(|x| x.as_str()) else {
            continue;
        };
        lists.push(serde_json::json!({
            "item_id": id,
            "title": c.get("title").and_then(|x| x.as_str()).unwrap_or(""),
            "order": i + 1,
            // 目录接口已带 is_vip，前端可提前标注
            "is_vip": c.get("is_vip").and_then(|x| x.as_str()).unwrap_or("0") != "0",
        }));
    }

    // 用第一章正文接口补书名/作者（该接口同时返回 book_title + author）
    if let Some(first) = arr.first() {
        if let Some(cid) = first.get("id").and_then(|x| x.as_str()) {
            if let Ok(ch) = chapter_with_book(http, book_id, cid, "").await {
                book_name = ch.book_name;
                author = ch.author;
            }
        }
    }

    if book_name.is_empty() {
        book_name = format!("qimao_{book_id}");
    }

    Ok((book_name, author, lists))
}

/// 单章正文。`chapter_id` 为目录里的 `id`。
///
/// 需要 `book_id` 才能拼 Referer，这里从参数里拿不到 —— 因此由调用方
/// 通过 [`chapter_with_book`] 传 book_id；本函数用空 Referer 兜底。
pub async fn chapter(http: &reqwest::Client, chapter_id: &str) -> anyhow::Result<Fetched> {
    chapter_with_book(http, "", chapter_id, "").await
}

/// 带 book_id / 标题提示的单章抓取。
pub async fn chapter_with_book(
    http: &reqwest::Client,
    book_id: &str,
    chapter_id: &str,
    fallback_title: &str,
) -> anyhow::Result<Fetched> {
    if chapter_id.is_empty() {
        anyhow::bail!("qimao chapter_id is empty");
    }

    let url = format!("{BASE}/api/book/chapter");
    let form = if book_id.is_empty() {
        format!("chapter_id={}", urlencode(chapter_id))
    } else {
        format!(
            "book_id={}&chapter_id={}",
            urlencode(book_id),
            urlencode(chapter_id)
        )
    };

    let ref_url = if book_id.is_empty() {
        format!("{BASE}/")
    } else {
        referer(book_id)
    };

    let resp = http
        .post(&url)
        .header(reqwest::header::USER_AGENT, DESKTOP_UA)
        .header(reqwest::header::ACCEPT, "application/json")
        .header(reqwest::header::REFERER, ref_url)
        .header(reqwest::header::ORIGIN, BASE)
        .header(
            reqwest::header::CONTENT_TYPE,
            "application/x-www-form-urlencoded",
        )
        .body(form)
        .send()
        .await?;

    if !resp.status().is_success() {
        anyhow::bail!("qimao chapter HTTP {}", resp.status());
    }
    let v: Value = resp.json().await?;

    let ch = v.pointer("/data/chapter").cloned().unwrap_or(Value::Null);
    let title = ch
        .get("title")
        .and_then(|x| x.as_str())
        .filter(|s| !s.is_empty())
        .unwrap_or(fallback_title)
        .to_string();
    let book_title = ch
        .get("book_title")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string();

    // 付费 / 版权受限章节：不做任何绕过，直接标记。
    let is_vip = ch
        .get("is_vip")
        .and_then(|x| x.as_str())
        .map(|s| s != "0")
        .unwrap_or(false);

    let author = ch
        .get("author")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string();

    let raw = v
        .pointer("/data/content")
        .and_then(|x| x.as_str())
        .unwrap_or("");

    if is_vip && raw.trim().is_empty() {
        return Ok(Fetched {
            title,
            book_name: book_title,
            author,
            content: String::new(),
            paid: true,
        });
    }

    let content = if raw.contains("<p") {
        paragraphs(raw).join("\n\n")
    } else {
        crate::sources::strip_html(raw)
    };

    Ok(Fetched {
        title,
        book_name: book_title,
        author,
        content,
        paid: is_vip,
    })
}

/// 探针：验证三个接口是否可用（供 `/api/caps?probe=1` 使用）。
pub async fn probe(http: &reqwest::Client) -> Value {
    let mut out = serde_json::Map::new();

    // 搜索
    let search_ok = match search(http, "斗破苍穹").await {
        Ok(list) => serde_json::json!({ "ok": !list.is_empty(), "n": list.len() }),
        Err(e) => serde_json::json!({ "ok": false, "error": e.to_string() }),
    };
    out.insert("search".into(), search_ok);

    // 目录
    let dir_ok = match directory(http, "1655407").await {
        Ok((name, author, lists)) => serde_json::json!({
            "ok": !lists.is_empty(),
            "n": lists.len(),
            "book_name": name,
            "author": author
        }),
        Err(e) => serde_json::json!({ "ok": false, "error": e.to_string() }),
    };
    out.insert("directory".into(), dir_ok);

    // 正文
    let ch_ok = match chapter_with_book(http, "1655407", "16576785560001", "").await {
        Ok(ch) => serde_json::json!({
            "ok": !ch.content.is_empty(),
            "chars": ch.content.chars().count(),
            "paid": ch.paid,
            "title": ch.title
        }),
        Err(e) => serde_json::json!({ "ok": false, "error": e.to_string() }),
    };
    out.insert("chapter".into(), ch_ok);

    Value::Object(out)
}