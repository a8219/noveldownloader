package com.noveldl

/** JNI bridge — loads the Rust cdylib and exposes its functions. */
class Ndl {
    companion object {
        init {
            System.loadLibrary("noveldownloader")
        }

        /**
         * Download a book (all chapters) to [outDir].
         * @return JSON: `{"ok":true,"book_name":"…","chapter_count":N,"output_path":"…"}`
         *         or `{"ok":false,"error":"…"}`
         */
        external fun nativeDownload(bookId: String, outDir: String): String

        /**
         * Search for books.
         * @return JSON array `[{…},…]` or `[]`
         */
        external fun nativeSearch(kw: String, proxy: String?, cookie: String?): String

        /**
         * Extract the numeric book ID from a pasted URL or raw text.
         * @return the id or empty string
         */
        external fun nativeExtractBookId(text: String): String

        /** Rust crate version. */
        external fun nativeVersion(): String
    }
}