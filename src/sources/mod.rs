//! 多书源支持。
//!
//! | source   | 站点       | 支持范围                                   |
//! |----------|------------|--------------------------------------------|
//! | `fanqie` | 番茄小说   | 免费 + 已配置 `FANQIE_COOKIE` 可解锁的内容  |
//! | `qimao`  | 七猫中文网 | 全书免费（广告变现），无付费墙              |
//!
//! 起点 / QQ阅读的 VIP 章节由付费墙与 DRM 保护，本项目**不提供**任何绕过能力，
//! 因此未接入那两个源；需要时请使用官方客户端阅读。
//!
//! # 付费章节处理（统一策略）
//!
//! 若某章被上游标记为付费（七猫的 `is_vip != "0"`，或番茄返回空正文且标记锁定），
//! 抓取结果返回 `paid: true`、`content` 为空，批量导出时写入 [`PAID_NOTICE`]。
//! 任何书源都不做绕过尝试。

pub mod qimao;

use serde_json::{json, Value};

use crate::export::ChapterText;
use crate::server::AppState;

/// 付费章节统一提示文案。
pub const PAID_NOTICE: &str = "（付费章节 — 本项目仅支持免费内容，不提供付费章节下载）";

/// 书源标识。`fanqie` 为默认值，保持旧接口向后兼容。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SourceKind {
    Fanqie,
    Qimao,
}

impl SourceKind {
    /// 宽松解析：接受 `qimao` / `qm` / `七猫` 等写法，无法识别时回落到番茄。
    pub fn parse(raw: Option<&str>) -> Self {
        match raw.unwrap_or("").trim().to_ascii_lowercase().as_str() {
            "qimao" | "qm" | "七猫" => Self::Qimao,
            _ => Self::Fanqie,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Fanqie => "fanqie",
            Self::Qimao => "qimao",
        }
    }

    pub fn is_fanqie(self) -> bool {
        matches!(self, Self::Fanqie)
    }
}

/// 单章抓取结果。
#[derive(Debug, Clone)]
pub struct Fetched {
    pub title: String,
    pub book_name: String,
    /// 作者（部分源的单章接口会返回，用于补全目录元数据）
    pub author: String,
    pub content: String,
    /// 是否付费章节（为真时 `content` 通常为空）
    pub paid: bool,
}

/// 按书源抓取书籍目录（非番茄源）。
///
/// 返回 `(book_name, author, chapters)`，`chapters` 元素形如
/// `{"item_id","title","order"}`，与番茄源输出结构一致，便于上层复用。
pub async fn directory(
    state: &AppState,
    source: SourceKind,
    book_id: &str,
) -> anyhow::Result<(String, String, Vec<Value>)> {
    match source {
        SourceKind::Qimao => qimao::directory(&state.http, book_id).await,
        SourceKind::Fanqie => anyhow::bail!("fanqie 请走 crate::api::handlers 内部实现"),
    }
}

/// 抓取单章（非番茄源）。
///
/// `book_id` 用于七猫拼 Referer（缺省时可传空串）。
pub async fn chapter(
    state: &AppState,
    source: SourceKind,
    book_id: &str,
    item_id: &str,
    fallback_title: &str,
) -> anyhow::Result<Fetched> {
    match source {
        SourceKind::Qimao => {
            qimao::chapter_with_book(&state.http, book_id, item_id, fallback_title).await
        }
        SourceKind::Fanqie => anyhow::bail!("fanqie 请走 crate::api::handlers 内部实现"),
    }
}

/// 按书源分批抓取正文，失败章节填占位文本（与番茄源行为一致）。
pub async fn collect(
    state: &AppState,
    source: SourceKind,
    book_id: &str,
    lists: &[Value],
) -> Vec<ChapterText> {
    let mut out = Vec::with_capacity(lists.len());
    for (i, item) in lists.iter().enumerate() {
        let item_id = item
            .get("item_id")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();
        if item_id.is_empty() {
            continue;
        }
        let fallback_title = item
            .get("title")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .unwrap_or_else(|| format!("第 {} 章", i + 1));

        match chapter(state, source, book_id, &item_id, &fallback_title).await {
            Ok(ch) => {
                let title = if ch.title.is_empty() {
                    fallback_title
                } else {
                    ch.title
                };
                let content = if ch.paid && ch.content.trim().is_empty() {
                    PAID_NOTICE.to_string()
                } else {
                    ch.content
                };
                out.push(ChapterText { title, content });
            }
            Err(e) => {
                tracing::warn!("{} chapter {} failed: {e}", source.as_str(), item_id);
                out.push(ChapterText {
                    title: fallback_title,
                    content: "[获取失败]".to_string(),
                });
            }
        }
    }
    out
}

/// 各书源能力声明（不触发网络请求）。
pub fn caps() -> Value {
    json!({
        "fanqie": { "free": true, "paid": "cookie", "enabled": true },
        "qimao":  { "free": true, "paid": false,    "enabled": true },
        "qidian": { "free": false, "paid": false,   "enabled": false,
                    "note": "VIP 章节受 DRM/付费墙保护，不提供绕过" },
        "qqread": { "free": false, "paid": false,   "enabled": false,
                    "note": "VIP 章节受 DRM/付费墙保护，不提供绕过" },
    })
}

// ---------------- 共享 HTML 工具 ----------------

/// 取 `start` 与最近的 `end` 之间的子串。
pub fn between<'a>(hay: &'a str, start: &str, end: &str) -> Option<&'a str> {
    let s = hay.find(start)? + start.len();
    let tail = &hay[s..];
    let e = tail.find(end)?;
    Some(&tail[..e])
}

/// 剥离所有标签 + 解码常见实体 + 压缩空白。
pub fn strip_html(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    let mut in_tag = false;
    for ch in raw.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            c if !in_tag => out.push(c),
            _ => {}
        }
    }
    let text = out
        .replace(concat!("\u{26}", "nbsp;"), " ")
        .replace(concat!("\u{26}", "amp;"), "\u{26}")
        .replace(concat!("\u{26}", "lt;"), "<")
        .replace(concat!("\u{26}", "gt;"), ">")
        .replace(concat!("\u{26}", "quot;"), "\u{22}")
        .replace(concat!("\u{26}", "apos;"), "\u{27}")
        .replace(concat!("\u{26}", "#39;"), "\u{27}");
    text.split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string()
}

/// 从 `<p>…</p>` 里按段落抽正文，保留段落换行。
pub fn paragraphs(raw_html: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut idx = 0usize;
    while idx < raw_html.len() {
        let Some(rel) = raw_html[idx..].find("<p") else {
            break;
        };
        let s = idx + rel;
        let Some(gt) = raw_html[s..].find('>') else {
            break;
        };
        let body_start = s + gt + 1;
        let Some(close) = raw_html[body_start..].find("</p>") else {
            break;
        };
        let text = strip_html(&raw_html[body_start..body_start + close]);
        if !text.is_empty() {
            out.push(text);
        }
        idx = body_start + close + 4;
    }
    out
}

/// 简易 URL 编码（避免额外依赖）。
pub fn urlencode(input: &str) -> String {
    let mut out = String::with_capacity(input.len() * 3);
    for b in input.as_bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(*b as char)
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

/// 桌面 UA —— 第三方站点的 SSR 页面在桌面 UA 下结构更稳定。
pub const DESKTOP_UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) \
     AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";