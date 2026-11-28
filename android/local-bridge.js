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
  function injectFirstRunDialogs() {
    var termsKey = 'nd_terms_accepted_v1';
    var starKey = 'nd_star_prompt_shown_v1';
    var style = document.createElement('style');
    style.textContent = '#ndFirstRunScrim{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.62);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box}' +
      '#ndFirstRunPanel{width:100%;max-width:520px;max-height:88vh;display:flex;flex-direction:column;overflow:hidden;background:var(--md-sys-color-surface,#fef7ff);color:var(--md-sys-color-on-surface,#1d1b20);border-radius:22px;box-shadow:0 12px 48px rgba(0,0,0,.3);padding:20px;box-sizing:border-box}' +
      '#ndFirstRunPanel h2{font-size:20px;margin:0 0 10px}#ndFirstRunPanel .ndIntro{font-size:13px;line-height:1.6;color:var(--md-sys-color-on-surface-variant,#49454f);margin:0 0 12px}' +
      '#ndTermsText{overflow:auto;overscroll-behavior:contain;padding:0 2px 8px;font-size:13px;line-height:1.65;color:var(--md-sys-color-on-surface,#1d1b20)}' +
      '#ndTermsText h3{font-size:14px;margin:12px 0 3px}#ndTermsText p{margin:0 0 8px}' +
      '#ndTermsAgree{display:flex;align-items:flex-start;gap:9px;padding:12px 0;font-size:13px;line-height:1.5;border-top:1px solid var(--md-sys-color-outline-variant,#cac4d0)}' +
      '#ndTermsAgree input{width:20px;height:20px;flex:none;margin:0;accent-color:var(--md-sys-color-primary,#6750a4)}' +
      '#ndFirstRunActions{display:flex;gap:8px}#ndFirstRunActions button{flex:1;min-height:44px;border:0;border-radius:14px;font-size:14px;cursor:pointer;background:var(--md-sys-color-secondary-container,#e8def8);color:var(--md-sys-color-on-secondary-container,#1d192b)}' +
      '#ndFirstRunActions button.primary{background:var(--md-sys-color-primary,#6750a4);color:var(--md-sys-color-on-primary,#fff)}#ndFirstRunActions button:disabled{opacity:.45;cursor:default}' +
      '#ndStarPanel{text-align:center;padding:28px 22px}#ndStarPanel .ndStarIcon{font-size:38px;line-height:1;margin-bottom:12px}#ndStarPanel p{font-size:14px;line-height:1.6;color:var(--md-sys-color-on-surface-variant,#49454f);margin:8px 0 18px}' +
      '#ndStarPanel .ndStarActions{display:flex;gap:8px}#ndStarPanel button{flex:1;min-height:44px;border:0;border-radius:14px;font-size:14px;cursor:pointer;background:var(--md-sys-color-secondary-container,#e8def8);color:var(--md-sys-color-on-secondary-container,#1d192b)}' +
      '#ndStarPanel button.primary{background:var(--md-sys-color-primary,#6750a4);color:var(--md-sys-color-on-primary,#fff)}';
    document.head.appendChild(style);

    function removeScrim(scrim) {
      if (scrim && scrim.parentNode) scrim.parentNode.removeChild(scrim);
      document.body.style.overflow = '';
    }
    function showStarPrompt() {
      if (LS.getItem(starKey) === '1') return;
      LS.setItem(starKey, '1');
      var scrim = document.createElement('div');
      scrim.id = 'ndFirstRunScrim';
      scrim.innerHTML = '<div id="ndFirstRunPanel" role="dialog" aria-modal="true" aria-labelledby="ndStarTitle"><div id="ndStarPanel">' +
        '<div class="ndStarIcon" aria-hidden="true">⭐</div><h2 id="ndStarTitle">喜欢这个离线阅读器吗？</h2>' +
        '<p>项目开源免费。如果觉得好用，欢迎到 GitHub 点个 Star 支持后续维护；不想点也可以直接开始使用。</p>' +
        '<div class="ndStarActions"><button id="ndStarSkip">先开始使用</button><button id="ndStarGo" class="primary">去 GitHub 点 Star</button></div>' +
        '</div></div>';
      document.body.appendChild(scrim);
      document.body.style.overflow = 'hidden';
      document.getElementById('ndStarSkip').onclick = function () { removeScrim(scrim); };
      document.getElementById('ndStarGo').onclick = function () {
        try { if (window.NativeDownloads) window.NativeDownloads.openGithub(); } catch (e) {}
        removeScrim(scrim);
      };
      scrim.onclick = function (event) { if (event.target === scrim) removeScrim(scrim); };
    }
    function showTerms() {
      var scrim = document.createElement('div');
      scrim.id = 'ndFirstRunScrim';
      scrim.innerHTML = '<div id="ndFirstRunPanel" role="dialog" aria-modal="true" aria-labelledby="ndTermsTitle">' +
        '<h2 id="ndTermsTitle">使用条款与用户协议</h2>' +
        '<p class="ndIntro">首次使用前请阅读以下约定。必须勾选同意后才能进入；不同意可退出应用。</p>' +
        '<div id="ndTermsText" tabindex="0">' +
        '<h3>一、服务说明</h3><p>本应用是用于个人学习、研究和技术交流的本地阅读工具，可通过网络检索或读取相应内容平台提供的内容，并将可获取的章节整理为文本文件保存到本机 Download 目录。本应用本身不托管或分发小说内容。</p>' +
        '<h3>二、版权与合规使用</h3><p>小说及其他内容的版权归原作者、权利人及相应平台所有。你应确认自己有权访问、阅读和保存所获取的内容，并遵守所在地法律法规及平台服务条款。不得将本应用用于商业用途、批量抓取、转售或未经授权的传播，也不得侵害他人合法权益。</p>' +
        '<h3>三、网络请求与本地数据</h3><p>搜索、目录和章节获取需要网络连接；相关请求会发送至所选内容平台，以及你自行配置的代理服务（如有）。这些服务可能按其规则处理请求并获得网络连接所需的信息。本应用的书架、阅读历史、外观设置及可选配置保存在本机；应用开发者不会通过本应用收集这些本地数据。请妥善保管自行填写的 Cookie 或其他凭据。</p>' +
        '<h3>四、风险与责任</h3><p>本应用按“现状”提供，不保证持续可用、内容完整或准确。使用网络服务和保存内容可能受到平台限制或产生其他后果；请自行评估并承担风险。在法律允许的范围内，开发者不对因使用本应用造成的损失承担责任。</p>' +
        '<h3>五、同意与退出</h3><p>勾选并继续即表示你已阅读、理解并同意本协议。你可以随时停止使用并卸载应用；清除应用数据或卸载会移除本地保存的阅读数据。</p>' +
        '</div>' +
        '<label id="ndTermsAgree"><input id="ndTermsCheck" type="checkbox"><span>我已阅读并同意《使用条款与用户协议》</span></label>' +
        '<div id="ndFirstRunActions"><button id="ndTermsReject">不同意并退出</button><button id="ndTermsAccept" class="primary" disabled>同意并继续</button></div>' +
        '</div>';
      document.body.appendChild(scrim);
      document.body.style.overflow = 'hidden';
      var check = document.getElementById('ndTermsCheck');
      var accept = document.getElementById('ndTermsAccept');
      check.onchange = function () { accept.disabled = !check.checked; };
      accept.onclick = function () {
        if (!check.checked) return;
        LS.setItem(termsKey, '1');
        removeScrim(scrim);
        showStarPrompt();
      };
      document.getElementById('ndTermsReject').onclick = function () {
        try { if (window.NativeDownloads) window.NativeDownloads.exitApp(); } catch (e) {}
      };
      scrim.addEventListener('click', function (event) { if (event.target === scrim) event.preventDefault(); });
      document.addEventListener('keydown', function blockDismiss(event) {
        if (document.getElementById('ndFirstRunScrim') !== scrim) { document.removeEventListener('keydown', blockDismiss); return; }
        if (event.key === 'Escape' || event.key === 'Backspace') { event.preventDefault(); event.stopPropagation(); }
      }, true);
      check.focus();
    }
    try {
      if (LS.getItem(termsKey) === '1') showStarPrompt();
      else showTerms();
    } catch (e) {
      showTerms();
    }
  }

  var saveCallbackSeq = 0;
  window.__ndSaveTextFile = function (fileName, content, callback) {
    if (!window.NativeDownloads || typeof window.NativeDownloads.saveTextFile !== 'function') {
      if (callback) callback(false, '当前环境不支持保存到 Android Download 目录');
      return;
    }
    var callbackId = 'ndSaveCb_' + (++saveCallbackSeq);
    var done = false;
    function finish(ok, message) {
      if (done) return;
      done = true;
      try { delete window[callbackId]; } catch (e) { window[callbackId] = null; }
      if (callback) callback(!!ok, String(message || ''));
    }
    window[callbackId] = finish;
    try {
      window.NativeDownloads.saveTextFile(String(fileName || 'novel.txt'), String(content || ''), callbackId);
    } catch (e) {
      finish(false, '调用 Android 保存接口失败');
    }
    setTimeout(function () { finish(false, '保存超时，请重试'); }, 180000);
  };

  injectSettings();
  injectFirstRunDialogs();
})();
