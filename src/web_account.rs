//! Web account (TG-shared) + reading history.
//!
//! - Accounts live in `users.json` (same shape as the Worker KV `users` record),
//!   keyed by chat_id, with `account` + `pwd_hash` (SHA-256 hex of password).
//! - Tokens are random 24-byte hex, kept in memory with 30-day expiry.
//! - History: `history:<account>` → { book_id: {book_name,item_id,chapter_title,ts,source} }
//!   persisted to `history.json`.
//!
//! Both files are optional; if missing the store starts empty.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::RwLock;

pub const USERS_FILE: &str = "users.json";
pub const HISTORY_FILE: &str = "history.json";
const TOKEN_TTL_MS: i64 = 30 * 24 * 3600 * 1000;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UserRecord {
    #[serde(default)]
    pub account: String,
    #[serde(default)]
    pub pwd_hash: String,
    #[serde(default)]
    pub banned: bool,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct HistEntry {
    #[serde(default)]
    pub book_name: String,
    #[serde(default)]
    pub item_id: String,
    #[serde(default)]
    pub chapter_title: String,
    #[serde(default)]
    pub ts: i64,
    #[serde(default)]
    pub source: String,
}

type Users = HashMap<String, UserRecord>;
type HistoryMap = HashMap<String, HistEntry>;

#[derive(Debug, Clone)]
struct Session {
    account: String,
    created_at: i64,
}

pub struct WebAccountStore {
    root: PathBuf,
    users: Arc<RwLock<Users>>,
    history: Arc<RwLock<HashMap<String, HistoryMap>>>,
    sessions: Arc<RwLock<HashMap<String, Session>>>,
    fails: Arc<RwLock<HashMap<String, FailRec>>>,
}

#[derive(Debug, Clone, Copy)]
struct FailRec {
    n: u32,
    first: i64,
    locked_until: i64,
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

pub fn hash_pw(pw: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut h = Sha256::new();
    h.update(pw.as_bytes());
    h.finalize()
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect::<String>()
}

fn random_token() -> String {
    use rand::RngCore;
    let mut buf = [0u8; 24];
    rand::thread_rng().fill_bytes(&mut buf);
    buf.iter().map(|b| format!("{:02x}", b)).collect()
}

impl WebAccountStore {
    pub fn new(root: impl AsRef<Path>) -> Self {
        let root = root.as_ref().to_path_buf();
        let users: Users = std::fs::read_to_string(root.join(USERS_FILE))
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();
        let history: HashMap<String, HistoryMap> =
            std::fs::read_to_string(root.join(HISTORY_FILE))
                .ok()
                .and_then(|s| serde_json::from_str(&s).ok())
                .unwrap_or_default();
        Self {
            root,
            users: Arc::new(RwLock::new(users)),
            history: Arc::new(RwLock::new(history)),
            sessions: Arc::new(RwLock::new(HashMap::new())),
            fails: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Persist users to disk. Kept for future write paths (e.g. web-side signup).
    #[allow(dead_code)]
    fn save_users(&self, users: &Users) {
        if let Ok(s) = serde_json::to_string_pretty(users) {
            let _ = std::fs::write(self.root.join(USERS_FILE), s);
        }
    }

    fn save_history(&self, h: &HashMap<String, HistoryMap>) {
        if let Ok(s) = serde_json::to_string_pretty(h) {
            let _ = std::fs::write(self.root.join(HISTORY_FILE), s);
        }
    }

    /// Login: returns token on success.
    /// `admin` credentials are checked by caller (env vars), this only handles user records.
    pub async fn login(&self, account: &str, password: &str) -> Result<String, String> {
        // rate limit: 5 fails / 10min -> 15min lock
        {
            let fails = self.fails.read().await;
            if let Some(rec) = fails.get(account) {
                if rec.locked_until > now_ms() {
                    let mins = (rec.locked_until - now_ms()) / 60000 + 1;
                    return Err(format!("尝试次数过多，请 {} 分钟后再试", mins));
                }
            }
        }
        let users = self.users.read().await;
        let found = users
            .values()
            .find(|u| u.account.eq_ignore_ascii_case(account))
            .cloned();
        drop(users);

        let ok = match &found {
            Some(u) if !u.banned => {
                let h = hash_pw(password);
                !u.pwd_hash.is_empty() && u.pwd_hash == h
            }
            _ => false,
        };

        if ok {
            let mut fails = self.fails.write().await;
            fails.remove(account);
            drop(fails);
            let tok = random_token();
            let mut sess = self.sessions.write().await;
            sess.insert(
                tok.clone(),
                Session {
                    account: found.unwrap().account,
                    created_at: now_ms(),
                },
            );
            Ok(tok)
        } else {
            let mut fails = self.fails.write().await;
            let rec = fails.entry(account.to_string()).or_insert(FailRec {
                n: 0,
                first: now_ms(),
                locked_until: 0,
            });
            if now_ms() - rec.first > 10 * 60 * 1000 {
                rec.n = 1;
                rec.first = now_ms();
            } else {
                rec.n += 1;
            }
            if rec.n >= 5 {
                rec.locked_until = now_ms() + 15 * 60 * 1000;
                rec.n = 0;
                rec.first = 0;
            }
            Err("账号或密码错误".into())
        }
    }

    /// Accept an explicitly-issued token (used for admin logins).
    pub async fn issue_token(&self, account: &str) -> String {
        let tok = random_token();
        let mut sess = self.sessions.write().await;
        sess.insert(
            tok.clone(),
            Session {
                account: account.to_string(),
                created_at: now_ms(),
            },
        );
        tok
    }

    /// Resolve token → account (empty when invalid/expired).
    pub async fn account_of(&self, token: &str) -> String {
        if token.is_empty() {
            return String::new();
        }
        let sess = self.sessions.read().await;
        match sess.get(token) {
            Some(s) if now_ms() - s.created_at < TOKEN_TTL_MS => s.account.clone(),
            _ => String::new(),
        }
    }

    pub async fn history_list(&self, account: &str) -> Vec<serde_json::Value> {
        let guard = self.history.read().await;
        let mut out: Vec<serde_json::Value> = guard
            .get(account)
            .map(|m| {
                m.iter()
                    .map(|(k, v)| {
                        serde_json::json!({
                            "book_id": k,
                            "book_name": v.book_name,
                            "item_id": v.item_id,
                            "chapter_title": v.chapter_title,
                            "ts": v.ts,
                            "source": v.source,
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();
        out.sort_by_key(|v| -v.get("ts").and_then(|t| t.as_i64()).unwrap_or(0));
        out
    }

    pub async fn history_put(
        &self,
        account: &str,
        book_id: &str,
        book_name: &str,
        item_id: &str,
        chapter_title: &str,
        source: &str,
    ) {
        {
            let mut guard = self.history.write().await;
            let m = guard.entry(account.to_string()).or_default();
            // cap per-account history to 200 books (LRU-ish by ts)
            if m.len() >= 200 && !m.contains_key(book_id) {
                if let Some(oldest) = m.iter().min_by_key(|(_, v)| v.ts).map(|(k, _)| k.clone()) {
                    m.remove(&oldest);
                }
            }
            m.insert(
                book_id.to_string(),
                HistEntry {
                    book_name: book_name.to_string(),
                    item_id: item_id.to_string(),
                    chapter_title: chapter_title.to_string(),
                    ts: now_ms(),
                    source: source.to_string(),
                },
            );
            let snapshot = guard.clone();
            self.save_history(&snapshot);
        }
    }

    /// Reload users from disk (so TG `/signup` writes are picked up).
    pub async fn reload_users(&self) {
        if let Ok(s) = std::fs::read_to_string(self.root.join(USERS_FILE)) {
            if let Ok(u) = serde_json::from_str::<Users>(&s) {
                *self.users.write().await = u;
            }
        }
    }
}