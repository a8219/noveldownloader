//! Android JNI bridge.
//!
//! Kotlin side (package `com.noveldl`):
//! ```kotlin
//! class Ndl {
//!   companion object {
//!     init { System.loadLibrary("noveldownloader") }
//!     external fun nativeDownload(bookId: String, outDir: String): String
//!     external fun nativeSearch(kw: String, proxy: String?, cookie: String?): String
//!     external fun nativeExtractBookId(text: String): String
//!     external fun nativeVersion(): String
//!   }
//! }
//! ```
//! All `native*` calls are blocking (they run the download on an internal tokio
//! runtime); call them from a background thread / coroutine `Dispatchers.IO`.

use std::sync::OnceLock;

use jni::objects::{JClass, JString};
use jni::sys::jstring;
use jni::JNIEnv;

use crate::app_core;

static RT: OnceLock<tokio::runtime::Runtime> = OnceLock::new();

fn rt() -> &'static tokio::runtime::Runtime {
    RT.get_or_init(|| {
        tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .build()
            .expect("tokio runtime")
    })
}

fn to_jstring(env: &mut JNIEnv, s: &str) -> jstring {
    env.new_string(s).expect("new_string").into_raw()
}

fn jstring_to_rs(env: &mut JNIEnv, s: jstring) -> Option<String> {
    if s.is_null() {
        return None;
    }
    let js = unsafe { JString::from_raw(s) };
    let v = env.get_string(&js).ok()?;
    Some(String::from(v))
}

/// `com.noveldl.Ndl.nativeDownload(bookId, outDir): String`
#[no_mangle]
pub extern "system" fn Java_com_noveldl_Ndl_nativeDownload(
    mut env: JNIEnv,
    _class: JClass,
    book_id: jstring,
    out_dir: jstring,
) -> jstring {
    let id = jstring_to_rs(&mut env, book_id).unwrap_or_default();
    let dir = jstring_to_rs(&mut env, out_dir).unwrap_or_else(|| "./".into());

    let res = rt().block_on(app_core::download_book(&id, &dir, None, 0, 0));

    let json = match res {
        Ok(r) => serde_json::json!({
            "ok": true,
            "book_name": r.book_name,
            "chapter_count": r.chapter_count,
            "output_path": r.output_path,
        })
        .to_string(),
        Err(e) => serde_json::json!({ "ok": false, "error": e.to_string() }).to_string(),
    };

    to_jstring(&mut env, &json)
}

/// `com.noveldl.Ndl.nativeSearch(kw, proxy, cookie): String`
#[no_mangle]
pub extern "system" fn Java_com_noveldl_Ndl_nativeSearch(
    mut env: JNIEnv,
    _class: JClass,
    keyword: jstring,
    proxy: jstring,
    cookie: jstring,
) -> jstring {
    let kw = jstring_to_rs(&mut env, keyword).unwrap_or_default();
    let proxy = jstring_to_rs(&mut env, proxy).filter(|s| !s.is_empty());
    let ck = jstring_to_rs(&mut env, cookie).filter(|s| !s.is_empty());

    let res = rt().block_on(app_core::search_books(&kw, proxy.as_deref(), ck.as_deref()));

    let json = match res {
        Ok(items) => serde_json::to_string(&items).unwrap_or_else(|_| "[]".into()),
        Err(e) => serde_json::json!([ { "error": e.to_string() } ]).to_string(),
    };

    to_jstring(&mut env, &json)
}

/// `com.noveldl.Ndl.nativeExtractBookId(text): String`
#[no_mangle]
pub extern "system" fn Java_com_noveldl_Ndl_nativeExtractBookId(
    mut env: JNIEnv,
    _class: JClass,
    text: jstring,
) -> jstring {
    let t = jstring_to_rs(&mut env, text).unwrap_or_default();
    let out = app_core::extract_book_id(&t).unwrap_or_default();
    to_jstring(&mut env, &out)
}

/// `com.noveldl.Ndl.nativeVersion(): String`
#[no_mangle]
pub extern "system" fn Java_com_noveldl_Ndl_nativeVersion(
    mut env: JNIEnv,
    _class: JClass,
) -> jstring {
    to_jstring(&mut env, env!("CARGO_PKG_VERSION"))
}
