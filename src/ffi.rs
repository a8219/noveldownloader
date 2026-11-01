//! C FFI layer — consumed by Android (via `System.loadLibrary`) and iOS (via
//! `dlopen`). All functions are synchronous from the caller's perspective;
//! the async download work runs on a global tokio runtime.
//!
//! ## Strings
//! All C strings returned are UTF-8, null-terminated, owned by the caller.
//! **You must free them with [`ndl_free_string`]** when done.
//!
//! ## JSON payloads
//! - `ndl_download` → `{"book_name":"…","chapter_count":N,"output_path":"…"}`
//!   or `{"error":"…"}`
//! - `ndl_search`   → `[{"book_id":"…","book_name":"…",…}, …]` or `[]`
//!
//! ## Android usage (Kotlin)
//! ```kotlin
//! System.loadLibrary("noveldownloader")
//! external fun ndlDownload(bookId: String, outDir: String, cookie: String?): String
//! external fun ndlSearch(kw: String, proxy: String?, cookie: String?): String
//! external fun ndlExtractBookId(text: String): String
//! external fun ndlFreeString(ptr: Long)
//! ```

use std::ffi::{c_char, CStr, CString};
use std::sync::OnceLock;
use tokio::runtime::Runtime;

/// Global tokio runtime (created on first call).
static RT: OnceLock<Runtime> = OnceLock::new();

fn rt() -> &'static Runtime {
    RT.get_or_init(|| {
        tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .build()
            .expect("tokio runtime")
    })
}

fn cstr_to_str<'a>(p: *const c_char) -> Option<&'a str> {
    if p.is_null() {
        return None;
    }
    unsafe { CStr::from_ptr(p) }.to_str().ok()
}

/// Convert a Rust String to a leaked C string the caller must free with
/// `ndl_free_string`.
fn to_cstring(s: &str) -> *mut c_char {
    CString::new(s.as_bytes())
        .ok()
        .map(|cs| cs.into_raw())
        .unwrap_or_else(std::ptr::null_mut)
}

/// Free a string previously returned by any `ndl_*` function.
///
/// # Safety
/// `ptr` must be a pointer returned by an `ndl_*` C string function, or null.
#[no_mangle]
pub unsafe extern "C" fn ndl_free_string(ptr: *mut c_char) {
    if !ptr.is_null() {
        let _ = CString::from_raw(ptr);
    }
}

/// Extract the numeric book id from a pasted URL or raw text.
/// Returns `""` when no valid id is found.
#[no_mangle]
pub extern "C" fn ndl_extract_book_id(text: *const c_char) -> *mut c_char {
    let Some(input) = cstr_to_str(text) else {
        return to_cstring("");
    };
    match crate::app_core::extract_book_id(input) {
        Some(id) => to_cstring(&id),
        None => to_cstring(""),
    }
}

/// Download a book (or all chapters) to a `.txt` file in `out_dir`.
///
/// `cookie` may be null (or empty) when not needed.
/// Returns JSON on success or `{"error":"…"}` on failure.
#[no_mangle]
pub extern "C" fn ndl_download(
    book_id: *const c_char,
    out_dir: *const c_char,
    cookie: *const c_char,
) -> *mut c_char {
    let id = cstr_to_str(book_id).unwrap_or("").to_string();
    let dir = cstr_to_str(out_dir).unwrap_or("./").to_string();
    let ck = cstr_to_str(cookie).filter(|s| !s.is_empty());

    let result = rt().block_on(crate::app_core::download_book(&id, &dir, ck, 0, 0));

    let json = match result {
        Ok(r) => serde_json::json!({
            "book_name": r.book_name,
            "chapter_count": r.chapter_count,
            "output_path": r.output_path,
        })
        .to_string(),
        Err(e) => serde_json::json!({ "error": e.to_string() }).to_string(),
    };

    to_cstring(&json)
}

/// Search for books. Returns a JSON array (possibly empty).
/// `proxy_api` may be null to use the native APP endpoint only.
#[no_mangle]
pub extern "C" fn ndl_search(
    keyword: *const c_char,
    proxy_api: *const c_char,
    cookie: *const c_char,
) -> *mut c_char {
    let kw = cstr_to_str(keyword).unwrap_or("").to_string();
    let proxy = cstr_to_str(proxy_api).filter(|s| !s.is_empty());
    let ck = cstr_to_str(cookie).filter(|s| !s.is_empty());

    let results = rt().block_on(crate::app_core::search_books(&kw, proxy, ck));

    let json = match results {
        Ok(items) => serde_json::to_string(&items).unwrap_or_else(|_| "[]".into()),
        Err(_) => "[]".into(),
    };

    to_cstring(&json)
}
