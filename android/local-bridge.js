/* Offline bridge: runs the Cloudflare Worker fetch handler inside the WebView.
 * - no sockets, no local server: /api/* requests are answered in-process
 * - KV is backed by localStorage, Durable Object is a stub
 * - a local account is seeded so shelf/history work without any login
 */
(function () {
  'use strict';
  if (!globalThis.__NW || typeof globalThis.__NW.fetch !== 'function') {
    console.error('local worker bundle missing');
    return;
  }
  var LS = window.localStorage;
  var KV_PREFIX = 'ndkv:';
  var PROXY_KEY = 'nd_env_proxy_api';
  var COOKIE_KEY = 'nd_env_fanqie_cookie';

  function rawGet(key) { return LS.getItem(KV_PREFIX + key); }
  var KV = {
    get: function (key) { return Promise.resolve(rawGet(key)); },
    put: function (key, value) {
      LS.setItem(KV_PREFIX + key, String(value));
      return Promise.resolve();
    },
    delete: function (key) {
      LS.removeItem(KV_PREFIX + key);
      return Promise.resolve();
    },
  };

  /* Minimal Durable Object stub: auth-attempt locks and rate limiting only. */
  var doState = Object.create(null);
  function doStore(name) {
    if (!doState[name]) doState[name] = Object.create(null);
    return doState[name];
  }
  function doReply(obj, status) {
    return new Response(JSON.stringify(obj), { status: status || 200, headers: { 'content-type': 'application/json' } });
  }
  var DO = {
    idFromName: function (name) { return { name: String(name) }; },
    get: function (id) {
      return {
        fetch: function (url, init) {
          return Promise.resolve().then(function () {
            var parsed = new URL(String(url));
            var body = {};
            try { body = init && init.body ? JSON.parse(init.body) : {}; } catch (e) { body = {}; }
            var store = doStore(id.name);
            var now = Date.now();
            if (parsed.pathname === '/auth-rate') {
              if (body.action === 'clear') { delete store['auth-attempts']; return doReply({ ok: true }); }
              var attempt = store['auth-attempts'] || { first: now, n: 0, locked_until: 0 };
              if (attempt.locked_until > now) return doReply({ ok: false, retry: Math.ceil((attempt.locked_until - now) / 1000) });
              if (now - attempt.first >= 600000 || attempt.locked_until) { attempt.first = now; attempt.n = 0; attempt.locked_until = 0; }
              attempt.n++;
              if (attempt.n > 5) return doReply({ ok: false, retry: 900 });
              if (attempt.n === 5) attempt.locked_until = now + 900000;
              store['auth-attempts'] = attempt;
              return doReply({ ok: true });
            }
            if (parsed.pathname === '/ratelimit') {
              var key = 'rl:' + String(body.key || 'unknown').slice(0, 160);
              var limit = Math.max(1, parseInt(body.limit, 10) || 10);
              var win = Math.max(1, parseInt(body.window, 10) || 60);
              var rec = store[key] || { start: now, n: 0 };
              if (now - rec.start >= win * 1000) { rec.start = now; rec.n = 0; }
              rec.n++;
              store[key] = rec;
              var ok = rec.n <= limit;
              return doReply({ ok: ok, used: rec.n, limit: limit, retry: ok ? 0 : Math.max(1, Math.ceil((rec.start + win * 1000 - now) / 1000)) });
            }
            return doReply({ ok: false }, 500);
          });
        },
      };
    },
  };

  var env = {
    FANQIE_KV: KV,
    FANQIE_DO: DO,
    get FANQIE_ONLINE_READ() { return '1'; },
    get FANQIE_PROXY_API() { return (LS.getItem(PROXY_KEY) || '').trim(); },
    get FANQIE_COOKIE() { return (LS.getItem(COOKIE_KEY) || '').trim(); },
  };
  globalThis.__NW_ENV = env;
  var ctx = { waitUntil: function (fn) { try { if (fn && fn.catch) fn.catch(function () {}); } catch (e) {} } };

  /* Local account: seeded before the reader boots so shelf/history always work. */
  function seedLocalAccount() {
    var pwdHash = 'device-local';
    var users = {};
    try { users = JSON.parse(rawGet('users') || 'null') || {}; } catch (e) { users = {}; }
    if (!users.local || users.local.account !== 'local') {
      var today = new Date().toISOString().slice(0, 10);
      users.local = { id: 'local', account: 'local', pwd_hash: pwdHash, banned: false, today: today, today_count: 0, total: 0, first_seen: today, last_seen: today };
      LS.setItem(KV_PREFIX + 'users', JSON.stringify(users));
    }
    var token = LS.getItem('nd_local_token') || '';
    if (!/^[0-9a-f]{48}$/.test(token)) {
      token = Array.from(crypto.getRandomValues(new Uint8Array(24))).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
      LS.setItem('nd_local_token', token);
    }
    var sessionKey = 'web_session:' + token;
    if (!rawGet(sessionKey)) {
      LS.setItem(KV_PREFIX + sessionKey, JSON.stringify({ account: 'local', created_at: Date.now(), pwd_hash: pwdHash, kind: 'user' }));
    }
    if (!LS.getItem('acctToken')) LS.setItem('acctToken', token);
    if (!LS.getItem('acctName')) LS.setItem('acctName', '本地阅读');
  }
  seedLocalAccount();

  /* Route same-document /api/* calls into the embedded worker; everything else stays native. */
  var nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var raw = typeof input === 'string' ? input : (input && input.url) ? input.url : String(input);
    var parsed = null;
    try { parsed = new URL(raw, document.baseURI); } catch (e) { parsed = null; }
    if (parsed && parsed.protocol === 'file:' && parsed.pathname.indexOf('/api/') === 0) {
      var target = 'https://local.noveldownloader' + parsed.pathname + parsed.search;
      var useInit = init || {};
      if (typeof Request !== 'undefined' && input instanceof Request) {
        useInit = { method: input.method, headers: input.headers };
      }
      var request;
      try { request = new Request(target, useInit); } catch (e) { request = new Request(target, { method: (useInit && useInit.method) || 'GET' }); }
      return Promise.resolve().then(function () { return globalThis.__NW.fetch(request, env, ctx); });
    }
    return nativeFetch(input, init);
  };

  /* In-app settings for optional env values. */
  function injectSettings() {
    var style = document.createElement('style');
    style.textContent = '#ndLocalSettingsBtn{position:fixed;right:14px;bottom:88px;z-index:40;width:44px;height:44px;border:0;border-radius:22px;background:var(--md-sys-color-secondary-container,#e8def8);color:var(--md-sys-color-on-secondary-container,#1d192b);font-size:20px;box-shadow:0 2px 6px rgba(0,0,0,.2);cursor:pointer}' +
      '#ndLocalScrim{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px}' +
      '#ndLocalPanel{width:100%;max-width:420px;max-height:82vh;overflow:auto;background:var(--md-sys-color-surface,#fef7ff);color:var(--md-sys-color-on-surface,#1d1b20);border-radius:20px;padding:18px;box-sizing:border-box}' +
      '#ndLocalPanel h3{margin:0 0 6px;font-size:18px}#ndLocalPanel p{margin:0 0 12px;font-size:12px;line-height:1.6;color:var(--md-sys-color-on-surface-variant,#49454f)}' +
      '#ndLocalPanel label{display:block;margin:12px 0 4px;font-size:13px}#ndLocalPanel input{width:100%;box-sizing:border-box;padding:10px;border-radius:10px;border:1px solid var(--md-sys-color-outline,#79747e);background:var(--md-sys-color-surface-variant,#e7e0ec);color:inherit;font-size:14px}' +
      '#ndLocalPanel .row{display:flex;gap:8px;margin-top:16px;flex-wrap:wrap}#ndLocalPanel button{flex:1;min-height:42px;border-radius:12px;border:0;font-size:14px;cursor:pointer}';
    document.head.appendChild(style);

    var button = document.createElement('button');
    button.id = 'ndLocalSettingsBtn';
    button.type = 'button';
    button.title = '本地设置';
    button.setAttribute('aria-label', '本地设置');
    button.textContent = '⚙';
    document.body.appendChild(button);

    var scrim = null;
    function close() { if (scrim && scrim.parentNode) scrim.parentNode.removeChild(scrim); scrim = null; }
    function open() {
      close();
      scrim = document.createElement('div');
      scrim.id = 'ndLocalScrim';
      scrim.innerHTML = '<div id="ndLocalPanel" role="dialog" aria-modal="true">' +
        '<h3>本地设置</h3>' +
        '<p>离线阅读在本机完成，不经过服务器、不开放端口。番茄搜索已内置签名接口，通常无需填写下面两项。</p>' +
        '<label for="ndProxy">代理 API 基址（可选）</label>' +
        '<input id="ndProxy" inputmode="url" placeholder="https://your-proxy.example.com/api" value="">' +
        '<label for="ndCookie">番茄网页 Cookie（可选，用于网页抓取兜底）</label>' +
        '<input id="ndCookie" placeholder="你在 fanqienovel.com 的登录 Cookie" value="">' +
        '<div class="row"><button id="ndSave" class="mdc-button">保存</button><button id="ndClear" class="mdc-button">清除本地数据</button><button id="ndCancel" class="mdc-button">关闭</button></div>' +
        '</div>';
      document.body.appendChild(scrim);
      var proxyInput = document.getElementById('ndProxy');
      var cookieInput = document.getElementById('ndCookie');
      proxyInput.value = LS.getItem(PROXY_KEY) || '';
      cookieInput.value = LS.getItem(COOKIE_KEY) || '';
      document.getElementById('ndCancel').onclick = close;
      scrim.onclick = function (event) { if (event.target === scrim) close(); };
      document.getElementById('ndSave').onclick = function () {
        LS.setItem(PROXY_KEY, proxyInput.value.trim());
        LS.setItem(COOKIE_KEY, cookieInput.value.trim());
        close();
        location.reload();
      };
      document.getElementById('ndClear').onclick = function () {
        if (!window.confirm('清除本机保存的阅读数据（书架、历史、设置、缓存）？')) return;
        var keys = [];
        for (var i = 0; i < LS.length; i++) {
          var k = LS.key(i);
          if (k && (k.indexOf(KV_PREFIX) === 0 || k === 'acctToken' || k === 'acctName' || k === 'nd_local_token' || k.indexOf('nd_hist_') === 0 || k.indexOf('nd_shelf_') === 0)) keys.push(k);
        }
        keys.forEach(function (k) { LS.removeItem(k); });
        close();
        location.reload();
      };
    }
    button.onclick = open;
  }
  injectSettings();
})();
