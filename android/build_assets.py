"""Build the offline Android assets from the same reader/Worker source as production."""
import importlib.util
import re
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[1]          # repo root
ANDROID = Path(__file__).resolve().parent
OUT = ANDROID / "build" / "assets"

APP_SEARCH_HELPER = '''
async function __localSearchBooks(keyword, pageIndex, pageCount) {
  const query = {
    query: String(keyword || "").trim(),
    page_index: Math.max(0, Number(pageIndex) || 0),
    page_count: Math.max(1, Math.min(20, Number(pageCount) || 10)),
  };
  if (!query.query) return [];
  const res = await appGet("/bookapi/search/page/v/", query, {});
  let payload = null;
  try { payload = res.json(); } catch (e) { payload = null; }
  if (!payload || payload.code !== 0 || !Array.isArray(payload.data)) return [];
  const books = [];
  for (const cell of payload.data) {
    const list = Array.isArray(cell.book_data) ? cell.book_data : (cell.book_data ? [cell.book_data] : []);
    for (const book of list) {
      if (!book || !book.book_id) continue;
      books.push({
        book_id: String(book.book_id),
        book_name: String(book.book_name || book.book_id),
        author: String(book.author || ""),
        abstract: String(book.abstract || ""),
        creation_status: String(book.creation_status || ""),
        cover: String(book.thumb_url || book.cover || ""),
        item_id: String(book.first_chapter_item_id || ""),
      });
    }
  }
  return books;
}
'''


def patch_worker(source: str) -> str:
    # 1) expose the signed APP search helper inside the bundled __FQ module
    anchor = 'return { getFullChapter };'
    if source.count(anchor) != 1:
        raise SystemExit("FQ export anchor mismatch")
    source = source.replace(anchor, APP_SEARCH_HELPER + 'return { getFullChapter, searchBooks: __localSearchBooks };', 1)

    # 2) hSearch: add built-in signed APP search before the ID-only fallback
    old_has = '''async function hSearch(env, key) {
  if (!key) return json({ code: 400, message: "key required" }, 400);
  const r = await proxyGet(env, "/search", { key, tab_type: 3 });
  if (r.ok) return json({ code: 200, from: r.from, data: r.data });'''
    if source.count(old_has) != 1:
        raise SystemExit("hSearch anchor mismatch")
    new_has = old_has + '''
  try {
    const appBooks = await __FQ.searchBooks(key, 0, 10);
    if (appBooks.length) return json({ code: 200, from: "app", data: { search_book_data_list: appBooks, total_count: appBooks.length } });
  } catch (e) {}'''
    source = source.replace(old_has, new_has, 1)

    # 3) classic script: wrap the module and capture its default export
    if source.count('export default {') != 1 or source.count('export class FanqieJob') != 1:
        raise SystemExit("module export anchors mismatch")
    source = source.replace('export class FanqieJob', 'class FanqieJob', 1)
    source = source.replace('export default {', 'var __defaultExport = {', 1)
    source += '\nglobalThis.__NW = __defaultExport;\n'
    preamble = ("var process = (globalThis.process && globalThis.process.env) "
                "? globalThis.process : { env: { NODE_ENV: 'production' } };\n")
    return '(function(){\n' + preamble + source + '\n})();\n'


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    worker = (PROJECT / 'workers/.wrangler/production-build/worker-built.mjs').read_text()
    local_worker = patch_worker(worker)
    (OUT / 'local-worker.js').write_text(local_worker)
    if 'export ' in local_worker:
        raise SystemExit('unexpected export keyword left in local worker')

    (OUT / 'material-theme.js').write_text((PROJECT / 'static/material-theme.txt').read_text())
    (OUT / 'local-bridge.js').write_text((ANDROID / 'local-bridge.js').read_text())

    page = (PROJECT / 'static/read.html').read_text()
    anchor = '<script src="/material-theme.js"></script>'
    if page.count(anchor) != 1:
        raise SystemExit('reader script anchor mismatch')
    page = page.replace(anchor, ('<script src="material-theme.js"></script>\n'
                                 '<script src="local-worker.js"></script>\n'
                                 '<script src="local-bridge.js"></script>'), 1)
    (OUT / 'index.html').write_text(page)

    for name in ('index.html', 'local-worker.js', 'local-bridge.js', 'material-theme.js'):
        print(name, (OUT / name).stat().st_size, 'bytes')
    print('assets ->', OUT)


if __name__ == '__main__':
    main()
