"""Embed reader assets in the single-file production Worker (no network calls)."""
import base64
import hashlib
import json
import re
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[1]


def build(source):
    html = (PROJECT / 'static/read.html').read_text()
    html += '\n<!--\n' + (PROJECT / 'static/LUCIDE-LICENSE.txt').read_text() + '\n-->\n'
    theme = (PROJECT / 'static/material-theme.txt').read_text()
    scripts = re.findall(r'<script\b[^>]*>([\s\S]*?)</script>', html, re.I)
    hashes = ["'sha256-" + base64.b64encode(hashlib.sha256(script.encode()).digest()).decode() + "'"
              for script in scripts if script.strip()]
    policy = "script-src 'self' " + ' '.join(hashes) + "; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
    replacement = ('const READ_PAGE_HTML = ' + json.dumps(html, ensure_ascii=False) + ';\n'
                   'const MATERIAL_THEME_JS = ' + json.dumps(theme, ensure_ascii=False) + ';\n'
                   'const READ_PAGE_CSP = ' + json.dumps(policy) + ';\n')
    source = re.sub(r'^const MATERIAL_THEME_JS = .*;\n', '', source, flags=re.M)
    source = re.sub(r'^const READ_PAGE_CSP = .*;\n', '', source, flags=re.M)
    source, count = re.subn(r'^const READ_PAGE_HTML = .*;\n', lambda _: replacement, source, count=1, flags=re.M)
    if count != 1:
        raise ValueError('Expected exactly one embedded reader constant')
    anchor = 'function hRead(request, env) {'
    if 'function hMaterialTheme(' not in source:
        asset = '''function hMaterialTheme(request, env) {
  if (!onlineReadEnabled(env)) return new Response("Not Found", { status: 404 });
  if (request.method !== "GET" && request.method !== "HEAD") return new Response(null, { status: 405, headers: { allow: "GET, HEAD" } });
  return new Response(request.method === "HEAD" ? null : MATERIAL_THEME_JS, { headers: {
    "content-type": "application/javascript; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  } });
}
'''
        if source.count(anchor) != 1:
            raise ValueError('Reader handler anchor mismatch')
        source = source.replace(anchor, asset + anchor, 1)
    start = source.index(anchor)
    end = source.index('\nexport default', start)
    handler = source[start:end]
    if '"content-security-policy"' not in handler:
        handler = handler.replace('"x-content-type-options": "nosniff",',
                                  '"x-content-type-options": "nosniff",\n'
                                  '    "content-security-policy": READ_PAGE_CSP,\n'
                                  '    "x-frame-options": "DENY",\n'
                                  '    "referrer-policy": "no-referrer",', 1)
    guard = '  if (request.method !== "GET" && request.method !== "HEAD") return new Response(null, { status: 405, headers: { allow: "GET, HEAD" } });\n'
    if guard not in handler:
        handler = handler.replace(anchor + '\n', anchor + '\n' + guard, 1)
    source = source[:start] + handler + source[end:]
    route = '      if (p === "/material-theme.js") return hMaterialTheme(request, env);\n'
    if route not in source:
        anchor = '      if (p === "/read" || p === "/read/" || p === "/read/index.html") return hRead(request, env);'
        if source.count(anchor) != 1:
            raise ValueError('Reader route anchor mismatch')
        source = source.replace(anchor, route + anchor, 1)
    return source


if __name__ == '__main__':
    worker = PROJECT / 'workers/worker.js'
    source = worker.read_text()
    result = build(source)
    worker.write_text(result)
    print('Embedded current reader, color utilities, and reader security policy')
