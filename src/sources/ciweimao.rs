//! 刺猬猫（`www.ciweimao.com`，欢乐书客系）书源。
//!
//! 只支持**免费公开章节**。正文接口为双层 AES-256-CBC 加密：
//!
//! - 先 `GET /chapter/ajax_get_session_code?chapter_id=<id>` 拿 `chapter_access_key`
//! - 再 `POST /chapter/get_book_chapter_detail_info`（form: `chapter_id` + `chapter_access_key`），
//!   返回 `{ code:100000, encryt_keys: [...], chapter_content: <base64> }`
//! - 解密：`iv = 密文前 16 字节`；key 从 `encryt_keys` 按 `accessKey` 字符选出两个：
//!   `keys[尾字符码 % len]` 与 `keys[首字符码 % len]`；第一层解密输出是 base64 文本，
//!   剥空白后再 base64 解码作为第二层输入；第二层输出即正文 HTML。
//!
//! 会话要求 `ci_session` cookie（`GET /` 建立）。风控敏感，批量抓取由上层限流。
//!
//! 付费/需登录章节：上游返回 `code != 100000`（如 `400001 此章节可能已删除`）或正文为空，
//! 统一按 `paid: true` 返回，**不做任何绕过**。

use aes::cipher::{block_padding::Pkcs7, BlockDecryptMut, KeyIvInit};
use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine as _;
use serde_json::Value;

use crate::sources::{paragraphs, urlencode, Fetched, DESKTOP_UA};

const BASE: &str = "https://www.ciweimao.com";

type Aes256CbcDec = cbc::Decryptor<aes::Aes256>;

/// 双层 AES-256-CBC 解密。
fn ciw_decrypt(content: &str, keys: &[String], access_key: &str) -> anyhow::Result<String> {
    if keys.is_empty() || access_key.is_empty() {
        anyhow::bail!("ciweimao: empty keys or access_key");
    }
    let chars: Vec<char> = access_key.chars().collect();
    let t = keys.len();
    // 与前端 myEncrytExtend 完全一致：尾字符选第 1 个 key，首字符选第 2 个 key
    let key_idx = [chars[chars.len() - 1] as usize % t, chars[0] as usize % t];

    // 第一层输入：完整密文
    let mut n = B64.decode(content.trim())?;

    for (i, &ki) in key_idx.iter().enumerate() {
        // key: base64 解码
        let key = B64.decode(keys[ki].as_bytes())?;
        if key.len() != 32 {
            anyhow::bail!("ciweimao: bad key len {}", key.len());
        }
        // iv: 当前密文前 16 字节
        if n.len() < 16 || (n.len() - 16) % 16 != 0 {
            anyhow::bail!("ciweimao: bad ciphertext len {}", n.len());
        }
        let iv: [u8; 16] = n[..16].try_into().unwrap();
        let body = &n[16..];

        let mut buf = body.to_vec();
        let pt = Aes256CbcDec::new_from_slices(&key, &iv)?
            .decrypt_padded_mut::<Pkcs7>(&mut buf)
            .map_err(|_| anyhow::anyhow!("ciweimao: aes decrypt padding error"))?;

        if i < key_idx.len() - 1 {
            // 第一层输出是 base64 文本 → 再次 base64 解码作为第二层输入
            let s = String::from_utf8_lossy(pt).trim().to_string();
            n = B64.decode(s.as_bytes())?;
        } else {
            n = pt.to_vec();
        }
    }

    Ok(String::from_utf8_lossy(&n).into_owned())
}

/// 建立会话，返回 `ci_session` cookie 值。
async fn session(http: &reqwest::Client) -> anyhow::Result<String> {
    let resp = http
        .get(format!("{BASE}/"))
        .header(reqwest::header::USER_AGENT, DESKTOP_UA)
        .send()
        .await?;
    let sc = resp
        .headers()
        .get_all(reqwest::header::SET_COOKIE)
        .iter()
        .filter_map(|v| v.to_str().ok())
        .find(|s| s.starts_with("ci_session="))
        .map(|s| s.trim_start_matches("ci_session=").split(';').next().unwrap_or("").to_string())
        .unwrap_or_default();
    Ok(sc)
}

fn headers(cookie: &str, referer: &str, xhr: bool) -> reqwest::header::HeaderMap {
    let mut h = reqwest::header::HeaderMap::new();
    h.insert(reqwest::header::USER_AGENT, DESKTOP_UA.parse().unwrap());
    h.insert(
        reqwest::header::ACCEPT,
        if xhr {
            "application/json, text/javascript, */*; q=0.01".parse().unwrap()
        } else {
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8".parse().unwrap()
        },
    );
    if !cookie.is_empty() {
        h.insert(reqwest::header::COOKIE, format!("ci_session={cookie}").parse().unwrap());
    }
    if !referer.is_empty() {
        h.insert(reqwest::header::REFERER, referer.parse().unwrap());
    }
    if xhr {
        h.insert(
            reqwest::header::ORIGIN,
            BASE.parse().unwrap(),
        );
    }
    h
}

/// 搜索：站内搜索接口需要登录态（`get-search-book-list` 返回 404），返回空列表，
/// 由上层提示用户粘贴书籍链接/ID。
pub async fn search(_http: &reqwest::Client, _keyword: &str) -> anyhow::Result<Vec<Value>> {
    Ok(Vec::new())
}

/// 目录。从书页拿书名/作者，从 chapter-list 页解析章节。
pub async fn directory(
    http: &reqwest::Client,
    book_id: &str,
) -> anyhow::Result<(String, String, Vec<Value>)> {
    let cookie = session(http).await.unwrap_or_default();
    let book_url = format!("{BASE}/book/{book_id}");

    // 书页 → 书名/作者
    let resp = http
        .get(&book_url)
        .headers(headers(&cookie, &format!("{BASE}/"), false))
        .send()
        .await?;
    if !resp.status().is_success() {
        anyhow::bail!("ciweimao book HTTP {}", resp.status());
    }
    let html = resp.text().await?;
    let mut book_name = String::new();
    // 书页 <h1> 是书名
    if let Some(h1) = crate::sources::between(&html, "<h1", "</h1>") {
        if let Some(gt) = h1.find('>') {
            book_name = crate::sources::strip_html(&h1[gt + 1..]).trim().to_string();
        }
    }
    if book_name.is_empty() {
        if let Some(t) = crate::sources::between(&html, "<title>", "</title>") {
            book_name = t.split("最新章节").next().unwrap_or(t).trim().to_string();
        }
    }
    let author = crate::sources::between(&html, "作者：", "<")
        .map(|s| s.trim().to_string())
        .unwrap_or_default();

    // chapter-list 页 → 章节
    let list_url = format!("{BASE}/chapter-list/{book_id}/book_detail");
    let lresp = http
        .get(&list_url)
        .headers(headers(&cookie, &book_url, false))
        .send()
        .await?;
    if !lresp.status().is_success() {
        anyhow::bail!("ciweimao chapter-list HTTP {}", lresp.status());
    }
    let lhtml = lresp.text().await?;

    let mut lists = Vec::new();
    let mut idx = 0usize;
    let needle = "https://www.ciweimao.com/chapter/";
    while let Some(rel) = lhtml[idx..].find(needle) {
        let s = idx + rel;
        let id_start = s + needle.len();
        let id_end = lhtml[id_start..]
            .find(|c: char| !c.is_ascii_digit())
            .map(|p| id_start + p)
            .unwrap_or(lhtml.len());
        let id = &lhtml[id_start..id_end];
        if !id.is_empty() {
            // 标题：链接标签后第一个文本
            let title = crate::sources::between(&lhtml[id_end..], ">", "<")
                .map(|t| t.trim().to_string())
                .unwrap_or_default();
            lists.push(serde_json::json!({
                "item_id": id,
                "title": title,
                "order": lists.len() + 1,
                "is_vip": false,
            }));
        }
        idx = id_end.max(s + 1);
    }

    if lists.is_empty() {
        anyhow::bail!("ciweimao directory: no chapters");
    }
    if book_name.is_empty() {
        book_name = format!("ciweimao_{book_id}");
    }
    Ok((book_name, author, lists))
}

/// 单章正文（带 book_id 用于 Referer）。
pub async fn chapter_with_book(
    http: &reqwest::Client,
    book_id: &str,
    chapter_id: &str,
    fallback_title: &str,
) -> anyhow::Result<Fetched> {
    if chapter_id.is_empty() {
        anyhow::bail!("ciweimao chapter_id is empty");
    }
    let cookie = session(http).await.unwrap_or_default();
    let chapter_url = format!("{BASE}/chapter/{chapter_id}");

    // 1) 会话码
    let sess_url = format!(
        "{BASE}/chapter/ajax_get_session_code?chapter_id={}",
        urlencode(chapter_id)
    );
    let sresp = http
        .get(&sess_url)
        .headers(headers(&cookie, &chapter_url, true))
        .send()
        .await?;
    if !sresp.status().is_success() {
        anyhow::bail!("ciweimao session HTTP {}", sresp.status());
    }
    let sv: Value = sresp.json().await?;
    let key = sv
        .get("chapter_access_key")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string();
    if sv.get("code").and_then(|x| x.as_i64()) != Some(100000) || key.is_empty() {
        anyhow::bail!("ciweimao session: no access key");
    }

    // 2) 加密正文
    let form = format!(
        "chapter_id={}&chapter_access_key={}",
        urlencode(chapter_id),
        urlencode(&key)
    );
    let cresp = http
        .post(format!("{BASE}/chapter/get_book_chapter_detail_info"))
        .headers(headers(&cookie, &chapter_url, true))
        .header(
            reqwest::header::CONTENT_TYPE,
            "application/x-www-form-urlencoded",
        )
        .body(form)
        .send()
        .await?;
    if !cresp.status().is_success() {
        anyhow::bail!("ciweimao content HTTP {}", cresp.status());
    }
    let cv: Value = cresp.json().await?;

    if cv.get("code").and_then(|x| x.as_i64()) != Some(100000) {
        let tip = cv
            .get("tip")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string();
        let paid = tip.contains("删除") || tip.contains("权限") || tip.contains("付费") || tip.contains("订阅");
        return Ok(Fetched {
            title: fallback_title.to_string(),
            book_name: String::new(),
            author: String::new(),
            content: String::new(),
            paid,
        });
    }

    // 3) 双层解密
    let content_b64 = cv
        .get("chapter_content")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string();
    let keys: Vec<String> = cv
        .get("encryt_keys")
        .and_then(|x| x.as_array())
        .map(|a| {
            a.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();

    let html = ciw_decrypt(&content_b64, &keys, &key).unwrap_or_default();
    let content = if html.contains("<p") {
        paragraphs(&html).join("\n\n")
    } else {
        crate::sources::strip_html(&html)
    };

    // 标题：从章节页 HTML 兜底
    let mut title = fallback_title.to_string();
    let mut book_name = String::new();
    if let Ok(tr) = http
        .get(&chapter_url)
        .headers(headers(&cookie, &format!("{BASE}/"), false))
        .send()
        .await
    {
        if let Ok(th) = tr.text().await {
            if let Some(t) = crate::sources::between(&th, "<title>", "</title>") {
                let parts: Vec<&str> = t.split(" - ").collect();
                if parts.len() >= 3 {
                    title = parts[0].trim().to_string();
                    book_name = parts[1].trim().to_string();
                }
            }
            if book_name.is_empty() {
                if let Some(h) = crate::sources::between(&th, "<h1", ">") {
                    let _ = h;
                }
            }
        }
    }

    Ok(Fetched {
        title,
        book_name,
        author: String::new(),
        content,
        paid: content.trim().is_empty(),
    })
}

/// 单章正文（目录标题兜底为空时使用）。
pub async fn chapter(http: &reqwest::Client, chapter_id: &str) -> anyhow::Result<Fetched> {
    chapter_with_book(http, "", chapter_id, "").await
}

/// 探针。
pub async fn probe(http: &reqwest::Client) -> Value {
    let mut out = serde_json::Map::new();

    let dir = match directory(http, "100119445").await {
        Ok((name, author, lists)) => serde_json::json!({
            "ok": !lists.is_empty(),
            "n": lists.len(),
            "book_name": name,
            "author": author
        }),
        Err(e) => serde_json::json!({ "ok": false, "error": e.to_string() }),
    };
    out.insert("directory".into(), dir);

    let ch = match chapter_with_book(http, "100119445", "103464461", "").await {
        Ok(ch) => serde_json::json!({
            "ok": !ch.content.is_empty(),
            "chars": ch.content.chars().count(),
            "paid": ch.paid,
            "title": ch.title
        }),
        Err(e) => serde_json::json!({ "ok": false, "error": e.to_string() }),
    };
    out.insert("chapter".into(), ch);

    Value::Object(out)
}