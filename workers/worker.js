// 番茄小说下载器 — Cloudflare Workers 单文件版
//
// 版权与许可：AGPL-3.0
// 作者：江南烟雨 (a8219)
//
// 本文件包含来自第三方项目的代码，详见 THIRD_PARTY_NOTICES.md。
//
// ========== 原创部分 ==========
// 代理 API 契约: /search /detail /directory /content /download /export
// 网页解析: window.__INITIAL_STATE__ / LD+JSON / 字体映射(FONT_MAP)
// 字体映射: 子集 woff2 dc027189e0ba4cd 与 SourceHanSansCN-Normal v2.002
//   逐字形轮廓 MD5 匹配, 362/362 命中, 三本不同书验证 PUA 全覆盖
// Telegram Bot / 账号系统 / 配额管理 / Durable Object 下载队列
// MD3 在线阅读页 /read
//
// ========== 第三方部分（fanqie-assistant, GPL-3.0）==========
// 来源: https://github.com/naiyQAQ/fanqie-assistant
// 许可: GPL-3.0 (https://github.com/naiyQAQ/fanqie-assistant/blob/main/LICENSE)
// 用途: APP 正文接口（签名、设备注册、密钥获取、章节解密）
// 算法: X-Argus(SM3+Simon+Protobuf+AES)、X-Ladon(Speck-128)、AES-CBC 解密
// 说明: 本文件的 __FQ IIFE 包含 fanqie-assistant 的裁剪打包版,
//   用于在网页版仅提供试读片段时通过 APP 接口获取完整正文。
//   因 GPL-3.0 传染性, 本文件整体以 AGPL-3.0 分发（AGPL-3.0 兼容 GPL-3.0）。
//
// ========== 第三方部分（Vue, MIT）==========
// 来源: https://github.com/vuejs/core
// 许可: MIT License
// 说明: __FQ IIFE 内包含打包的 Vue runtime（reactive/watch/vnode 等），
//   本 Worker 实际未使用这些 Vue 函数，保留是因为裁剪会破坏打包结构。
//

const __FQ = (() => {
globalThis.unsafeWindow = globalThis;
const _GM = new Map();
globalThis.GM_getValue = (k, d) => _GM.has(k) ? _GM.get(k) : d;
globalThis.GM_setValue = (k, v) => { _GM.set(k, v); };
globalThis.GM_deleteValue = (k) => { _GM.delete(k); };
globalThis.GM_listValues = () => [..._GM.keys()];
globalThis.GM_xmlhttpRequest = (opts) => {
  const { url, method = 'GET', headers = {}, data, responseType, onload, onerror, onabort, ontimeout, anonymous, signal } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => { controller.abort(); ontimeout && ontimeout(); }, 60000);
  const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  const init = { method, headers, signal: combined };
  if (data !== undefined) init.body = data;
  if (anonymous) init.credentials = 'omit';
  fetch(url, init).then(async r => {
    clearTimeout(timer);
    let body = responseType === 'arraybuffer' ? await r.arrayBuffer() : await r.text();
    onload && onload({ status: r.status, statusText: r.statusText, responseText: typeof body === 'string' ? body : '', response: body, finalUrl: r.url });
  }).catch(e => {
    clearTimeout(timer);
    if (e.name === 'AbortError' && onabort) return onabort();
    onerror && onerror({ error: e, status: 0 });
  });
  return { abort: () => controller.abort() };
};
// src/config.ts
var shared_key = new Uint8Array([172, 37, 198, 125, 221, 143, 56, 193, 179, 122, 35, 72, 130, 142, 34, 46]).buffer;
var fetch2 = unsafeWindow.fetch;
var XMLHttpRequest = unsafeWindow.XMLHttpRequest;
var defaultConfig = {
  install_id: "2187355326270644",
  device_id: "2187355326004404",
  device_type: "P30"
};
var config_default = {
  currentConfig: defaultConfig
};

// src/utils/request.ts
var EmptyResponseError = class extends Error {
  status;
  constructor(status) {
    super(`\u670D\u52A1\u7AEF\u8FD4\u56DE\u4E86\u7A7A\u54CD\u5E94\u4F53(HTTP ${status})`);
    this.name = "EmptyResponseError";
    this.status = status;
  }
};
function isEmptyResponse(res) {
  const text = res.responseText;
  return typeof text !== "string" || text === "";
}
var supportedMethods = /* @__PURE__ */ new Set([
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "DELETE"
]);
function apiFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const { signal } = options;
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException("The operation was aborted", "AbortError"));
      return;
    }
    const headers = normalizeHeaders(options.headers);
    const data = normalizeBody(options.body);
    const method = options.method ?? (data ? "POST" : "GET");
    if (!supportedMethods.has(method)) {
      reject(new TypeError(`Unsupported request method: ${method}`));
      return;
    }
    let request;
    const abort = () => request?.abort();
    function cleanup() {
      signal?.removeEventListener("abort", abort);
    }
    request = GM_xmlhttpRequest({
      url,
      method,
      headers,
      data,
      anonymous: options.credentials === "omit",
      redirect: options.redirect === "error" ? "error" : "follow",
      onload(response) {
        cleanup();
        resolve(Object.assign(response, {
          json() {
            if (isEmptyResponse(this)) {
              throw new EmptyResponseError(this.status);
            }
            return JSON.parse(this.responseText);
          }
        }));
      },
      onerror(response) {
        cleanup();
        reject(createRequestError("Network request failed", response));
      },
      ontimeout() {
        cleanup();
        reject(createRequestError("Network request timed out", {
          status: 0,
          statusText: "Timeout",
          url
        }));
      },
      onabort() {
        cleanup();
        reject(
          signal?.reason ?? new DOMException("The operation was aborted", "AbortError")
        );
      }
    });
    signal?.addEventListener("abort", abort, { once: true });
  });
}
function normalizeHeaders(headers) {
  if (!headers) {
    return void 0;
  }
  return Object.fromEntries(new Headers(headers).entries());
}
function normalizeBody(body) {
  if (body == null) {
    return void 0;
  }
  if (body instanceof URLSearchParams) {
    return body.toString();
  }
  if (typeof body === "string" || body instanceof Blob || body instanceof ArrayBuffer || body instanceof FormData) {
    return body;
  }
  if (ArrayBuffer.isView(body)) {
    return body.buffer.slice(
      body.byteOffset,
      body.byteOffset + body.byteLength
    );
  }
  throw new TypeError(
    "GM_xmlhttpRequest does not support ReadableStream request bodies"
  );
}
function createRequestError(message, response) {
  const error = new TypeError(message);
  Object.defineProperty(error, "response", {
    configurable: true,
    enumerable: false,
    value: response
  });
  return error;
}

// src/crypto/md5.ts
function rotateLeft(value, shiftBits) {
  return value << shiftBits | value >>> 32 - shiftBits;
}
function addUnsigned(left, right) {
  return left + right >>> 0;
}
function f(x, y, z) {
  return x & y | ~x & z;
}
function g(x, y, z) {
  return x & z | y & ~z;
}
function h(x, y, z) {
  return x ^ y ^ z;
}
function i(x, y, z) {
  return y ^ (x | ~z);
}
function ff(a, b, c, d, x, s, ac) {
  return addUnsigned(rotateLeft(addUnsigned(a, addUnsigned(addUnsigned(f(b, c, d), x), ac)), s), b);
}
function gg(a, b, c, d, x, s, ac) {
  return addUnsigned(rotateLeft(addUnsigned(a, addUnsigned(addUnsigned(g(b, c, d), x), ac)), s), b);
}
function hh(a, b, c, d, x, s, ac) {
  return addUnsigned(rotateLeft(addUnsigned(a, addUnsigned(addUnsigned(h(b, c, d), x), ac)), s), b);
}
function ii(a, b, c, d, x, s, ac) {
  return addUnsigned(rotateLeft(addUnsigned(a, addUnsigned(addUnsigned(i(b, c, d), x), ac)), s), b);
}
function convertToWordArray(bytes) {
  const wordCount = Math.ceil((bytes.length + 9) / 64) * 16;
  const words = new Array(wordCount).fill(0);
  for (let byteIndex = 0; byteIndex < bytes.length; byteIndex++) {
    const wordIndex = Math.floor(byteIndex / 4);
    const bytePosition = byteIndex % 4 * 8;
    words[wordIndex] = words[wordIndex] | bytes[byteIndex] << bytePosition;
  }
  const paddingWordIndex = Math.floor(bytes.length / 4);
  const paddingBytePosition = bytes.length % 4 * 8;
  words[paddingWordIndex] = words[paddingWordIndex] | 128 << paddingBytePosition;
  words[wordCount - 2] = bytes.length << 3;
  words[wordCount - 1] = bytes.length >>> 29;
  return words;
}
function wordToHex(value) {
  let hex2 = "";
  for (let byteIndex = 0; byteIndex < 4; byteIndex++) {
    const byte = value >>> byteIndex * 8 & 255;
    hex2 += byte.toString(16).padStart(2, "0");
  }
  return hex2;
}
function md5(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  const words = convertToWordArray(bytes);
  let a = 1732584193;
  let b = 4023233417;
  let c = 2562383102;
  let d = 271733878;
  for (let k = 0; k < words.length; k += 16) {
    const aa = a;
    const bb = b;
    const cc = c;
    const dd = d;
    a = ff(a, b, c, d, words[k], 7, 3614090360);
    d = ff(d, a, b, c, words[k + 1], 12, 3905402710);
    c = ff(c, d, a, b, words[k + 2], 17, 606105819);
    b = ff(b, c, d, a, words[k + 3], 22, 3250441966);
    a = ff(a, b, c, d, words[k + 4], 7, 4118548399);
    d = ff(d, a, b, c, words[k + 5], 12, 1200080426);
    c = ff(c, d, a, b, words[k + 6], 17, 2821735955);
    b = ff(b, c, d, a, words[k + 7], 22, 4249261313);
    a = ff(a, b, c, d, words[k + 8], 7, 1770035416);
    d = ff(d, a, b, c, words[k + 9], 12, 2336552879);
    c = ff(c, d, a, b, words[k + 10], 17, 4294925233);
    b = ff(b, c, d, a, words[k + 11], 22, 2304563134);
    a = ff(a, b, c, d, words[k + 12], 7, 1804603682);
    d = ff(d, a, b, c, words[k + 13], 12, 4254626195);
    c = ff(c, d, a, b, words[k + 14], 17, 2792965006);
    b = ff(b, c, d, a, words[k + 15], 22, 1236535329);
    a = gg(a, b, c, d, words[k + 1], 5, 4129170786);
    d = gg(d, a, b, c, words[k + 6], 9, 3225465664);
    c = gg(c, d, a, b, words[k + 11], 14, 643717713);
    b = gg(b, c, d, a, words[k], 20, 3921069994);
    a = gg(a, b, c, d, words[k + 5], 5, 3593408605);
    d = gg(d, a, b, c, words[k + 10], 9, 38016083);
    c = gg(c, d, a, b, words[k + 15], 14, 3634488961);
    b = gg(b, c, d, a, words[k + 4], 20, 3889429448);
    a = gg(a, b, c, d, words[k + 9], 5, 568446438);
    d = gg(d, a, b, c, words[k + 14], 9, 3275163606);
    c = gg(c, d, a, b, words[k + 3], 14, 4107603335);
    b = gg(b, c, d, a, words[k + 8], 20, 1163531501);
    a = gg(a, b, c, d, words[k + 13], 5, 2850285829);
    d = gg(d, a, b, c, words[k + 2], 9, 4243563512);
    c = gg(c, d, a, b, words[k + 7], 14, 1735328473);
    b = gg(b, c, d, a, words[k + 12], 20, 2368359562);
    a = hh(a, b, c, d, words[k + 5], 4, 4294588738);
    d = hh(d, a, b, c, words[k + 8], 11, 2272392833);
    c = hh(c, d, a, b, words[k + 11], 16, 1839030562);
    b = hh(b, c, d, a, words[k + 14], 23, 4259657740);
    a = hh(a, b, c, d, words[k + 1], 4, 2763975236);
    d = hh(d, a, b, c, words[k + 4], 11, 1272893353);
    c = hh(c, d, a, b, words[k + 7], 16, 4139469664);
    b = hh(b, c, d, a, words[k + 10], 23, 3200236656);
    a = hh(a, b, c, d, words[k + 13], 4, 681279174);
    d = hh(d, a, b, c, words[k], 11, 3936430074);
    c = hh(c, d, a, b, words[k + 3], 16, 3572445317);
    b = hh(b, c, d, a, words[k + 6], 23, 76029189);
    a = hh(a, b, c, d, words[k + 9], 4, 3654602809);
    d = hh(d, a, b, c, words[k + 12], 11, 3873151461);
    c = hh(c, d, a, b, words[k + 15], 16, 530742520);
    b = hh(b, c, d, a, words[k + 2], 23, 3299628645);
    a = ii(a, b, c, d, words[k], 6, 4096336452);
    d = ii(d, a, b, c, words[k + 7], 10, 1126891415);
    c = ii(c, d, a, b, words[k + 14], 15, 2878612391);
    b = ii(b, c, d, a, words[k + 5], 21, 4237533241);
    a = ii(a, b, c, d, words[k + 12], 6, 1700485571);
    d = ii(d, a, b, c, words[k + 3], 10, 2399980690);
    c = ii(c, d, a, b, words[k + 10], 15, 4293915773);
    b = ii(b, c, d, a, words[k + 1], 21, 2240044497);
    a = ii(a, b, c, d, words[k + 8], 6, 1873313359);
    d = ii(d, a, b, c, words[k + 15], 10, 4264355552);
    c = ii(c, d, a, b, words[k + 6], 15, 2734768916);
    b = ii(b, c, d, a, words[k + 13], 21, 1309151649);
    a = ii(a, b, c, d, words[k + 4], 6, 4149444226);
    d = ii(d, a, b, c, words[k + 11], 10, 3174756917);
    c = ii(c, d, a, b, words[k + 2], 15, 718787259);
    b = ii(b, c, d, a, words[k + 9], 21, 3951481745);
    a = addUnsigned(a, aa);
    b = addUnsigned(b, bb);
    c = addUnsigned(c, cc);
    d = addUnsigned(d, dd);
  }
  return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
}

// src/crypto/sm3.ts
function rotl(value, shift) {
  const normalizedShift = shift & 31;
  return value << normalizedShift | value >>> 32 - normalizedShift;
}
function p0(value) {
  return value ^ rotl(value, 9) ^ rotl(value, 17);
}
function p1(value) {
  return value ^ rotl(value, 15) ^ rotl(value, 23);
}
function sm3(input) {
  const inputLength = input.length;
  const paddedLength = Math.ceil((inputLength + 9) / 64) * 64;
  const message = new Uint8Array(paddedLength);
  message.set(input);
  message[inputLength] = 128;
  const bitLength = BigInt(inputLength) * 8n;
  for (let i2 = 0; i2 < 8; i2++) {
    message[paddedLength - 1 - i2] = Number(bitLength >> BigInt(i2 * 8) & 0xffn);
  }
  const dataView = new DataView(message.buffer);
  const state = new Uint32Array([
    1937774191,
    1226093241,
    388252375,
    3666478592,
    2842636476,
    372324522,
    3817729613,
    2969243214
  ]);
  const words = new Uint32Array(68);
  const expandedWords = new Uint32Array(64);
  for (let block = 0; block < message.length / 64; block++) {
    const start = block * 64;
    for (let i2 = 0; i2 < 16; i2++) {
      words[i2] = dataView.getUint32(start + i2 * 4, false);
    }
    for (let i2 = 16; i2 < 68; i2++) {
      words[i2] = p1(words[i2 - 16] ^ words[i2 - 9] ^ rotl(words[i2 - 3], 15)) ^ rotl(words[i2 - 13], 7) ^ words[i2 - 6];
    }
    for (let i2 = 0; i2 < 64; i2++) {
      expandedWords[i2] = words[i2] ^ words[i2 + 4];
    }
    let a = state[0];
    let b = state[1];
    let c = state[2];
    let d = state[3];
    let e = state[4];
    let f2 = state[5];
    let g2 = state[6];
    let h2 = state[7];
    for (let i2 = 0; i2 < 64; i2++) {
      const t = i2 <= 15 ? 2043430169 : 2055708042;
      const ss1 = rotl(rotl(a, 12) + e + rotl(t, i2), 7);
      const ss2 = ss1 ^ rotl(a, 12);
      const tt1 = (i2 <= 15 ? a ^ b ^ c : a & b | a & c | b & c) + d + ss2 + expandedWords[i2];
      const tt2 = (i2 <= 15 ? e ^ f2 ^ g2 : e & f2 | ~e & g2) + h2 + ss1 + words[i2];
      d = c;
      c = rotl(b, 9);
      b = a;
      a = tt1;
      h2 = g2;
      g2 = rotl(f2, 19);
      f2 = e;
      e = p0(tt2);
    }
    state[0] = state[0] ^ a;
    state[1] = state[1] ^ b;
    state[2] = state[2] ^ c;
    state[3] = state[3] ^ d;
    state[4] = state[4] ^ e;
    state[5] = state[5] ^ f2;
    state[6] = state[6] ^ g2;
    state[7] = state[7] ^ h2;
  }
  const result = new Uint8Array(32);
  for (let i2 = 0; i2 < state.length; i2++) {
    const word = state[i2];
    result[i2 * 4] = word >>> 24;
    result[i2 * 4 + 1] = word >>> 16;
    result[i2 * 4 + 2] = word >>> 8;
    result[i2 * 4 + 3] = word;
  }
  return result;
}

// src/crypto/index.ts
function getCrypto() {
  const c = globalThis.crypto ?? unsafeWindow.crypto;
  if (!c?.subtle) {
    throw new Error("Crypto API\u4E0D\u53EF\u7528\uFF0C\u8BF7\u68C0\u67E5\u6D4F\u89C8\u5668\u7248\u672C\u662F\u5426\u652F\u6301\u8BE5API");
  }
  return c;
}
function getSubtle() {
  return getCrypto().subtle;
}
function b64decode(b64) {
  const binaryString = atob(b64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i2 = 0; i2 < len; i2++) {
    bytes[i2] = binaryString.charCodeAt(i2);
  }
  return bytes.buffer;
}
function b64encode(buffer2) {
  const bytes = new Uint8Array(buffer2);
  const chunkSize = 32768;
  const chunks = [];
  for (let i2 = 0; i2 < bytes.length; i2 += chunkSize) {
    chunks.push(
      String.fromCharCode(...bytes.subarray(i2, i2 + chunkSize))
    );
  }
  return btoa(chunks.join(""));
}
function unhex(hex2) {
  if (hex2.length % 2 !== 0) {
    throw new Error("Invalid hex string");
  }
  const bytes = new Uint8Array(hex2.length / 2);
  for (let i2 = 0; i2 < hex2.length; i2 += 2) {
    const byte = parseInt(hex2.slice(i2, i2 + 2), 16);
    if (Number.isNaN(byte)) {
      throw new Error("Invalid hex string");
    }
    bytes[i2 / 2] = byte;
  }
  return bytes.buffer;
}
function hex(buffer2) {
  const bytes = new Uint8Array(buffer2);
  let hexString = "";
  for (let i2 = 0; i2 < bytes.length; i2++) {
    hexString += bytes[i2].toString(16).padStart(2, "0");
  }
  return hexString;
}
function pkcs7Pad(data, blockSize = 16) {
  const padLength = blockSize - data.length % blockSize;
  const padded = new Uint8Array(data.length + padLength);
  padded.set(data);
  padded.fill(padLength, data.length);
  return padded;
}
function randomString(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const array = new Uint8Array(length);
  getCrypto().getRandomValues(array);
  for (let i2 = 0; i2 < length; i2++) {
    result += chars.charAt(array[i2] % chars.length);
  }
  return result;
}
function toBytes(input) {
  if (typeof input === "string") {
    return new TextEncoder().encode(input);
  }
  if (input instanceof Uint8Array) {
    return new Uint8Array(input);
  }
  return new Uint8Array(input);
}
var hash = {
  sha256: async (input) => {
    const subtle = getSubtle();
    const digest = await subtle.digest("SHA-256", toBytes(input));
    return hex(digest);
  },
  sha256bytes: async (input) => {
    const subtle = getSubtle();
    return subtle.digest("SHA-256", toBytes(input));
  },
  sha512: async (input) => {
    const subtle = getSubtle();
    const digest = await subtle.digest("SHA-512", toBytes(input));
    return hex(digest);
  },
  sha512bytes: async (input) => {
    const subtle = getSubtle();
    return subtle.digest("SHA-512", toBytes(input));
  },
  md5: async (input) => md5(
    typeof input === "string" ? input : toBytes(input).buffer
  ),
  md5bytes: async (input) => unhex(md5(
    typeof input === "string" ? input : toBytes(input).buffer
  )),
  sm3: async (input) => hex(sm3(toBytes(input)).buffer),
  sm3bytes: async (input) => sm3(toBytes(input)).buffer
};

// src/crypto/protobuf.ts
var WIRE_VARINT = 0;
var WIRE_BYTES = 2;
var WIRE_FIXED32 = 5;
var ProtobufWriter = class _ProtobufWriter {
  buf = [];
  writeVarint(value) {
    let v = value >>> 0;
    while (v >= 128) {
      this.buf.push(v & 127 | 128);
      v >>>= 7;
    }
    this.buf.push(v & 127);
    return this;
  }
  writeKey(fieldNumber, wireType) {
    return this.writeVarint(fieldNumber << 3 | wireType);
  }
  varint(fieldNumber, value) {
    return this.writeKey(fieldNumber, WIRE_VARINT).writeVarint(value);
  }
  fixed32(fieldNumber, value) {
    this.writeKey(fieldNumber, WIRE_FIXED32);
    const v = value >>> 0;
    this.buf.push(v & 255, v >>> 8 & 255, v >>> 16 & 255, v >>> 24 & 255);
    return this;
  }
  bytes(fieldNumber, data) {
    this.writeKey(fieldNumber, WIRE_BYTES).writeVarint(data.length);
    for (let i2 = 0; i2 < data.length; i2++) {
      this.buf.push(data[i2] & 255);
    }
    return this;
  }
  string(fieldNumber, value) {
    return this.bytes(fieldNumber, new TextEncoder().encode(value));
  }
  message(fieldNumber, build) {
    const sub = new _ProtobufWriter();
    build(sub);
    return this.bytes(fieldNumber, sub.toBytes());
  }
  toBytes() {
    return Uint8Array.from(this.buf);
  }
};

// src/crypto/simon.ts
var ROUNDS = 72;
var MASK64 = 0xffffffffffffffffn;
var Z4 = 0x3dc94c3a046d678bn;
function getBit(value, position) {
  return value >> BigInt(position) & 1n;
}
function rotateLeft64(v, n) {
  return (v << n | v >> 64n - n) & MASK64;
}
function rotateRight64(v, n) {
  return (v << 64n - n | v >> n) & MASK64;
}
function keyExpansion(key) {
  const k = [key[0] & MASK64, key[1] & MASK64, key[2] & MASK64, key[3] & MASK64];
  for (let i2 = 4; i2 < ROUNDS; i2++) {
    let tmp = rotateRight64(k[i2 - 1], 3n);
    tmp ^= k[i2 - 3];
    tmp ^= rotateRight64(tmp, 1n);
    k.push((~k[i2 - 4] ^ tmp ^ getBit(Z4, (i2 - 4) % 62) ^ 3n) & MASK64);
  }
  return k;
}
function simonEncrypt(plaintext, key) {
  const k = keyExpansion(key);
  let x = plaintext[0] & MASK64;
  let y = plaintext[1] & MASK64;
  for (let i2 = 0; i2 < ROUNDS; i2++) {
    const tmp = y;
    const f2 = rotateLeft64(y, 1n) & rotateLeft64(y, 8n);
    y = (x ^ f2 ^ rotateLeft64(y, 2n) ^ k[i2]) & MASK64;
    x = tmp;
  }
  return [x, y];
}

// src/crypto/argus.ts
var LOW_RAND = new Uint8Array([242, 129]);
var HIGH_RAND = new Uint8Array([97, 111]);
var XOR_PREFIX = new Uint8Array([242, 247, 252, 255, 242, 247, 252, 255]);
function sm3Prefix6(data) {
  return sm3(data).slice(0, 6);
}
function decodeStub(xssStub) {
  const bytes = new Uint8Array(16);
  if (xssStub.length >= 32) {
    for (let i2 = 0; i2 < 16; i2++) {
      bytes[i2] = parseInt(xssStub.slice(i2 * 2, i2 * 2 + 2), 16) & 255;
    }
  }
  return bytes;
}
function buildProtobuf(query, xssStub, timestamp, config) {
  const params = new URLSearchParams(query);
  const deviceId = params.get("device_id") ?? "";
  const versionName = params.get("version_name") ?? "";
  const bodyHash = sm3Prefix6(xssStub === "" ? new Uint8Array(16) : decodeStub(xssStub));
  const queryHash = sm3Prefix6(
    query === "" ? new Uint8Array(16) : new TextEncoder().encode(query)
  );
  const rand = getCrypto().getRandomValues(new Uint32Array(1))[0] % 2147483647;
  return new ProtobufWriter().varint(1, 538970409 * 2).varint(2, 2).varint(3, rand).string(4, config.aid).string(5, deviceId).string(6, config.licenseId).string(7, versionName).string(8, config.sdkVersion).varint(9, config.sdkVersionInt).bytes(10, new Uint8Array(8)).varint(11, 0).varint(12, timestamp * 2).bytes(13, bodyHash).bytes(14, queryHash).message(15, (sub) => {
    sub.varint(1, 1).varint(2, 1).varint(3, 1).varint(7, 3348294860);
  }).string(16, "").string(20, "none").varint(21, config.callType).message(23, (sub) => {
    sub.string(1, "NX551J").varint(2, 8196).varint(4, 2162219008);
  }).varint(25, 2).toBytes();
}
async function getArgus(query, xssStub, timestamp, config) {
  const { signKey } = config;
  if (signKey.length !== 32) {
    throw new Error(`Sign key must be 32 bytes, got ${signKey.length}`);
  }
  const protobuf = pkcs7Pad(buildProtobuf(query, xssStub, timestamp, config), 16);
  const sm3Input = new Uint8Array(signKey.length * 2 + LOW_RAND.length + HIGH_RAND.length);
  sm3Input.set(signKey, 0);
  sm3Input.set(LOW_RAND, signKey.length);
  sm3Input.set(HIGH_RAND, signKey.length + LOW_RAND.length);
  sm3Input.set(signKey, signKey.length + LOW_RAND.length + HIGH_RAND.length);
  const sm3Output = sm3(sm3Input);
  const keyView = new DataView(sm3Output.buffer, sm3Output.byteOffset, sm3Output.byteLength);
  const simonKey = [
    keyView.getBigUint64(0, true),
    keyView.getBigUint64(8, true),
    keyView.getBigUint64(16, true),
    keyView.getBigUint64(24, true)
  ];
  const encrypted = new Uint8Array(protobuf.length);
  const pbView = new DataView(protobuf.buffer, protobuf.byteOffset, protobuf.byteLength);
  const encView = new DataView(encrypted.buffer);
  for (let offset = 0; offset < protobuf.length; offset += 16) {
    const [low, high] = simonEncrypt(
      [pbView.getBigUint64(offset, true), pbView.getBigUint64(offset + 8, true)],
      simonKey
    );
    encView.setBigUint64(offset, low, true);
    encView.setBigUint64(offset + 8, high, true);
  }
  const data = new Uint8Array(XOR_PREFIX.length + encrypted.length);
  data.set(XOR_PREFIX);
  data.set(encrypted, XOR_PREFIX.length);
  for (let i2 = XOR_PREFIX.length; i2 < data.length; i2++) {
    data[i2] ^= data[i2 % 8];
  }
  data.reverse();
  const header = new Uint8Array([166, 110, 173, 159, 119, 1, 208, 12, 24]);
  const plaintext = new Uint8Array(header.length + data.length + HIGH_RAND.length);
  plaintext.set(header);
  plaintext.set(data, header.length);
  plaintext.set(HIGH_RAND, header.length + data.length);
  const subtle = getSubtle();
  const aesKey = await subtle.importKey(
    "raw",
    await hash.md5bytes(signKey.slice(0, 16)),
    { name: "AES-CBC" },
    false,
    ["encrypt"]
  );
  const iv = await hash.md5bytes(signKey.slice(16));
  const ciphertext = new Uint8Array(
    await subtle.encrypt({ name: "AES-CBC", iv }, aesKey, plaintext)
  );
  const result = new Uint8Array(LOW_RAND.length + ciphertext.length);
  result.set(LOW_RAND);
  result.set(ciphertext, LOW_RAND.length);
  return b64encode(result.buffer);
}

// src/crypto/speck.ts
var ROUNDS2 = 34;
var MASK642 = 0xffffffffffffffffn;
var WORD_SIZE = 64n;
var ALPHA = 8n;
var BETA = 3n;
function readUint64LE(view, offset) {
  return view.getBigUint64(offset, true);
}
function keySchedule(key) {
  const view = new DataView(key.buffer, key.byteOffset, key.byteLength);
  const ks = [readUint64LE(view, 0) & MASK642];
  const numWords = key.length * 8 / Number(WORD_SIZE);
  const ls = [];
  for (let i2 = 1; i2 < numWords; i2++) {
    ls.push(readUint64LE(view, i2 * 8) & MASK642);
  }
  for (let x = 0; x < ROUNDS2 - 1; x++) {
    const rsX = (ls[x] << WORD_SIZE - ALPHA) + (ls[x] >> ALPHA) & MASK642;
    const addSxy = rsX + ks[x] & MASK642;
    const newX = BigInt(x) ^ addSxy;
    const lsY = (ks[x] >> WORD_SIZE - BETA) + (ks[x] << BETA) & MASK642;
    ls.push(newX);
    ks.push(newX ^ lsY);
  }
  return ks;
}
function encryptBlock(ks, block, out, outOffset) {
  const view = new DataView(block.buffer, block.byteOffset, block.byteLength);
  let y = readUint64LE(view, 0);
  let x = readUint64LE(view, 8);
  for (const k of ks) {
    const rsX = (x << WORD_SIZE - ALPHA) + (x >> ALPHA) & MASK642;
    const addSxy = rsX + y & MASK642;
    x = k ^ addSxy;
    const lsY = (y >> WORD_SIZE - BETA) + (y << BETA) & MASK642;
    y = x ^ lsY;
  }
  const outView = new DataView(out.buffer, out.byteOffset, out.byteLength);
  outView.setBigUint64(outOffset, y & MASK642, true);
  outView.setBigUint64(outOffset + 8, x & MASK642, true);
}
function speckEncrypt(key, plaintext) {
  if (key.length !== 32) {
    throw new Error(`Speck key must be 32 bytes, got ${key.length}`);
  }
  const padded = pkcs7Pad(plaintext, 16);
  const ks = keySchedule(key);
  const out = new Uint8Array(padded.length);
  for (let i2 = 0; i2 < padded.length; i2 += 16) {
    encryptBlock(ks, padded.subarray(i2, i2 + 16), out, i2);
  }
  return out;
}
async function generateLadonKey(randomBytes, aid) {
  const aidBytes = new TextEncoder().encode(aid);
  const input = new Uint8Array(randomBytes.length + aidBytes.length);
  input.set(randomBytes);
  input.set(aidBytes, randomBytes.length);
  const hex2 = await hash.md5(input);
  return new TextEncoder().encode(hex2);
}

// src/crypto/ladon.ts
async function getLadon(timestamp, config) {
  const randomBytes = getCrypto().getRandomValues(new Uint8Array(4));
  const plaintext = new TextEncoder().encode(
    `${timestamp}-${config.licenseId}-${config.aid}`
  );
  const key = await generateLadonKey(randomBytes, config.aid);
  const encrypted = speckEncrypt(key, plaintext);
  const result = new Uint8Array(randomBytes.length + encrypted.length);
  result.set(randomBytes);
  result.set(encrypted, randomBytes.length);
  return b64encode(result.buffer);
}

// src/crypto/unidbgconfig.ts
var defaultUnidbgConfig = {
  signKey: new Uint8Array(
    unhex("ac1adaae95a7af94a5114ab3b3a97dd80050aa0a39314c40528caec95256c28c")
  ),
  aid: "1967",
  licenseId: "1611921764",
  sdkVersion: "v04.04.05-ov-android",
  sdkVersionInt: 134744640,
  callType: 738
};

// src/crypto/sign.ts
async function generateHeaders(rawQuery, xssStub = "", timestamp = Math.floor(Date.now() / 1e3), config = defaultUnidbgConfig) {
  const [argus, ladon] = await Promise.all([
    getArgus(rawQuery, xssStub, timestamp, config),
    getLadon(timestamp, config)
  ]);
  return {
    "x-argus": argus,
    "x-ladon": ladon,
    "x-khronos": String(timestamp)
  };
}
async function signRequest(url, body, config = defaultUnidbgConfig) {
  const rawQuery = new URL(url).search.replace(/^\?/, "");
  const hasBody = typeof body === "string" ? body.length > 0 : (body?.byteLength ?? 0) > 0;
  const xssStub = hasBody ? await hash.md5(body) : "";
  const now = Date.now();
  const headers = await generateHeaders(
    rawQuery,
    xssStub,
    Math.floor(now / 1e3),
    config
  );
  headers["x-ss-req-ticket"] = String(now);
  if (hasBody) {
    headers["X-SS-STUB"] = xssStub;
  }
  return headers;
}

// node_modules/@vue/shared/dist/shared.esm-bundler.js
// @__NO_SIDE_EFFECTS__
function makeMap(str) {
  const map2 = /* @__PURE__ */ Object.create(null);
  for (const key of str.split(",")) map2[key] = 1;
  return (val) => val in map2;
}
var EMPTY_OBJ = !!(process.env.NODE_ENV !== "production") ? Object.freeze({}) : {};
var EMPTY_ARR = !!(process.env.NODE_ENV !== "production") ? Object.freeze([]) : [];
var NOOP = () => {
};
var NO = () => false;
var isOn = (key) => key.charCodeAt(0) === 111 && key.charCodeAt(1) === 110 && // uppercase letter
(key.charCodeAt(2) > 122 || key.charCodeAt(2) < 97);
var isModelListener = (key) => key.startsWith("onUpdate:");
var extend = Object.assign;
var remove = (arr, el) => {
  const i2 = arr.indexOf(el);
  if (i2 > -1) {
    arr.splice(i2, 1);
  }
};
var hasOwnProperty = Object.prototype.hasOwnProperty;
var hasOwn = (val, key) => hasOwnProperty.call(val, key);
var isArray = Array.isArray;
var isMap = (val) => toTypeString(val) === "[object Map]";
var isSet = (val) => toTypeString(val) === "[object Set]";
var isFunction = (val) => typeof val === "function";
var isString = (val) => typeof val === "string";
var isSymbol = (val) => typeof val === "symbol";
var isObject = (val) => val !== null && typeof val === "object";
var isPromise = (val) => {
  return (isObject(val) || isFunction(val)) && isFunction(val.then) && isFunction(val.catch);
};
var objectToString = Object.prototype.toString;
var toTypeString = (value) => objectToString.call(value);
var toRawType = (value) => {
  return toTypeString(value).slice(8, -1);
};
var isPlainObject = (val) => toTypeString(val) === "[object Object]";
var isIntegerKey = (key) => isString(key) && key !== "NaN" && key[0] !== "-" && "" + parseInt(key, 10) === key;
var cacheStringFunction = (fn) => {
  const cache = /* @__PURE__ */ Object.create(null);
  return ((str) => {
    const hit = cache[str];
    return hit || (cache[str] = fn(str));
  });
};
var camelizeRE = /-\w/g;
var camelize = cacheStringFunction(
  (str) => {
    return str.replace(camelizeRE, (c) => c.slice(1).toUpperCase());
  }
);
var hyphenateRE = /\B([A-Z])/g;
var hyphenate = cacheStringFunction(
  (str) => str.replace(hyphenateRE, "-$1").toLowerCase()
);
var capitalize = cacheStringFunction((str) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
});
var toHandlerKey = cacheStringFunction(
  (str) => {
    const s = str ? `on${capitalize(str)}` : ``;
    return s;
  }
);
var hasChanged = (value, oldValue) => !Object.is(value, oldValue);
var def = (obj, key, value, writable = false) => {
  Object.defineProperty(obj, key, {
    configurable: true,
    enumerable: false,
    writable,
    value
  });
};
var _globalThis;
var getGlobalThis = () => {
  return _globalThis || (_globalThis = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
};
function normalizeStyle(value) {
  if (isArray(value)) {
    const res = {};
    for (let i2 = 0; i2 < value.length; i2++) {
      const item = value[i2];
      const normalized = isString(item) ? parseStringStyle(item) : normalizeStyle(item);
      if (normalized) {
        for (const key in normalized) {
          res[key] = normalized[key];
        }
      }
    }
    return res;
  } else if (isString(value) || isObject(value)) {
    return value;
  }
}
var listDelimiterRE = /;(?![^(]*\))/g;
var propertyDelimiterRE = /:([^]+)/;
var styleCommentRE = /\/\*[^]*?\*\//g;
function parseStringStyle(cssText) {
  const ret = {};
  cssText.replace(styleCommentRE, "").split(listDelimiterRE).forEach((item) => {
    if (item) {
      const tmp = item.split(propertyDelimiterRE);
      tmp.length > 1 && (ret[tmp[0].trim()] = tmp[1].trim());
    }
  });
  return ret;
}
function normalizeClass(value) {
  let res = "";
  if (isString(value)) {
    res = value;
  } else if (isArray(value)) {
    for (let i2 = 0; i2 < value.length; i2++) {
      const normalized = normalizeClass(value[i2]);
      if (normalized) {
        res += normalized + " ";
      }
    }
  } else if (isObject(value)) {
    for (const name in value) {
      if (value[name]) {
        res += name + " ";
      }
    }
  }
  return res.trim();
}
var specialBooleanAttrs = `itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly`;
var isBooleanAttr = /* @__PURE__ */ makeMap(
  specialBooleanAttrs + `,async,autofocus,autoplay,controls,default,defer,disabled,hidden,inert,loop,open,required,reversed,scoped,seamless,checked,muted,multiple,selected`
);

// node_modules/@vue/reactivity/dist/reactivity.esm-bundler.js
function warn(msg, ...args) {
  console.warn(`[Vue warn] ${msg}`, ...args);
}
var activeEffectScope;
function getCurrentScope() {
  return activeEffectScope;
}
var activeSub;
var pausedQueueEffects = /* @__PURE__ */ new WeakSet();
var ReactiveEffect = class {
  constructor(fn) {
    this.fn = fn;
    this.deps = void 0;
    this.depsTail = void 0;
    this.flags = 1 | 4;
    this.next = void 0;
    this.cleanup = void 0;
    this.scheduler = void 0;
    if (activeEffectScope) {
      if (activeEffectScope.active) {
        activeEffectScope.effects.push(this);
      } else {
        this.flags &= -2;
      }
    }
  }
  pause() {
    this.flags |= 64;
  }
  resume() {
    if (this.flags & 64) {
      this.flags &= -65;
      if (pausedQueueEffects.has(this)) {
        pausedQueueEffects.delete(this);
        this.trigger();
      }
    }
  }
  /**
   * @internal
   */
  notify() {
    if (this.flags & 2 && !(this.flags & 32)) {
      return;
    }
    if (!(this.flags & 8)) {
      batch(this);
    }
  }
  run() {
    if (!(this.flags & 1)) {
      return this.fn();
    }
    this.flags |= 2;
    cleanupEffect(this);
    prepareDeps(this);
    const prevEffect = activeSub;
    const prevShouldTrack = shouldTrack;
    activeSub = this;
    shouldTrack = true;
    try {
      return this.fn();
    } finally {
      if (!!(process.env.NODE_ENV !== "production") && activeSub !== this) {
        warn(
          "Active effect was not restored correctly - this is likely a Vue internal bug."
        );
      }
      cleanupDeps(this);
      activeSub = prevEffect;
      shouldTrack = prevShouldTrack;
      this.flags &= -3;
    }
  }
  stop() {
    if (this.flags & 1) {
      for (let link = this.deps; link; link = link.nextDep) {
        removeSub(link);
      }
      this.deps = this.depsTail = void 0;
      cleanupEffect(this);
      this.onStop && this.onStop();
      this.flags &= -2;
    }
  }
  trigger() {
    if (this.flags & 64) {
      pausedQueueEffects.add(this);
    } else if (this.scheduler) {
      this.scheduler();
    } else {
      this.runIfDirty();
    }
  }
  /**
   * @internal
   */
  runIfDirty() {
    if (isDirty(this)) {
      this.run();
    }
  }
  get dirty() {
    return isDirty(this);
  }
};
var batchDepth = 0;
var batchedSub;
var batchedComputed;
function batch(sub, isComputed = false) {
  sub.flags |= 8;
  if (isComputed) {
    sub.next = batchedComputed;
    batchedComputed = sub;
    return;
  }
  sub.next = batchedSub;
  batchedSub = sub;
}
function startBatch() {
  batchDepth++;
}
function endBatch() {
  if (--batchDepth > 0) {
    return;
  }
  if (batchedComputed) {
    let e = batchedComputed;
    batchedComputed = void 0;
    while (e) {
      const next = e.next;
      e.next = void 0;
      e.flags &= -9;
      e = next;
    }
  }
  let error;
  while (batchedSub) {
    let e = batchedSub;
    batchedSub = void 0;
    while (e) {
      const next = e.next;
      e.next = void 0;
      e.flags &= -9;
      if (e.flags & 1) {
        try {
          ;
          e.trigger();
        } catch (err) {
          if (!error) error = err;
        }
      }
      e = next;
    }
  }
  if (error) throw error;
}
function prepareDeps(sub) {
  for (let link = sub.deps; link; link = link.nextDep) {
    link.version = -1;
    link.prevActiveLink = link.dep.activeLink;
    link.dep.activeLink = link;
  }
}
function cleanupDeps(sub) {
  let head;
  let tail = sub.depsTail;
  let link = tail;
  while (link) {
    const prev = link.prevDep;
    if (link.version === -1) {
      if (link === tail) tail = prev;
      removeSub(link);
      removeDep(link);
    } else {
      head = link;
    }
    link.dep.activeLink = link.prevActiveLink;
    link.prevActiveLink = void 0;
    link = prev;
  }
  sub.deps = head;
  sub.depsTail = tail;
}
function isDirty(sub) {
  for (let link = sub.deps; link; link = link.nextDep) {
    if (link.dep.version !== link.version || link.dep.computed && (refreshComputed(link.dep.computed) || link.dep.version !== link.version)) {
      return true;
    }
  }
  if (sub._dirty) {
    return true;
  }
  return false;
}
function refreshComputed(computed2) {
  if (computed2.flags & 4 && !(computed2.flags & 16)) {
    return;
  }
  computed2.flags &= -17;
  if (computed2.globalVersion === globalVersion) {
    return;
  }
  computed2.globalVersion = globalVersion;
  if (!computed2.isSSR && computed2.flags & 128 && (!computed2.deps && !computed2._dirty || !isDirty(computed2))) {
    return;
  }
  computed2.flags |= 2;
  const dep = computed2.dep;
  const prevSub = activeSub;
  const prevShouldTrack = shouldTrack;
  activeSub = computed2;
  shouldTrack = true;
  try {
    prepareDeps(computed2);
    const value = computed2.fn(computed2._value);
    if (dep.version === 0 || hasChanged(value, computed2._value)) {
      computed2.flags |= 128;
      computed2._value = value;
      dep.version++;
    }
  } catch (err) {
    dep.version++;
    throw err;
  } finally {
    activeSub = prevSub;
    shouldTrack = prevShouldTrack;
    cleanupDeps(computed2);
    computed2.flags &= -3;
  }
}
function removeSub(link, soft = false) {
  const { dep, prevSub, nextSub } = link;
  if (prevSub) {
    prevSub.nextSub = nextSub;
    link.prevSub = void 0;
  }
  if (nextSub) {
    nextSub.prevSub = prevSub;
    link.nextSub = void 0;
  }
  if (!!(process.env.NODE_ENV !== "production") && dep.subsHead === link) {
    dep.subsHead = nextSub;
  }
  if (dep.subs === link) {
    dep.subs = prevSub;
    if (!prevSub && dep.computed) {
      dep.computed.flags &= -5;
      for (let l = dep.computed.deps; l; l = l.nextDep) {
        removeSub(l, true);
      }
    }
  }
  if (!soft && !--dep.sc && dep.map) {
    dep.map.delete(dep.key);
  }
}
function removeDep(link) {
  const { prevDep, nextDep } = link;
  if (prevDep) {
    prevDep.nextDep = nextDep;
    link.prevDep = void 0;
  }
  if (nextDep) {
    nextDep.prevDep = prevDep;
    link.nextDep = void 0;
  }
}
var shouldTrack = true;
var trackStack = [];
function pauseTracking() {
  trackStack.push(shouldTrack);
  shouldTrack = false;
}
function resetTracking() {
  const last = trackStack.pop();
  shouldTrack = last === void 0 ? true : last;
}
function cleanupEffect(e) {
  const { cleanup } = e;
  e.cleanup = void 0;
  if (cleanup) {
    const prevSub = activeSub;
    activeSub = void 0;
    try {
      cleanup();
    } finally {
      activeSub = prevSub;
    }
  }
}
var globalVersion = 0;
var Link = class {
  constructor(sub, dep) {
    this.sub = sub;
    this.dep = dep;
    this.version = dep.version;
    this.nextDep = this.prevDep = this.nextSub = this.prevSub = this.prevActiveLink = void 0;
  }
};
var Dep = class {
  // TODO isolatedDeclarations "__v_skip"
  constructor(computed2) {
    this.computed = computed2;
    this.version = 0;
    this.activeLink = void 0;
    this.subs = void 0;
    this.map = void 0;
    this.key = void 0;
    this.sc = 0;
    this.__v_skip = true;
    if (!!(process.env.NODE_ENV !== "production")) {
      this.subsHead = void 0;
    }
  }
  track(debugInfo) {
    if (!activeSub || !shouldTrack || activeSub === this.computed) {
      return;
    }
    let link = this.activeLink;
    if (link === void 0 || link.sub !== activeSub) {
      link = this.activeLink = new Link(activeSub, this);
      if (!activeSub.deps) {
        activeSub.deps = activeSub.depsTail = link;
      } else {
        link.prevDep = activeSub.depsTail;
        activeSub.depsTail.nextDep = link;
        activeSub.depsTail = link;
      }
      addSub(link);
    } else if (link.version === -1) {
      link.version = this.version;
      if (link.nextDep) {
        const next = link.nextDep;
        next.prevDep = link.prevDep;
        if (link.prevDep) {
          link.prevDep.nextDep = next;
        }
        link.prevDep = activeSub.depsTail;
        link.nextDep = void 0;
        activeSub.depsTail.nextDep = link;
        activeSub.depsTail = link;
        if (activeSub.deps === link) {
          activeSub.deps = next;
        }
      }
    }
    if (!!(process.env.NODE_ENV !== "production") && activeSub.onTrack) {
      activeSub.onTrack(
        extend(
          {
            effect: activeSub
          },
          debugInfo
        )
      );
    }
    return link;
  }
  trigger(debugInfo) {
    this.version++;
    globalVersion++;
    this.notify(debugInfo);
  }
  notify(debugInfo) {
    startBatch();
    try {
      if (!!(process.env.NODE_ENV !== "production")) {
        for (let head = this.subsHead; head; head = head.nextSub) {
          if (head.sub.onTrigger && !(head.sub.flags & 8)) {
            head.sub.onTrigger(
              extend(
                {
                  effect: head.sub
                },
                debugInfo
              )
            );
          }
        }
      }
      for (let link = this.subs; link; link = link.prevSub) {
        if (link.sub.notify()) {
          ;
          link.sub.dep.notify();
        }
      }
    } finally {
      endBatch();
    }
  }
};
function addSub(link) {
  link.dep.sc++;
  if (link.sub.flags & 4) {
    const computed2 = link.dep.computed;
    if (computed2 && !link.dep.subs) {
      computed2.flags |= 4 | 16;
      for (let l = computed2.deps; l; l = l.nextDep) {
        addSub(l);
      }
    }
    const currentTail = link.dep.subs;
    if (currentTail !== link) {
      link.prevSub = currentTail;
      if (currentTail) currentTail.nextSub = link;
    }
    if (!!(process.env.NODE_ENV !== "production") && link.dep.subsHead === void 0) {
      link.dep.subsHead = link;
    }
    link.dep.subs = link;
  }
}
var targetMap = /* @__PURE__ */ new WeakMap();
var ITERATE_KEY = /* @__PURE__ */ Symbol(
  !!(process.env.NODE_ENV !== "production") ? "Object iterate" : ""
);
var MAP_KEY_ITERATE_KEY = /* @__PURE__ */ Symbol(
  !!(process.env.NODE_ENV !== "production") ? "Map keys iterate" : ""
);
var ARRAY_ITERATE_KEY = /* @__PURE__ */ Symbol(
  !!(process.env.NODE_ENV !== "production") ? "Array iterate" : ""
);
function track(target, type, key) {
  if (shouldTrack && activeSub) {
    let depsMap = targetMap.get(target);
    if (!depsMap) {
      targetMap.set(target, depsMap = /* @__PURE__ */ new Map());
    }
    let dep = depsMap.get(key);
    if (!dep) {
      depsMap.set(key, dep = new Dep());
      dep.map = depsMap;
      dep.key = key;
    }
    if (!!(process.env.NODE_ENV !== "production")) {
      dep.track({
        target,
        type,
        key
      });
    } else {
      dep.track();
    }
  }
}
function trigger(target, type, key, newValue, oldValue, oldTarget) {
  const depsMap = targetMap.get(target);
  if (!depsMap) {
    globalVersion++;
    return;
  }
  const run = (dep) => {
    if (dep) {
      if (!!(process.env.NODE_ENV !== "production")) {
        dep.trigger({
          target,
          type,
          key,
          newValue,
          oldValue,
          oldTarget
        });
      } else {
        dep.trigger();
      }
    }
  };
  startBatch();
  if (type === "clear") {
    depsMap.forEach(run);
  } else {
    const targetIsArray = isArray(target);
    const isArrayIndex = targetIsArray && isIntegerKey(key);
    if (targetIsArray && key === "length") {
      const newLength = Number(newValue);
      depsMap.forEach((dep, key2) => {
        if (key2 === "length" || key2 === ARRAY_ITERATE_KEY || !isSymbol(key2) && key2 >= newLength) {
          run(dep);
        }
      });
    } else {
      if (key !== void 0 || depsMap.has(void 0)) {
        run(depsMap.get(key));
      }
      if (isArrayIndex) {
        run(depsMap.get(ARRAY_ITERATE_KEY));
      }
      switch (type) {
        case "add":
          if (!targetIsArray) {
            run(depsMap.get(ITERATE_KEY));
            if (isMap(target)) {
              run(depsMap.get(MAP_KEY_ITERATE_KEY));
            }
          } else if (isArrayIndex) {
            run(depsMap.get("length"));
          }
          break;
        case "delete":
          if (!targetIsArray) {
            run(depsMap.get(ITERATE_KEY));
            if (isMap(target)) {
              run(depsMap.get(MAP_KEY_ITERATE_KEY));
            }
          }
          break;
        case "set":
          if (isMap(target)) {
            run(depsMap.get(ITERATE_KEY));
          }
          break;
      }
    }
  }
  endBatch();
}
function reactiveReadArray(array) {
  const raw = /* @__PURE__ */ toRaw(array);
  if (raw === array) return raw;
  track(raw, "iterate", ARRAY_ITERATE_KEY);
  return /* @__PURE__ */ isShallow(array) ? raw : raw.map(toReactive);
}
function shallowReadArray(arr) {
  track(arr = /* @__PURE__ */ toRaw(arr), "iterate", ARRAY_ITERATE_KEY);
  return arr;
}
function toWrapped(target, item) {
  if (/* @__PURE__ */ isReadonly(target)) {
    return /* @__PURE__ */ isReactive(target) ? toReadonly(toReactive(item)) : toReadonly(item);
  }
  return toReactive(item);
}
var arrayInstrumentations = {
  __proto__: null,
  [Symbol.iterator]() {
    return iterator(this, Symbol.iterator, (item) => toWrapped(this, item));
  },
  concat(...args) {
    return reactiveReadArray(this).concat(
      ...args.map((x) => isArray(x) ? reactiveReadArray(x) : x)
    );
  },
  entries() {
    return iterator(this, "entries", (value) => {
      value[1] = toWrapped(this, value[1]);
      return value;
    });
  },
  every(fn, thisArg) {
    return apply(this, "every", fn, thisArg, void 0, arguments);
  },
  filter(fn, thisArg) {
    return apply(
      this,
      "filter",
      fn,
      thisArg,
      (v) => v.map((item) => toWrapped(this, item)),
      arguments
    );
  },
  find(fn, thisArg) {
    return apply(
      this,
      "find",
      fn,
      thisArg,
      (item) => toWrapped(this, item),
      arguments
    );
  },
  findIndex(fn, thisArg) {
    return apply(this, "findIndex", fn, thisArg, void 0, arguments);
  },
  findLast(fn, thisArg) {
    return apply(
      this,
      "findLast",
      fn,
      thisArg,
      (item) => toWrapped(this, item),
      arguments
    );
  },
  findLastIndex(fn, thisArg) {
    return apply(this, "findLastIndex", fn, thisArg, void 0, arguments);
  },
  // flat, flatMap could benefit from ARRAY_ITERATE but are not straight-forward to implement
  forEach(fn, thisArg) {
    return apply(this, "forEach", fn, thisArg, void 0, arguments);
  },
  includes(...args) {
    return searchProxy(this, "includes", args);
  },
  indexOf(...args) {
    return searchProxy(this, "indexOf", args);
  },
  join(separator) {
    return reactiveReadArray(this).join(separator);
  },
  // keys() iterator only reads `length`, no optimization required
  lastIndexOf(...args) {
    return searchProxy(this, "lastIndexOf", args);
  },
  map(fn, thisArg) {
    return apply(this, "map", fn, thisArg, void 0, arguments);
  },
  pop() {
    return noTracking(this, "pop");
  },
  push(...args) {
    return noTracking(this, "push", args);
  },
  reduce(fn, ...args) {
    return reduce(this, "reduce", fn, args);
  },
  reduceRight(fn, ...args) {
    return reduce(this, "reduceRight", fn, args);
  },
  shift() {
    return noTracking(this, "shift");
  },
  // slice could use ARRAY_ITERATE but also seems to beg for range tracking
  some(fn, thisArg) {
    return apply(this, "some", fn, thisArg, void 0, arguments);
  },
  splice(...args) {
    return noTracking(this, "splice", args);
  },
  toReversed() {
    return reactiveReadArray(this).toReversed();
  },
  toSorted(comparer) {
    return reactiveReadArray(this).toSorted(comparer);
  },
  toSpliced(...args) {
    return reactiveReadArray(this).toSpliced(...args);
  },
  unshift(...args) {
    return noTracking(this, "unshift", args);
  },
  values() {
    return iterator(this, "values", (item) => toWrapped(this, item));
  }
};
function iterator(self2, method, wrapValue) {
  const arr = shallowReadArray(self2);
  const iter = arr[method]();
  if (arr !== self2 && !/* @__PURE__ */ isShallow(self2)) {
    iter._next = iter.next;
    iter.next = () => {
      const result = iter._next();
      if (!result.done) {
        result.value = wrapValue(result.value);
      }
      return result;
    };
  }
  return iter;
}
var arrayProto = Array.prototype;
function apply(self2, method, fn, thisArg, wrappedRetFn, args) {
  const arr = shallowReadArray(self2);
  const needsWrap = arr !== self2 && !/* @__PURE__ */ isShallow(self2);
  const methodFn = arr[method];
  if (methodFn !== arrayProto[method]) {
    const result2 = methodFn.apply(self2, args);
    return needsWrap ? toReactive(result2) : result2;
  }
  let wrappedFn = fn;
  if (arr !== self2) {
    if (needsWrap) {
      wrappedFn = function(item, index) {
        return fn.call(this, toWrapped(self2, item), index, self2);
      };
    } else if (fn.length > 2) {
      wrappedFn = function(item, index) {
        return fn.call(this, item, index, self2);
      };
    }
  }
  const result = methodFn.call(arr, wrappedFn, thisArg);
  return needsWrap && wrappedRetFn ? wrappedRetFn(result) : result;
}
function reduce(self2, method, fn, args) {
  const arr = shallowReadArray(self2);
  const needsWrap = arr !== self2 && !/* @__PURE__ */ isShallow(self2);
  let wrappedFn = fn;
  let wrapInitialAccumulator = false;
  if (arr !== self2) {
    if (needsWrap) {
      wrapInitialAccumulator = args.length === 0;
      wrappedFn = function(acc, item, index) {
        if (wrapInitialAccumulator) {
          wrapInitialAccumulator = false;
          acc = toWrapped(self2, acc);
        }
        return fn.call(this, acc, toWrapped(self2, item), index, self2);
      };
    } else if (fn.length > 3) {
      wrappedFn = function(acc, item, index) {
        return fn.call(this, acc, item, index, self2);
      };
    }
  }
  const result = arr[method](wrappedFn, ...args);
  return wrapInitialAccumulator ? toWrapped(self2, result) : result;
}
function searchProxy(self2, method, args) {
  const arr = /* @__PURE__ */ toRaw(self2);
  track(arr, "iterate", ARRAY_ITERATE_KEY);
  const res = arr[method](...args);
  if ((res === -1 || res === false) && /* @__PURE__ */ isProxy(args[0])) {
    args[0] = /* @__PURE__ */ toRaw(args[0]);
    return arr[method](...args);
  }
  return res;
}
function noTracking(self2, method, args = []) {
  pauseTracking();
  startBatch();
  const res = (/* @__PURE__ */ toRaw(self2))[method].apply(self2, args);
  endBatch();
  resetTracking();
  return res;
}
var isNonTrackableKeys = /* @__PURE__ */ makeMap(`__proto__,__v_isRef,__isVue`);
var builtInSymbols = new Set(
  /* @__PURE__ */ Object.getOwnPropertyNames(Symbol).filter((key) => key !== "arguments" && key !== "caller").map((key) => Symbol[key]).filter(isSymbol)
);
function hasOwnProperty2(key) {
  if (!isSymbol(key)) key = String(key);
  const obj = /* @__PURE__ */ toRaw(this);
  track(obj, "has", key);
  return obj.hasOwnProperty(key);
}
var BaseReactiveHandler = class {
  constructor(_isReadonly = false, _isShallow = false) {
    this._isReadonly = _isReadonly;
    this._isShallow = _isShallow;
  }
  get(target, key, receiver) {
    if (key === "__v_skip") return target["__v_skip"];
    const isReadonly2 = this._isReadonly, isShallow2 = this._isShallow;
    if (key === "__v_isReactive") {
      return !isReadonly2;
    } else if (key === "__v_isReadonly") {
      return isReadonly2;
    } else if (key === "__v_isShallow") {
      return isShallow2;
    } else if (key === "__v_raw") {
      if (receiver === (isReadonly2 ? isShallow2 ? shallowReadonlyMap : readonlyMap : isShallow2 ? shallowReactiveMap : reactiveMap).get(target) || // receiver is not the reactive proxy, but has the same prototype
      // this means the receiver is a user proxy of the reactive proxy
      Object.getPrototypeOf(target) === Object.getPrototypeOf(receiver)) {
        return target;
      }
      return;
    }
    const targetIsArray = isArray(target);
    if (!isReadonly2) {
      let fn;
      if (targetIsArray && (fn = arrayInstrumentations[key])) {
        return fn;
      }
      if (key === "hasOwnProperty") {
        return hasOwnProperty2;
      }
    }
    const res = Reflect.get(
      target,
      key,
      // if this is a proxy wrapping a ref, return methods using the raw ref
      // as receiver so that we don't have to call `toRaw` on the ref in all
      // its class methods
      /* @__PURE__ */ isRef(target) ? target : receiver
    );
    if (isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) {
      return res;
    }
    if (!isReadonly2) {
      track(target, "get", key);
    }
    if (isShallow2) {
      return res;
    }
    if (/* @__PURE__ */ isRef(res)) {
      const value = targetIsArray && isIntegerKey(key) ? res : res.value;
      return isReadonly2 && isObject(value) ? /* @__PURE__ */ readonly(value) : value;
    }
    if (isObject(res)) {
      return isReadonly2 ? /* @__PURE__ */ readonly(res) : /* @__PURE__ */ reactive(res);
    }
    return res;
  }
};
var MutableReactiveHandler = class extends BaseReactiveHandler {
  constructor(isShallow2 = false) {
    super(false, isShallow2);
  }
  set(target, key, value, receiver) {
    let oldValue = target[key];
    const isArrayWithIntegerKey = isArray(target) && isIntegerKey(key);
    if (!this._isShallow) {
      const isOldValueReadonly = /* @__PURE__ */ isReadonly(oldValue);
      if (!/* @__PURE__ */ isShallow(value) && !/* @__PURE__ */ isReadonly(value)) {
        oldValue = /* @__PURE__ */ toRaw(oldValue);
        value = /* @__PURE__ */ toRaw(value);
      }
      if (!isArrayWithIntegerKey && /* @__PURE__ */ isRef(oldValue) && !/* @__PURE__ */ isRef(value)) {
        if (isOldValueReadonly) {
          if (!!(process.env.NODE_ENV !== "production")) {
            warn(
              `Set operation on key "${String(key)}" failed: target is readonly.`,
              target[key]
            );
          }
          return true;
        } else {
          oldValue.value = value;
          return true;
        }
      }
    }
    const hadKey = isArrayWithIntegerKey ? Number(key) < target.length : hasOwn(target, key);
    const result = Reflect.set(
      target,
      key,
      value,
      /* @__PURE__ */ isRef(target) ? target : receiver
    );
    if (target === /* @__PURE__ */ toRaw(receiver) && result) {
      if (!hadKey) {
        trigger(target, "add", key, value);
      } else if (hasChanged(value, oldValue)) {
        trigger(target, "set", key, value, oldValue);
      }
    }
    return result;
  }
  deleteProperty(target, key) {
    const hadKey = hasOwn(target, key);
    const oldValue = target[key];
    const result = Reflect.deleteProperty(target, key);
    if (result && hadKey) {
      trigger(target, "delete", key, void 0, oldValue);
    }
    return result;
  }
  has(target, key) {
    const result = Reflect.has(target, key);
    if (!isSymbol(key) || !builtInSymbols.has(key)) {
      track(target, "has", key);
    }
    return result;
  }
  ownKeys(target) {
    track(
      target,
      "iterate",
      isArray(target) ? "length" : ITERATE_KEY
    );
    return Reflect.ownKeys(target);
  }
};
var ReadonlyReactiveHandler = class extends BaseReactiveHandler {
  constructor(isShallow2 = false) {
    super(true, isShallow2);
  }
  set(target, key) {
    if (!!(process.env.NODE_ENV !== "production")) {
      warn(
        `Set operation on key "${String(key)}" failed: target is readonly.`,
        target
      );
    }
    return true;
  }
  deleteProperty(target, key) {
    if (!!(process.env.NODE_ENV !== "production")) {
      warn(
        `Delete operation on key "${String(key)}" failed: target is readonly.`,
        target
      );
    }
    return true;
  }
};
var mutableHandlers = /* @__PURE__ */ new MutableReactiveHandler();
var readonlyHandlers = /* @__PURE__ */ new ReadonlyReactiveHandler();
var shallowReadonlyHandlers = /* @__PURE__ */ new ReadonlyReactiveHandler(true);
var toShallow = (value) => value;
var getProto = (v) => Reflect.getPrototypeOf(v);
function createIterableMethod(method, isReadonly2, isShallow2) {
  return function(...args) {
    const target = this["__v_raw"];
    const rawTarget = /* @__PURE__ */ toRaw(target);
    const targetIsMap = isMap(rawTarget);
    const isPair = method === "entries" || method === Symbol.iterator && targetIsMap;
    const isKeyOnly = method === "keys" && targetIsMap;
    const innerIterator = target[method](...args);
    const wrap = isShallow2 ? toShallow : isReadonly2 ? toReadonly : toReactive;
    !isReadonly2 && track(
      rawTarget,
      "iterate",
      isKeyOnly ? MAP_KEY_ITERATE_KEY : ITERATE_KEY
    );
    return extend(
      // inheriting all iterator properties
      Object.create(innerIterator),
      {
        // iterator protocol
        next() {
          const { value, done } = innerIterator.next();
          return done ? { value, done } : {
            value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value),
            done
          };
        }
      }
    );
  };
}
function createReadonlyMethod(type) {
  return function(...args) {
    if (!!(process.env.NODE_ENV !== "production")) {
      const key = args[0] ? `on key "${args[0]}" ` : ``;
      warn(
        `${capitalize(type)} operation ${key}failed: target is readonly.`,
        /* @__PURE__ */ toRaw(this)
      );
    }
    return type === "delete" ? false : type === "clear" ? void 0 : this;
  };
}
function createInstrumentations(readonly2, shallow) {
  const instrumentations = {
    get(key) {
      const target = this["__v_raw"];
      const rawTarget = /* @__PURE__ */ toRaw(target);
      const rawKey = /* @__PURE__ */ toRaw(key);
      if (!readonly2) {
        if (hasChanged(key, rawKey)) {
          track(rawTarget, "get", key);
        }
        track(rawTarget, "get", rawKey);
      }
      const { has } = getProto(rawTarget);
      const wrap = shallow ? toShallow : readonly2 ? toReadonly : toReactive;
      if (has.call(rawTarget, key)) {
        return wrap(target.get(key));
      } else if (has.call(rawTarget, rawKey)) {
        return wrap(target.get(rawKey));
      } else if (target !== rawTarget) {
        target.get(key);
      }
    },
    get size() {
      const target = this["__v_raw"];
      !readonly2 && track(/* @__PURE__ */ toRaw(target), "iterate", ITERATE_KEY);
      return target.size;
    },
    has(key) {
      const target = this["__v_raw"];
      const rawTarget = /* @__PURE__ */ toRaw(target);
      const rawKey = /* @__PURE__ */ toRaw(key);
      if (!readonly2) {
        if (hasChanged(key, rawKey)) {
          track(rawTarget, "has", key);
        }
        track(rawTarget, "has", rawKey);
      }
      return key === rawKey ? target.has(key) : target.has(key) || target.has(rawKey);
    },
    forEach(callback, thisArg) {
      const observed = this;
      const target = observed["__v_raw"];
      const rawTarget = /* @__PURE__ */ toRaw(target);
      const wrap = shallow ? toShallow : readonly2 ? toReadonly : toReactive;
      !readonly2 && track(rawTarget, "iterate", ITERATE_KEY);
      return target.forEach((value, key) => {
        return callback.call(thisArg, wrap(value), wrap(key), observed);
      });
    }
  };
  extend(
    instrumentations,
    readonly2 ? {
      add: createReadonlyMethod("add"),
      set: createReadonlyMethod("set"),
      delete: createReadonlyMethod("delete"),
      clear: createReadonlyMethod("clear")
    } : {
      add(value) {
        const target = /* @__PURE__ */ toRaw(this);
        const proto = getProto(target);
        const rawValue = /* @__PURE__ */ toRaw(value);
        const valueToAdd = !shallow && !/* @__PURE__ */ isShallow(value) && !/* @__PURE__ */ isReadonly(value) ? rawValue : value;
        const hadKey = proto.has.call(target, valueToAdd) || hasChanged(value, valueToAdd) && proto.has.call(target, value) || hasChanged(rawValue, valueToAdd) && proto.has.call(target, rawValue);
        if (!hadKey) {
          target.add(valueToAdd);
          trigger(target, "add", valueToAdd, valueToAdd);
        }
        return this;
      },
      set(key, value) {
        if (!shallow && !/* @__PURE__ */ isShallow(value) && !/* @__PURE__ */ isReadonly(value)) {
          value = /* @__PURE__ */ toRaw(value);
        }
        const target = /* @__PURE__ */ toRaw(this);
        const { has, get } = getProto(target);
        let hadKey = has.call(target, key);
        if (!hadKey) {
          key = /* @__PURE__ */ toRaw(key);
          hadKey = has.call(target, key);
        } else if (!!(process.env.NODE_ENV !== "production")) {
          checkIdentityKeys(target, has, key);
        }
        const oldValue = get.call(target, key);
        target.set(key, value);
        if (!hadKey) {
          trigger(target, "add", key, value);
        } else if (hasChanged(value, oldValue)) {
          trigger(target, "set", key, value, oldValue);
        }
        return this;
      },
      delete(key) {
        const target = /* @__PURE__ */ toRaw(this);
        const { has, get } = getProto(target);
        let hadKey = has.call(target, key);
        if (!hadKey) {
          key = /* @__PURE__ */ toRaw(key);
          hadKey = has.call(target, key);
        } else if (!!(process.env.NODE_ENV !== "production")) {
          checkIdentityKeys(target, has, key);
        }
        const oldValue = get ? get.call(target, key) : void 0;
        const result = target.delete(key);
        if (hadKey) {
          trigger(target, "delete", key, void 0, oldValue);
        }
        return result;
      },
      clear() {
        const target = /* @__PURE__ */ toRaw(this);
        const hadItems = target.size !== 0;
        const oldTarget = !!(process.env.NODE_ENV !== "production") ? isMap(target) ? new Map(target) : new Set(target) : void 0;
        const result = target.clear();
        if (hadItems) {
          trigger(
            target,
            "clear",
            void 0,
            void 0,
            oldTarget
          );
        }
        return result;
      }
    }
  );
  const iteratorMethods = [
    "keys",
    "values",
    "entries",
    Symbol.iterator
  ];
  iteratorMethods.forEach((method) => {
    instrumentations[method] = createIterableMethod(method, readonly2, shallow);
  });
  return instrumentations;
}
function createInstrumentationGetter(isReadonly2, shallow) {
  const instrumentations = createInstrumentations(isReadonly2, shallow);
  return (target, key, receiver) => {
    if (key === "__v_isReactive") {
      return !isReadonly2;
    } else if (key === "__v_isReadonly") {
      return isReadonly2;
    } else if (key === "__v_raw") {
      return target;
    }
    return Reflect.get(
      hasOwn(instrumentations, key) && key in target ? instrumentations : target,
      key,
      receiver
    );
  };
}
var mutableCollectionHandlers = {
  get: /* @__PURE__ */ createInstrumentationGetter(false, false)
};
var readonlyCollectionHandlers = {
  get: /* @__PURE__ */ createInstrumentationGetter(true, false)
};
var shallowReadonlyCollectionHandlers = {
  get: /* @__PURE__ */ createInstrumentationGetter(true, true)
};
function checkIdentityKeys(target, has, key) {
  const rawKey = /* @__PURE__ */ toRaw(key);
  if (rawKey !== key && has.call(target, rawKey)) {
    const type = toRawType(target);
    warn(
      `Reactive ${type} contains both the raw and reactive versions of the same object${type === `Map` ? ` as keys` : ``}, which can lead to inconsistencies. Avoid differentiating between the raw and reactive versions of an object and only use the reactive version if possible.`
    );
  }
}
var reactiveMap = /* @__PURE__ */ new WeakMap();
var shallowReactiveMap = /* @__PURE__ */ new WeakMap();
var readonlyMap = /* @__PURE__ */ new WeakMap();
var shallowReadonlyMap = /* @__PURE__ */ new WeakMap();
function targetTypeMap(rawType) {
  switch (rawType) {
    case "Object":
    case "Array":
      return 1;
    case "Map":
    case "Set":
    case "WeakMap":
    case "WeakSet":
      return 2;
    default:
      return 0;
  }
}
// @__NO_SIDE_EFFECTS__
function reactive(target) {
  if (/* @__PURE__ */ isReadonly(target)) {
    return target;
  }
  return createReactiveObject(
    target,
    false,
    mutableHandlers,
    mutableCollectionHandlers,
    reactiveMap
  );
}
// @__NO_SIDE_EFFECTS__
function readonly(target) {
  return createReactiveObject(
    target,
    true,
    readonlyHandlers,
    readonlyCollectionHandlers,
    readonlyMap
  );
}
// @__NO_SIDE_EFFECTS__
function shallowReadonly(target) {
  return createReactiveObject(
    target,
    true,
    shallowReadonlyHandlers,
    shallowReadonlyCollectionHandlers,
    shallowReadonlyMap
  );
}
function createReactiveObject(target, isReadonly2, baseHandlers, collectionHandlers, proxyMap) {
  if (!isObject(target)) {
    if (!!(process.env.NODE_ENV !== "production")) {
      warn(
        `value cannot be made ${isReadonly2 ? "readonly" : "reactive"}: ${String(
          target
        )}`
      );
    }
    return target;
  }
  if (target["__v_raw"] && !(isReadonly2 && target["__v_isReactive"])) {
    return target;
  }
  if (target["__v_skip"] || !Object.isExtensible(target)) {
    return target;
  }
  const existingProxy = proxyMap.get(target);
  if (existingProxy) {
    return existingProxy;
  }
  const targetType = targetTypeMap(toRawType(target));
  if (targetType === 0) {
    return target;
  }
  const proxy = new Proxy(
    target,
    targetType === 2 ? collectionHandlers : baseHandlers
  );
  proxyMap.set(target, proxy);
  return proxy;
}
// @__NO_SIDE_EFFECTS__
function isReactive(value) {
  if (/* @__PURE__ */ isReadonly(value)) {
    return /* @__PURE__ */ isReactive(value["__v_raw"]);
  }
  return !!(value && value["__v_isReactive"]);
}
// @__NO_SIDE_EFFECTS__
function isReadonly(value) {
  return !!(value && value["__v_isReadonly"]);
}
// @__NO_SIDE_EFFECTS__
function isShallow(value) {
  return !!(value && value["__v_isShallow"]);
}
// @__NO_SIDE_EFFECTS__
function isProxy(value) {
  return value ? !!value["__v_raw"] : false;
}
// @__NO_SIDE_EFFECTS__
function toRaw(observed) {
  const raw = observed && observed["__v_raw"];
  return raw ? /* @__PURE__ */ toRaw(raw) : observed;
}
function markRaw(value) {
  if (!hasOwn(value, "__v_skip") && Object.isExtensible(value)) {
    def(value, "__v_skip", true);
  }
  return value;
}
var toReactive = (value) => isObject(value) ? /* @__PURE__ */ reactive(value) : value;
var toReadonly = (value) => isObject(value) ? /* @__PURE__ */ readonly(value) : value;
// @__NO_SIDE_EFFECTS__
function isRef(r) {
  return r ? r["__v_isRef"] === true : false;
}
function unref(ref2) {
  return /* @__PURE__ */ isRef(ref2) ? ref2.value : ref2;
}
var shallowUnwrapHandlers = {
  get: (target, key, receiver) => key === "__v_raw" ? target : unref(Reflect.get(target, key, receiver)),
  set: (target, key, value, receiver) => {
    const oldValue = target[key];
    if (/* @__PURE__ */ isRef(oldValue) && !/* @__PURE__ */ isRef(value)) {
      oldValue.value = value;
      return true;
    } else {
      return Reflect.set(target, key, value, receiver);
    }
  }
};
function proxyRefs(objectWithRefs) {
  return /* @__PURE__ */ isReactive(objectWithRefs) ? objectWithRefs : new Proxy(objectWithRefs, shallowUnwrapHandlers);
}
var INITIAL_WATCHER_VALUE = {};
var cleanupMap = /* @__PURE__ */ new WeakMap();
var activeWatcher = void 0;
function onWatcherCleanup(cleanupFn, failSilently = false, owner = activeWatcher) {
  if (owner) {
    let cleanups = cleanupMap.get(owner);
    if (!cleanups) cleanupMap.set(owner, cleanups = []);
    cleanups.push(cleanupFn);
  } else if (!!(process.env.NODE_ENV !== "production") && !failSilently) {
    warn(
      `onWatcherCleanup() was called when there was no active watcher to associate with.`
    );
  }
}
function watch(source, cb, options = EMPTY_OBJ) {
  const { immediate, deep, once, scheduler, augmentJob, call } = options;
  const warnInvalidSource = (s) => {
    (options.onWarn || warn)(
      `Invalid watch source: `,
      s,
      `A watch source can only be a getter/effect function, a ref, a reactive object, or an array of these types.`
    );
  };
  const reactiveGetter = (source2) => {
    if (deep) return source2;
    if (/* @__PURE__ */ isShallow(source2) || deep === false || deep === 0)
      return traverse(source2, 1);
    return traverse(source2);
  };
  let effect2;
  let getter;
  let cleanup;
  let boundCleanup;
  let forceTrigger = false;
  let isMultiSource = false;
  if (/* @__PURE__ */ isRef(source)) {
    getter = () => source.value;
    forceTrigger = /* @__PURE__ */ isShallow(source);
  } else if (/* @__PURE__ */ isReactive(source)) {
    getter = () => reactiveGetter(source);
    forceTrigger = true;
  } else if (isArray(source)) {
    isMultiSource = true;
    forceTrigger = source.some((s) => /* @__PURE__ */ isReactive(s) || /* @__PURE__ */ isShallow(s));
    getter = () => source.map((s) => {
      if (/* @__PURE__ */ isRef(s)) {
        return s.value;
      } else if (/* @__PURE__ */ isReactive(s)) {
        return reactiveGetter(s);
      } else if (isFunction(s)) {
        return call ? call(s, 2) : s();
      } else {
        !!(process.env.NODE_ENV !== "production") && warnInvalidSource(s);
      }
    });
  } else if (isFunction(source)) {
    if (cb) {
      getter = call ? () => call(source, 2) : source;
    } else {
      getter = () => {
        if (cleanup) {
          pauseTracking();
          try {
            cleanup();
          } finally {
            resetTracking();
          }
        }
        const currentEffect = activeWatcher;
        activeWatcher = effect2;
        try {
          return call ? call(source, 3, [boundCleanup]) : source(boundCleanup);
        } finally {
          activeWatcher = currentEffect;
        }
      };
    }
  } else {
    getter = NOOP;
    !!(process.env.NODE_ENV !== "production") && warnInvalidSource(source);
  }
  if (cb && deep) {
    const baseGetter = getter;
    const depth = deep === true ? Infinity : deep;
    getter = () => traverse(baseGetter(), depth);
  }
  const scope = getCurrentScope();
  const watchHandle = () => {
    effect2.stop();
    if (scope && scope.active) {
      remove(scope.effects, effect2);
    }
  };
  if (once && cb) {
    const _cb = cb;
    cb = (...args) => {
      const res = _cb(...args);
      watchHandle();
      return res;
    };
  }
  let oldValue = isMultiSource ? new Array(source.length).fill(INITIAL_WATCHER_VALUE) : INITIAL_WATCHER_VALUE;
  const job = (immediateFirstRun) => {
    if (!(effect2.flags & 1) || !effect2.dirty && !immediateFirstRun) {
      return;
    }
    if (cb) {
      const newValue = effect2.run();
      if (immediateFirstRun || deep || forceTrigger || (isMultiSource ? newValue.some((v, i2) => hasChanged(v, oldValue[i2])) : hasChanged(newValue, oldValue))) {
        if (cleanup) {
          cleanup();
        }
        const currentWatcher = activeWatcher;
        activeWatcher = effect2;
        try {
          const args = [
            newValue,
            // pass undefined as the old value when it's changed for the first time
            oldValue === INITIAL_WATCHER_VALUE ? void 0 : isMultiSource && oldValue[0] === INITIAL_WATCHER_VALUE ? [] : oldValue,
            boundCleanup
          ];
          oldValue = newValue;
          call ? call(cb, 3, args) : (
            // @ts-expect-error
            cb(...args)
          );
        } finally {
          activeWatcher = currentWatcher;
        }
      }
    } else {
      effect2.run();
    }
  };
  if (augmentJob) {
    augmentJob(job);
  }
  effect2 = new ReactiveEffect(getter);
  effect2.scheduler = scheduler ? () => scheduler(job, false) : job;
  boundCleanup = (fn) => onWatcherCleanup(fn, false, effect2);
  cleanup = effect2.onStop = () => {
    const cleanups = cleanupMap.get(effect2);
    if (cleanups) {
      if (call) {
        call(cleanups, 4);
      } else {
        for (const cleanup2 of cleanups) cleanup2();
      }
      cleanupMap.delete(effect2);
    }
  };
  if (!!(process.env.NODE_ENV !== "production")) {
    effect2.onTrack = options.onTrack;
    effect2.onTrigger = options.onTrigger;
  }
  if (cb) {
    if (immediate) {
      job(true);
    } else {
      oldValue = effect2.run();
    }
  } else if (scheduler) {
    scheduler(job.bind(null, true), true);
  } else {
    effect2.run();
  }
  watchHandle.pause = effect2.pause.bind(effect2);
  watchHandle.resume = effect2.resume.bind(effect2);
  watchHandle.stop = watchHandle;
  return watchHandle;
}
function traverse(value, depth = Infinity, seen) {
  if (depth <= 0 || !isObject(value) || value["__v_skip"]) {
    return value;
  }
  seen = seen || /* @__PURE__ */ new Map();
  if ((seen.get(value) || 0) >= depth) {
    return value;
  }
  seen.set(value, depth);
  depth--;
  if (/* @__PURE__ */ isRef(value)) {
    traverse(value.value, depth, seen);
  } else if (isArray(value)) {
    for (let i2 = 0; i2 < value.length; i2++) {
      traverse(value[i2], depth, seen);
    }
  } else if (isSet(value) || isMap(value)) {
    value.forEach((v) => {
      traverse(v, depth, seen);
    });
  } else if (isPlainObject(value)) {
    for (const key in value) {
      traverse(value[key], depth, seen);
    }
    for (const key of Object.getOwnPropertySymbols(value)) {
      if (Object.prototype.propertyIsEnumerable.call(value, key)) {
        traverse(value[key], depth, seen);
      }
    }
  }
  return value;
}

// node_modules/@vue/runtime-core/dist/runtime-core.esm-bundler.js
var stack = [];
function pushWarningContext(vnode) {
  stack.push(vnode);
}
function popWarningContext() {
  stack.pop();
}
var isWarning = false;
function warn$1(msg, ...args) {
  if (isWarning) return;
  isWarning = true;
  pauseTracking();
  const instance = stack.length ? stack[stack.length - 1].component : null;
  const appWarnHandler = instance && instance.appContext.config.warnHandler;
  const trace = getComponentTrace();
  if (appWarnHandler) {
    callWithErrorHandling(
      appWarnHandler,
      instance,
      11,
      [
        // eslint-disable-next-line no-restricted-syntax
        msg + args.map((a) => {
          var _a, _b;
          return (_b = (_a = a.toString) == null ? void 0 : _a.call(a)) != null ? _b : JSON.stringify(a);
        }).join(""),
        instance && instance.proxy,
        trace.map(
          ({ vnode }) => `at <${formatComponentName(instance, vnode.type)}>`
        ).join("\n"),
        trace
      ]
    );
  } else {
    const warnArgs = [`[Vue warn]: ${msg}`, ...args];
    if (trace.length && // avoid spamming console during tests
    true) {
      warnArgs.push(`
`, ...formatTrace(trace));
    }
    console.warn(...warnArgs);
  }
  resetTracking();
  isWarning = false;
}
function getComponentTrace() {
  let currentVNode = stack[stack.length - 1];
  if (!currentVNode) {
    return [];
  }
  const normalizedStack = [];
  while (currentVNode) {
    const last = normalizedStack[0];
    if (last && last.vnode === currentVNode) {
      last.recurseCount++;
    } else {
      normalizedStack.push({
        vnode: currentVNode,
        recurseCount: 0
      });
    }
    const parentInstance = currentVNode.component && currentVNode.component.parent;
    currentVNode = parentInstance && parentInstance.vnode;
  }
  return normalizedStack;
}
function formatTrace(trace) {
  const logs = [];
  trace.forEach((entry, i2) => {
    logs.push(...i2 === 0 ? [] : [`
`], ...formatTraceEntry(entry));
  });
  return logs;
}
function formatTraceEntry({ vnode, recurseCount }) {
  const postfix = recurseCount > 0 ? `... (${recurseCount} recursive calls)` : ``;
  const isRoot = vnode.component ? vnode.component.parent == null : false;
  const open = ` at <${formatComponentName(
    vnode.component,
    vnode.type,
    isRoot
  )}`;
  const close = `>` + postfix;
  return vnode.props ? [open, ...formatProps(vnode.props), close] : [open + close];
}
function formatProps(props) {
  const res = [];
  const keys = Object.keys(props);
  keys.slice(0, 3).forEach((key) => {
    res.push(...formatProp(key, props[key]));
  });
  if (keys.length > 3) {
    res.push(` ...`);
  }
  return res;
}
function formatProp(key, value, raw) {
  if (isString(value)) {
    value = JSON.stringify(value);
    return raw ? value : [`${key}=${value}`];
  } else if (typeof value === "number" || typeof value === "boolean" || value == null) {
    return raw ? value : [`${key}=${value}`];
  } else if (isRef(value)) {
    value = formatProp(key, toRaw(value.value), true);
    return raw ? value : [`${key}=Ref<`, value, `>`];
  } else if (isFunction(value)) {
    return [`${key}=fn${value.name ? `<${value.name}>` : ``}`];
  } else {
    value = toRaw(value);
    return raw ? value : [`${key}=`, value];
  }
}
var ErrorTypeStrings$1 = {
  ["sp"]: "serverPrefetch hook",
  ["bc"]: "beforeCreate hook",
  ["c"]: "created hook",
  ["bm"]: "beforeMount hook",
  ["m"]: "mounted hook",
  ["bu"]: "beforeUpdate hook",
  ["u"]: "updated",
  ["bum"]: "beforeUnmount hook",
  ["um"]: "unmounted hook",
  ["a"]: "activated hook",
  ["da"]: "deactivated hook",
  ["ec"]: "errorCaptured hook",
  ["rtc"]: "renderTracked hook",
  ["rtg"]: "renderTriggered hook",
  [0]: "setup function",
  [1]: "render function",
  [2]: "watcher getter",
  [3]: "watcher callback",
  [4]: "watcher cleanup function",
  [5]: "native event handler",
  [6]: "component event handler",
  [7]: "vnode hook",
  [8]: "directive hook",
  [9]: "transition hook",
  [10]: "app errorHandler",
  [11]: "app warnHandler",
  [12]: "ref function",
  [13]: "async component loader",
  [14]: "scheduler flush",
  [15]: "component update",
  [16]: "app unmount cleanup function"
};
function callWithErrorHandling(fn, instance, type, args) {
  try {
    return args ? fn(...args) : fn();
  } catch (err) {
    handleError(err, instance, type);
  }
}
function callWithAsyncErrorHandling(fn, instance, type, args) {
  if (isFunction(fn)) {
    const res = callWithErrorHandling(fn, instance, type, args);
    if (res && isPromise(res)) {
      res.catch((err) => {
        handleError(err, instance, type);
      });
    }
    return res;
  }
  if (isArray(fn)) {
    const values = [];
    for (let i2 = 0; i2 < fn.length; i2++) {
      values.push(callWithAsyncErrorHandling(fn[i2], instance, type, args));
    }
    return values;
  } else if (!!(process.env.NODE_ENV !== "production")) {
    warn$1(
      `Invalid value type passed to callWithAsyncErrorHandling(): ${typeof fn}`
    );
  }
}
function handleError(err, instance, type, throwInDev = true) {
  const contextVNode = instance ? instance.vnode : null;
  const { errorHandler, throwUnhandledErrorInProduction } = instance && instance.appContext.config || EMPTY_OBJ;
  if (instance) {
    let cur = instance.parent;
    const exposedInstance = instance.proxy;
    const errorInfo = !!(process.env.NODE_ENV !== "production") ? ErrorTypeStrings$1[type] : `https://vuejs.org/error-reference/#runtime-${type}`;
    while (cur) {
      const errorCapturedHooks = cur.ec;
      if (errorCapturedHooks) {
        for (let i2 = 0; i2 < errorCapturedHooks.length; i2++) {
          if (errorCapturedHooks[i2](err, exposedInstance, errorInfo) === false) {
            return;
          }
        }
      }
      cur = cur.parent;
    }
    if (errorHandler) {
      pauseTracking();
      callWithErrorHandling(errorHandler, null, 10, [
        err,
        exposedInstance,
        errorInfo
      ]);
      resetTracking();
      return;
    }
  }
  logError(err, type, contextVNode, throwInDev, throwUnhandledErrorInProduction);
}
function logError(err, type, contextVNode, throwInDev = true, throwInProd = false) {
  if (!!(process.env.NODE_ENV !== "production")) {
    const info = ErrorTypeStrings$1[type];
    if (contextVNode) {
      pushWarningContext(contextVNode);
    }
    warn$1(`Unhandled error${info ? ` during execution of ${info}` : ``}`);
    if (contextVNode) {
      popWarningContext();
    }
    if (throwInDev) {
      throw err;
    } else {
      console.error(err);
    }
  } else if (throwInProd) {
    throw err;
  } else {
    console.error(err);
  }
}
var queue = [];
var flushIndex = -1;
var pendingPostFlushCbs = [];
var activePostFlushCbs = null;
var postFlushIndex = 0;
var resolvedPromise = /* @__PURE__ */ Promise.resolve();
var currentFlushPromise = null;
var RECURSION_LIMIT = 100;
function nextTick(fn) {
  const p = currentFlushPromise || resolvedPromise;
  return fn ? p.then(this ? fn.bind(this) : fn) : p;
}
function findInsertionIndex(id) {
  let start = flushIndex + 1;
  let end = queue.length;
  while (start < end) {
    const middle = start + end >>> 1;
    const middleJob = queue[middle];
    const middleJobId = getId(middleJob);
    if (middleJobId < id || middleJobId === id && middleJob.flags & 2) {
      start = middle + 1;
    } else {
      end = middle;
    }
  }
  return start;
}
function queueJob(job) {
  if (!(job.flags & 1)) {
    const jobId = getId(job);
    const lastJob = queue[queue.length - 1];
    if (!lastJob || // fast path when the job id is larger than the tail
    !(job.flags & 2) && jobId >= getId(lastJob)) {
      queue.push(job);
    } else {
      queue.splice(findInsertionIndex(jobId), 0, job);
    }
    job.flags |= 1;
    queueFlush();
  }
}
function queueFlush() {
  if (!currentFlushPromise) {
    currentFlushPromise = resolvedPromise.then(flushJobs);
  }
}
function queuePostFlushCb(cb) {
  if (!isArray(cb)) {
    if (activePostFlushCbs && cb.id === -1) {
      activePostFlushCbs.splice(postFlushIndex + 1, 0, cb);
    } else if (!(cb.flags & 1)) {
      pendingPostFlushCbs.push(cb);
      cb.flags |= 1;
    }
  } else {
    pendingPostFlushCbs.push(...cb);
  }
  queueFlush();
}
function flushPostFlushCbs(seen) {
  if (pendingPostFlushCbs.length) {
    const deduped = [...new Set(pendingPostFlushCbs)].sort(
      (a, b) => getId(a) - getId(b)
    );
    pendingPostFlushCbs.length = 0;
    if (activePostFlushCbs) {
      activePostFlushCbs.push(...deduped);
      return;
    }
    activePostFlushCbs = deduped;
    if (!!(process.env.NODE_ENV !== "production")) {
      seen = seen || /* @__PURE__ */ new Map();
    }
    for (postFlushIndex = 0; postFlushIndex < activePostFlushCbs.length; postFlushIndex++) {
      const cb = activePostFlushCbs[postFlushIndex];
      if (!!(process.env.NODE_ENV !== "production") && checkRecursiveUpdates(seen, cb)) {
        continue;
      }
      if (cb.flags & 4) {
        cb.flags &= -2;
      }
      if (!(cb.flags & 8)) cb();
      cb.flags &= -2;
    }
    activePostFlushCbs = null;
    postFlushIndex = 0;
  }
}
var getId = (job) => job.id == null ? job.flags & 2 ? -1 : Infinity : job.id;
function flushJobs(seen) {
  if (!!(process.env.NODE_ENV !== "production")) {
    seen = seen || /* @__PURE__ */ new Map();
  }
  const check = !!(process.env.NODE_ENV !== "production") ? (job) => checkRecursiveUpdates(seen, job) : NOOP;
  try {
    for (flushIndex = 0; flushIndex < queue.length; flushIndex++) {
      const job = queue[flushIndex];
      if (job && !(job.flags & 8)) {
        if (!!(process.env.NODE_ENV !== "production") && check(job)) {
          continue;
        }
        if (job.flags & 4) {
          job.flags &= ~1;
        }
        callWithErrorHandling(
          job,
          job.i,
          job.i ? 15 : 14
        );
        if (!(job.flags & 4)) {
          job.flags &= ~1;
        }
      }
    }
  } finally {
    for (; flushIndex < queue.length; flushIndex++) {
      const job = queue[flushIndex];
      if (job) {
        job.flags &= -2;
      }
    }
    flushIndex = -1;
    queue.length = 0;
    flushPostFlushCbs(seen);
    currentFlushPromise = null;
    if (queue.length || pendingPostFlushCbs.length) {
      flushJobs(seen);
    }
  }
}
function checkRecursiveUpdates(seen, fn) {
  const count = seen.get(fn) || 0;
  if (count > RECURSION_LIMIT) {
    const instance = fn.i;
    const componentName = instance && getComponentName(instance.type);
    handleError(
      `Maximum recursive updates exceeded${componentName ? ` in component <${componentName}>` : ``}. This means you have a reactive effect that is mutating its own dependencies and thus recursively triggering itself. Possible sources include component template, render function, updated hook or watcher source function.`,
      null,
      10
    );
    return true;
  }
  seen.set(fn, count + 1);
  return false;
}
var isHmrUpdating = false;
var hmrDirtyComponents = /* @__PURE__ */ new Map();
if (!!(process.env.NODE_ENV !== "production")) {
  getGlobalThis().__VUE_HMR_RUNTIME__ = {
    createRecord: tryWrap(createRecord),
    rerender: tryWrap(rerender),
    reload: tryWrap(reload)
  };
}
var map = /* @__PURE__ */ new Map();
function createRecord(id, initialDef) {
  if (map.has(id)) {
    return false;
  }
  map.set(id, {
    initialDef: normalizeClassComponent(initialDef),
    instances: /* @__PURE__ */ new Set()
  });
  return true;
}
function normalizeClassComponent(component) {
  return isClassComponent(component) ? component.__vccOpts : component;
}
function rerender(id, newRender) {
  const record = map.get(id);
  if (!record) {
    return;
  }
  record.initialDef.render = newRender;
  [...record.instances].forEach((instance) => {
    if (newRender) {
      instance.render = newRender;
      normalizeClassComponent(instance.type).render = newRender;
    }
    instance.renderCache = [];
    isHmrUpdating = true;
    if (!(instance.job.flags & 8)) {
      instance.update();
    }
    isHmrUpdating = false;
  });
}
function reload(id, newComp) {
  const record = map.get(id);
  if (!record) return;
  newComp = normalizeClassComponent(newComp);
  updateComponentDef(record.initialDef, newComp);
  const instances = [...record.instances];
  for (let i2 = 0; i2 < instances.length; i2++) {
    const instance = instances[i2];
    const oldComp = normalizeClassComponent(instance.type);
    let dirtyInstances = hmrDirtyComponents.get(oldComp);
    if (!dirtyInstances) {
      if (oldComp !== record.initialDef) {
        updateComponentDef(oldComp, newComp);
      }
      hmrDirtyComponents.set(oldComp, dirtyInstances = /* @__PURE__ */ new Set());
    }
    dirtyInstances.add(instance);
    instance.appContext.propsCache.delete(instance.type);
    instance.appContext.emitsCache.delete(instance.type);
    instance.appContext.optionsCache.delete(instance.type);
    if (instance.ceReload) {
      dirtyInstances.add(instance);
      instance.ceReload(newComp.styles);
      dirtyInstances.delete(instance);
    } else if (instance.parent) {
      queueJob(() => {
        if (!(instance.job.flags & 8)) {
          isHmrUpdating = true;
          instance.parent.update();
          isHmrUpdating = false;
          dirtyInstances.delete(instance);
        }
      });
    } else if (instance.appContext.reload) {
      instance.appContext.reload();
    } else if (typeof window !== "undefined") {
      window.location.reload();
    } else {
      console.warn(
        "[HMR] Root or manually mounted instance modified. Full reload required."
      );
    }
    if (instance.root.ce && instance !== instance.root) {
      instance.root.ce._removeChildStyle(oldComp);
    }
  }
  queuePostFlushCb(() => {
    hmrDirtyComponents.clear();
  });
}
function updateComponentDef(oldComp, newComp) {
  extend(oldComp, newComp);
  for (const key in oldComp) {
    if (key !== "__file" && !(key in newComp)) {
      delete oldComp[key];
    }
  }
}
function tryWrap(fn) {
  return (id, arg) => {
    try {
      return fn(id, arg);
    } catch (e) {
      console.error(e);
      console.warn(
        `[HMR] Something went wrong during Vue component hot-reload. Full reload required.`
      );
    }
  };
}
var devtools$1;
var buffer = [];
var devtoolsNotInstalled = false;
function setDevtoolsHook$1(hook, target) {
  var _a, _b;
  devtools$1 = hook;
  if (devtools$1) {
    devtools$1.enabled = true;
    buffer.forEach(({ event, args }) => devtools$1.emit(event, ...args));
    buffer = [];
  } else if (
    // handle late devtools injection - only do this if we are in an actual
    // browser environment to avoid the timer handle stalling test runner exit
    // (#4815)
    typeof window !== "undefined" && // some envs mock window but not fully
    window.HTMLElement && // also exclude jsdom
    // eslint-disable-next-line no-restricted-syntax
    !((_b = (_a = window.navigator) == null ? void 0 : _a.userAgent) == null ? void 0 : _b.includes("jsdom"))
  ) {
    const replay = target.__VUE_DEVTOOLS_HOOK_REPLAY__ = target.__VUE_DEVTOOLS_HOOK_REPLAY__ || [];
    replay.push((newHook) => {
      setDevtoolsHook$1(newHook, target);
    });
    setTimeout(() => {
      if (!devtools$1) {
        target.__VUE_DEVTOOLS_HOOK_REPLAY__ = null;
        devtoolsNotInstalled = true;
        buffer = [];
      }
    }, 3e3);
  } else {
    devtoolsNotInstalled = true;
    buffer = [];
  }
}
var currentRenderingInstance = null;
var currentScopeId = null;
function inject(key, defaultValue, treatDefaultAsFactory = false) {
  const instance = getCurrentInstance();
  if (instance || currentApp) {
    let provides = currentApp ? currentApp._context.provides : instance ? instance.parent == null || instance.ce ? instance.vnode.appContext && instance.vnode.appContext.provides : instance.parent.provides : void 0;
    if (provides && key in provides) {
      return provides[key];
    } else if (arguments.length > 1) {
      return treatDefaultAsFactory && isFunction(defaultValue) ? defaultValue.call(instance && instance.proxy) : defaultValue;
    } else if (!!(process.env.NODE_ENV !== "production")) {
      warn$1(`injection "${String(key)}" not found.`);
    }
  } else if (!!(process.env.NODE_ENV !== "production")) {
    warn$1(`inject() can only be used inside setup() or functional components.`);
  }
}
var ssrContextKey = /* @__PURE__ */ Symbol.for("v-scx");
var useSSRContext = () => {
  {
    const ctx = inject(ssrContextKey);
    if (!ctx) {
      !!(process.env.NODE_ENV !== "production") && warn$1(
        `Server rendering context not provided. Make sure to only call useSSRContext() conditionally in the server build.`
      );
    }
    return ctx;
  }
};
function watch2(source, cb, options) {
  if (!!(process.env.NODE_ENV !== "production") && !isFunction(cb)) {
    warn$1(
      `\`watch(fn, options?)\` signature has been moved to a separate API. Use \`watchEffect(fn, options?)\` instead. \`watch\` now only supports \`watch(source, cb, options?) signature.`
    );
  }
  return doWatch(source, cb, options);
}
function doWatch(source, cb, options = EMPTY_OBJ) {
  const { immediate, deep, flush, once } = options;
  if (!!(process.env.NODE_ENV !== "production") && !cb) {
    if (immediate !== void 0) {
      warn$1(
        `watch() "immediate" option is only respected when using the watch(source, callback, options?) signature.`
      );
    }
    if (deep !== void 0) {
      warn$1(
        `watch() "deep" option is only respected when using the watch(source, callback, options?) signature.`
      );
    }
    if (once !== void 0) {
      warn$1(
        `watch() "once" option is only respected when using the watch(source, callback, options?) signature.`
      );
    }
  }
  const baseWatchOptions = extend({}, options);
  if (!!(process.env.NODE_ENV !== "production")) baseWatchOptions.onWarn = warn$1;
  const runsImmediately = cb && immediate || !cb && flush !== "post";
  let ssrCleanup;
  if (isInSSRComponentSetup) {
    if (flush === "sync") {
      const ctx = useSSRContext();
      ssrCleanup = ctx.__watcherHandles || (ctx.__watcherHandles = []);
    } else if (!runsImmediately) {
      const watchStopHandle = () => {
      };
      watchStopHandle.stop = NOOP;
      watchStopHandle.resume = NOOP;
      watchStopHandle.pause = NOOP;
      return watchStopHandle;
    }
  }
  const instance = currentInstance;
  baseWatchOptions.call = (fn, type, args) => callWithAsyncErrorHandling(fn, instance, type, args);
  let isPre = false;
  if (flush === "post") {
    baseWatchOptions.scheduler = (job) => {
      queuePostRenderEffect(job, instance && instance.suspense);
    };
  } else if (flush !== "sync") {
    isPre = true;
    baseWatchOptions.scheduler = (job, isFirstRun) => {
      if (isFirstRun) {
        job();
      } else {
        queueJob(job);
      }
    };
  }
  baseWatchOptions.augmentJob = (job) => {
    if (cb) {
      job.flags |= 4;
    }
    if (isPre) {
      job.flags |= 2;
      if (instance) {
        job.id = instance.uid;
        job.i = instance;
      }
    }
  };
  const watchHandle = watch(source, cb, baseWatchOptions);
  if (isInSSRComponentSetup) {
    if (ssrCleanup) {
      ssrCleanup.push(watchHandle);
    } else if (runsImmediately) {
      watchHandle();
    }
  }
  return watchHandle;
}
function instanceWatch(source, value, options) {
  const publicThis = this.proxy;
  const getter = isString(source) ? source.includes(".") ? createPathGetter(publicThis, source) : () => publicThis[source] : source.bind(publicThis, publicThis);
  let cb;
  if (isFunction(value)) {
    cb = value;
  } else {
    cb = value.handler;
    options = value;
  }
  const reset = setCurrentInstance(this);
  const res = doWatch(getter, cb.bind(publicThis), options);
  reset();
  return res;
}
function createPathGetter(ctx, path) {
  const segments = path.split(".");
  return () => {
    let cur = ctx;
    for (let i2 = 0; i2 < segments.length && cur; i2++) {
      cur = cur[segments[i2]];
    }
    return cur;
  };
}
var isTeleport = (type) => type.__isTeleport;
function setTransitionHooks(vnode, hooks) {
  if (vnode.shapeFlag & 6 && vnode.component) {
    vnode.transition = hooks;
    setTransitionHooks(vnode.component.subTree, hooks);
  } else if (vnode.shapeFlag & 128) {
    vnode.ssContent.transition = hooks.clone(vnode.ssContent);
    vnode.ssFallback.transition = hooks.clone(vnode.ssFallback);
  } else {
    vnode.transition = hooks;
  }
}
var requestIdleCallback = getGlobalThis().requestIdleCallback || ((cb) => setTimeout(cb, 1));
var cancelIdleCallback = getGlobalThis().cancelIdleCallback || ((id) => clearTimeout(id));
function injectHook(type, hook, target = currentInstance, prepend = false) {
  if (target) {
    const hooks = target[type] || (target[type] = []);
    const wrappedHook = hook.__weh || (hook.__weh = (...args) => {
      pauseTracking();
      const reset = setCurrentInstance(target);
      const res = callWithAsyncErrorHandling(hook, target, type, args);
      reset();
      resetTracking();
      return res;
    });
    if (prepend) {
      hooks.unshift(wrappedHook);
    } else {
      hooks.push(wrappedHook);
    }
    return wrappedHook;
  } else if (!!(process.env.NODE_ENV !== "production")) {
    const apiName = toHandlerKey(ErrorTypeStrings$1[type].replace(/ hook$/, ""));
    warn$1(
      `${apiName} is called when there is no active component instance to be associated with. Lifecycle injection APIs can only be used during execution of setup(). If you are using async setup(), make sure to register lifecycle hooks before the first await statement.`
    );
  }
}
var createHook = (lifecycle) => (hook, target = currentInstance) => {
  if (!isInSSRComponentSetup || lifecycle === "sp") {
    injectHook(lifecycle, (...args) => hook(...args), target);
  }
};
var onBeforeMount = createHook("bm");
var onMounted = createHook("m");
var onBeforeUpdate = createHook(
  "bu"
);
var onUpdated = createHook("u");
var onBeforeUnmount = createHook(
  "bum"
);
var onUnmounted = createHook("um");
var onServerPrefetch = createHook(
  "sp"
);
var onRenderTriggered = createHook("rtg");
var onRenderTracked = createHook("rtc");
var NULL_DYNAMIC_COMPONENT = /* @__PURE__ */ Symbol.for("v-ndc");
var getPublicInstance = (i2) => {
  if (!i2) return null;
  if (isStatefulComponent(i2)) return getComponentPublicInstance(i2);
  return getPublicInstance(i2.parent);
};
var publicPropertiesMap = (
  // Move PURE marker to new line to workaround compiler discarding it
  // due to type annotation
  /* @__PURE__ */ extend(/* @__PURE__ */ Object.create(null), {
    $: (i2) => i2,
    $el: (i2) => i2.vnode.el,
    $data: (i2) => i2.data,
    $props: (i2) => !!(process.env.NODE_ENV !== "production") ? shallowReadonly(i2.props) : i2.props,
    $attrs: (i2) => !!(process.env.NODE_ENV !== "production") ? shallowReadonly(i2.attrs) : i2.attrs,
    $slots: (i2) => !!(process.env.NODE_ENV !== "production") ? shallowReadonly(i2.slots) : i2.slots,
    $refs: (i2) => !!(process.env.NODE_ENV !== "production") ? shallowReadonly(i2.refs) : i2.refs,
    $parent: (i2) => getPublicInstance(i2.parent),
    $root: (i2) => getPublicInstance(i2.root),
    $host: (i2) => i2.ce,
    $emit: (i2) => i2.emit,
    $options: (i2) => __VUE_OPTIONS_API__ ? resolveMergedOptions(i2) : i2.type,
    $forceUpdate: (i2) => i2.f || (i2.f = () => {
      queueJob(i2.update);
    }),
    $nextTick: (i2) => i2.n || (i2.n = nextTick.bind(i2.proxy)),
    $watch: (i2) => __VUE_OPTIONS_API__ ? instanceWatch.bind(i2) : NOOP
  })
);
var isReservedPrefix = (key) => key === "_" || key === "$";
var hasSetupBinding = (state, key) => state !== EMPTY_OBJ && !state.__isScriptSetup && hasOwn(state, key);
var PublicInstanceProxyHandlers = {
  get({ _: instance }, key) {
    if (key === "__v_skip") {
      return true;
    }
    const { ctx, setupState, data, props, accessCache, type, appContext } = instance;
    if (!!(process.env.NODE_ENV !== "production") && key === "__isVue") {
      return true;
    }
    if (key[0] !== "$") {
      const n = accessCache[key];
      if (n !== void 0) {
        switch (n) {
          case 1:
            return setupState[key];
          case 2:
            return data[key];
          case 4:
            return ctx[key];
          case 3:
            return props[key];
        }
      } else if (hasSetupBinding(setupState, key)) {
        accessCache[key] = 1;
        return setupState[key];
      } else if (__VUE_OPTIONS_API__ && data !== EMPTY_OBJ && hasOwn(data, key)) {
        accessCache[key] = 2;
        return data[key];
      } else if (hasOwn(props, key)) {
        accessCache[key] = 3;
        return props[key];
      } else if (ctx !== EMPTY_OBJ && hasOwn(ctx, key)) {
        accessCache[key] = 4;
        return ctx[key];
      } else if (!__VUE_OPTIONS_API__ || shouldCacheAccess) {
        accessCache[key] = 0;
      }
    }
    const publicGetter = publicPropertiesMap[key];
    let cssModule, globalProperties;
    if (publicGetter) {
      if (key === "$attrs") {
        track(instance.attrs, "get", "");
        !!(process.env.NODE_ENV !== "production") && markAttrsAccessed();
      } else if (!!(process.env.NODE_ENV !== "production") && key === "$slots") {
        track(instance, "get", key);
      }
      return publicGetter(instance);
    } else if (
      // css module (injected by vue-loader)
      (cssModule = type.__cssModules) && (cssModule = cssModule[key])
    ) {
      return cssModule;
    } else if (ctx !== EMPTY_OBJ && hasOwn(ctx, key)) {
      accessCache[key] = 4;
      return ctx[key];
    } else if (
      // global properties
      globalProperties = appContext.config.globalProperties, hasOwn(globalProperties, key)
    ) {
      {
        return globalProperties[key];
      }
    } else if (!!(process.env.NODE_ENV !== "production") && currentRenderingInstance && (!isString(key) || // #1091 avoid internal isRef/isVNode checks on component instance leading
    // to infinite warning loop
    key.indexOf("__v") !== 0)) {
      if (data !== EMPTY_OBJ && isReservedPrefix(key[0]) && hasOwn(data, key)) {
        warn$1(
          `Property ${JSON.stringify(
            key
          )} must be accessed via $data because it starts with a reserved character ("$" or "_") and is not proxied on the render context.`
        );
      } else if (instance === currentRenderingInstance) {
        warn$1(
          `Property ${JSON.stringify(key)} was accessed during render but is not defined on instance.`
        );
      }
    }
  },
  set({ _: instance }, key, value) {
    const { data, setupState, ctx } = instance;
    if (hasSetupBinding(setupState, key)) {
      setupState[key] = value;
      return true;
    } else if (!!(process.env.NODE_ENV !== "production") && setupState.__isScriptSetup && hasOwn(setupState, key)) {
      warn$1(`Cannot mutate <script setup> binding "${key}" from Options API.`);
      return false;
    } else if (__VUE_OPTIONS_API__ && data !== EMPTY_OBJ && hasOwn(data, key)) {
      data[key] = value;
      return true;
    } else if (hasOwn(instance.props, key)) {
      !!(process.env.NODE_ENV !== "production") && warn$1(`Attempting to mutate prop "${key}". Props are readonly.`);
      return false;
    }
    if (key[0] === "$" && key.slice(1) in instance) {
      !!(process.env.NODE_ENV !== "production") && warn$1(
        `Attempting to mutate public property "${key}". Properties starting with $ are reserved and readonly.`
      );
      return false;
    } else {
      if (!!(process.env.NODE_ENV !== "production") && key in instance.appContext.config.globalProperties) {
        Object.defineProperty(ctx, key, {
          enumerable: true,
          configurable: true,
          value
        });
      } else {
        ctx[key] = value;
      }
    }
    return true;
  },
  has({
    _: { data, setupState, accessCache, ctx, appContext, props, type }
  }, key) {
    let cssModules;
    return !!(accessCache[key] || __VUE_OPTIONS_API__ && data !== EMPTY_OBJ && key[0] !== "$" && hasOwn(data, key) || hasSetupBinding(setupState, key) || hasOwn(props, key) || hasOwn(ctx, key) || hasOwn(publicPropertiesMap, key) || hasOwn(appContext.config.globalProperties, key) || (cssModules = type.__cssModules) && cssModules[key]);
  },
  defineProperty(target, key, descriptor) {
    if (descriptor.get != null) {
      target._.accessCache[key] = 0;
    } else if (hasOwn(descriptor, "value")) {
      this.set(target, key, descriptor.value, null);
    }
    return Reflect.defineProperty(target, key, descriptor);
  }
};
if (!!(process.env.NODE_ENV !== "production") && true) {
  PublicInstanceProxyHandlers.ownKeys = (target) => {
    warn$1(
      `Avoid app logic that relies on enumerating keys on a component instance. The keys will be empty in production mode to avoid performance overhead.`
    );
    return Reflect.ownKeys(target);
  };
}
function normalizePropsOrEmits(props) {
  return isArray(props) ? props.reduce(
    (normalized, p) => (normalized[p] = null, normalized),
    {}
  ) : props;
}
var shouldCacheAccess = true;
function resolveMergedOptions(instance) {
  const base = instance.type;
  const { mixins, extends: extendsOptions } = base;
  const {
    mixins: globalMixins,
    optionsCache: cache,
    config: { optionMergeStrategies }
  } = instance.appContext;
  const cached = cache.get(base);
  let resolved;
  if (cached) {
    resolved = cached;
  } else if (!globalMixins.length && !mixins && !extendsOptions) {
    {
      resolved = base;
    }
  } else {
    resolved = {};
    if (globalMixins.length) {
      globalMixins.forEach(
        (m) => mergeOptions(resolved, m, optionMergeStrategies, true)
      );
    }
    mergeOptions(resolved, base, optionMergeStrategies);
  }
  if (isObject(base)) {
    cache.set(base, resolved);
  }
  return resolved;
}
function mergeOptions(to, from, strats, asMixin = false) {
  const { mixins, extends: extendsOptions } = from;
  if (extendsOptions) {
    mergeOptions(to, extendsOptions, strats, true);
  }
  if (mixins) {
    mixins.forEach(
      (m) => mergeOptions(to, m, strats, true)
    );
  }
  for (const key in from) {
    if (asMixin && key === "expose") {
      !!(process.env.NODE_ENV !== "production") && warn$1(
        `"expose" option is ignored when declared in mixins or extends. It should only be declared in the base component itself.`
      );
    } else {
      const strat = internalOptionMergeStrats[key] || strats && strats[key];
      to[key] = strat ? strat(to[key], from[key]) : from[key];
    }
  }
  return to;
}
var internalOptionMergeStrats = {
  data: mergeDataFn,
  props: mergeEmitsOrPropsOptions,
  emits: mergeEmitsOrPropsOptions,
  // objects
  methods: mergeObjectOptions,
  computed: mergeObjectOptions,
  // lifecycle
  beforeCreate: mergeAsArray,
  created: mergeAsArray,
  beforeMount: mergeAsArray,
  mounted: mergeAsArray,
  beforeUpdate: mergeAsArray,
  updated: mergeAsArray,
  beforeDestroy: mergeAsArray,
  beforeUnmount: mergeAsArray,
  destroyed: mergeAsArray,
  unmounted: mergeAsArray,
  activated: mergeAsArray,
  deactivated: mergeAsArray,
  errorCaptured: mergeAsArray,
  serverPrefetch: mergeAsArray,
  // assets
  components: mergeObjectOptions,
  directives: mergeObjectOptions,
  // watch
  watch: mergeWatchOptions,
  // provide / inject
  provide: mergeDataFn,
  inject: mergeInject
};
function mergeDataFn(to, from) {
  if (!from) {
    return to;
  }
  if (!to) {
    return from;
  }
  return function mergedDataFn() {
    return extend(
      isFunction(to) ? to.call(this, this) : to,
      isFunction(from) ? from.call(this, this) : from
    );
  };
}
function mergeInject(to, from) {
  return mergeObjectOptions(normalizeInject(to), normalizeInject(from));
}
function normalizeInject(raw) {
  if (isArray(raw)) {
    const res = {};
    for (let i2 = 0; i2 < raw.length; i2++) {
      res[raw[i2]] = raw[i2];
    }
    return res;
  }
  return raw;
}
function mergeAsArray(to, from) {
  return to ? [...new Set([].concat(to, from))] : from;
}
function mergeObjectOptions(to, from) {
  return to ? extend(/* @__PURE__ */ Object.create(null), to, from) : from;
}
function mergeEmitsOrPropsOptions(to, from) {
  if (to) {
    if (isArray(to) && isArray(from)) {
      return [.../* @__PURE__ */ new Set([...to, ...from])];
    }
    return extend(
      /* @__PURE__ */ Object.create(null),
      normalizePropsOrEmits(to),
      normalizePropsOrEmits(from != null ? from : {})
    );
  } else {
    return from;
  }
}
function mergeWatchOptions(to, from) {
  if (!to) return from;
  if (!from) return to;
  const merged = extend(/* @__PURE__ */ Object.create(null), to);
  for (const key in from) {
    merged[key] = mergeAsArray(to[key], from[key]);
  }
  return merged;
}
function createAppContext() {
  return {
    app: null,
    config: {
      isNativeTag: NO,
      performance: false,
      globalProperties: {},
      optionMergeStrategies: {},
      errorHandler: void 0,
      warnHandler: void 0,
      compilerOptions: {}
    },
    mixins: [],
    components: {},
    directives: {},
    provides: /* @__PURE__ */ Object.create(null),
    optionsCache: /* @__PURE__ */ new WeakMap(),
    propsCache: /* @__PURE__ */ new WeakMap(),
    emitsCache: /* @__PURE__ */ new WeakMap()
  };
}
var currentApp = null;
var accessedAttrs = false;
function markAttrsAccessed() {
  accessedAttrs = true;
}
var internalObjectProto = {};
var isInternalObject = (obj) => Object.getPrototypeOf(obj) === internalObjectProto;
var queuePostRenderEffect = queueEffectWithSuspense;
var isSuspense = (type) => type.__isSuspense;
function queueEffectWithSuspense(fn, suspense) {
  if (suspense && suspense.pendingBranch) {
    if (isArray(fn)) {
      suspense.effects.push(...fn);
    } else {
      suspense.effects.push(fn);
    }
  } else {
    queuePostFlushCb(fn);
  }
}
var Fragment = /* @__PURE__ */ Symbol.for("v-fgt");
var Text = /* @__PURE__ */ Symbol.for("v-txt");
var Comment = /* @__PURE__ */ Symbol.for("v-cmt");
var currentBlock = null;
var isBlockTreeEnabled = 1;
function isVNode(value) {
  return value ? value.__v_isVNode === true : false;
}
var vnodeArgsTransformer;
var createVNodeWithArgsTransform = (...args) => {
  return _createVNode(
    ...vnodeArgsTransformer ? vnodeArgsTransformer(args, currentRenderingInstance) : args
  );
};
var normalizeKey = ({ key }) => key != null ? key : null;
var normalizeRef = ({
  ref: ref2,
  ref_key,
  ref_for
}) => {
  if (typeof ref2 === "number") {
    ref2 = "" + ref2;
  }
  return ref2 != null ? isString(ref2) || isRef(ref2) || isFunction(ref2) ? { i: currentRenderingInstance, r: ref2, k: ref_key, f: !!ref_for } : ref2 : null;
};
function createBaseVNode(type, props = null, children = null, patchFlag = 0, dynamicProps = null, shapeFlag = type === Fragment ? 0 : 1, isBlockNode = false, needFullChildrenNormalization = false) {
  const vnode = {
    __v_isVNode: true,
    __v_skip: true,
    type,
    props,
    key: props && normalizeKey(props),
    ref: props && normalizeRef(props),
    scopeId: currentScopeId,
    slotScopeIds: null,
    children,
    component: null,
    suspense: null,
    ssContent: null,
    ssFallback: null,
    dirs: null,
    transition: null,
    el: null,
    anchor: null,
    target: null,
    targetStart: null,
    targetAnchor: null,
    staticCount: 0,
    shapeFlag,
    patchFlag,
    dynamicProps,
    dynamicChildren: null,
    appContext: null,
    ctx: currentRenderingInstance
  };
  if (needFullChildrenNormalization) {
    normalizeChildren(vnode, children);
    if (shapeFlag & 128) {
      type.normalize(vnode);
    }
  } else if (children) {
    vnode.shapeFlag |= isString(children) ? 8 : 16;
  }
  if (!!(process.env.NODE_ENV !== "production") && vnode.key !== vnode.key) {
    warn$1(`VNode created with invalid key (NaN). VNode type:`, vnode.type);
  }
  if (isBlockTreeEnabled > 0 && // avoid a block node from tracking itself
  !isBlockNode && // has current parent block
  currentBlock && // presence of a patch flag indicates this node needs patching on updates.
  // component nodes also should always be patched, because even if the
  // component doesn't need to update, it needs to persist the instance on to
  // the next vnode so that it can be properly unmounted later.
  (vnode.patchFlag > 0 || shapeFlag & 6) && // the EVENTS flag is only for hydration and if it is the only flag, the
  // vnode should not be considered dynamic due to handler caching.
  vnode.patchFlag !== 32) {
    currentBlock.push(vnode);
  }
  return vnode;
}
var createVNode = !!(process.env.NODE_ENV !== "production") ? createVNodeWithArgsTransform : _createVNode;
function _createVNode(type, props = null, children = null, patchFlag = 0, dynamicProps = null, isBlockNode = false) {
  if (!type || type === NULL_DYNAMIC_COMPONENT) {
    if (!!(process.env.NODE_ENV !== "production") && !type) {
      warn$1(`Invalid vnode type when creating vnode: ${type}.`);
    }
    type = Comment;
  }
  if (isVNode(type)) {
    const cloned = cloneVNode(
      type,
      props,
      true
      /* mergeRef: true */
    );
    if (children) {
      normalizeChildren(cloned, children);
    }
    if (isBlockTreeEnabled > 0 && !isBlockNode && currentBlock) {
      if (cloned.shapeFlag & 6) {
        currentBlock[currentBlock.indexOf(type)] = cloned;
      } else {
        currentBlock.push(cloned);
      }
    }
    cloned.patchFlag = -2;
    return cloned;
  }
  if (isClassComponent(type)) {
    type = type.__vccOpts;
  }
  if (props) {
    props = guardReactiveProps(props);
    let { class: klass, style } = props;
    if (klass && !isString(klass)) {
      props.class = normalizeClass(klass);
    }
    if (isObject(style)) {
      if (isProxy(style) && !isArray(style)) {
        style = extend({}, style);
      }
      props.style = normalizeStyle(style);
    }
  }
  const shapeFlag = isString(type) ? 1 : isSuspense(type) ? 128 : isTeleport(type) ? 64 : isObject(type) ? 4 : isFunction(type) ? 2 : 0;
  if (!!(process.env.NODE_ENV !== "production") && shapeFlag & 4 && isProxy(type)) {
    type = toRaw(type);
    warn$1(
      `Vue received a Component that was made a reactive object. This can lead to unnecessary performance overhead and should be avoided by marking the component with \`markRaw\` or using \`shallowRef\` instead of \`ref\`.`,
      `
Component that was made reactive: `,
      type
    );
  }
  return createBaseVNode(
    type,
    props,
    children,
    patchFlag,
    dynamicProps,
    shapeFlag,
    isBlockNode,
    true
  );
}
function guardReactiveProps(props) {
  if (!props) return null;
  return isProxy(props) || isInternalObject(props) ? extend({}, props) : props;
}
function cloneVNode(vnode, extraProps, mergeRef = false, cloneTransition = false) {
  const { props, ref: ref2, patchFlag, children, transition } = vnode;
  const mergedProps = extraProps ? mergeProps(props || {}, extraProps) : props;
  const cloned = {
    __v_isVNode: true,
    __v_skip: true,
    type: vnode.type,
    props: mergedProps,
    key: mergedProps && normalizeKey(mergedProps),
    ref: extraProps && extraProps.ref ? (
      // #2078 in the case of <component :is="vnode" ref="extra"/>
      // if the vnode itself already has a ref, cloneVNode will need to merge
      // the refs so the single vnode can be set on multiple refs
      mergeRef && ref2 ? isArray(ref2) ? ref2.concat(normalizeRef(extraProps)) : [ref2, normalizeRef(extraProps)] : normalizeRef(extraProps)
    ) : ref2,
    scopeId: vnode.scopeId,
    slotScopeIds: vnode.slotScopeIds,
    children: !!(process.env.NODE_ENV !== "production") && patchFlag === -1 && isArray(children) ? children.map(deepCloneVNode) : children,
    target: vnode.target,
    targetStart: vnode.targetStart,
    targetAnchor: vnode.targetAnchor,
    staticCount: vnode.staticCount,
    shapeFlag: vnode.shapeFlag,
    // if the vnode is cloned with extra props, we can no longer assume its
    // existing patch flag to be reliable and need to add the FULL_PROPS flag.
    // note: preserve flag for fragments since they use the flag for children
    // fast paths only.
    patchFlag: extraProps && vnode.type !== Fragment ? patchFlag === -1 ? 16 : patchFlag | 16 : patchFlag,
    dynamicProps: vnode.dynamicProps,
    dynamicChildren: vnode.dynamicChildren,
    appContext: vnode.appContext,
    dirs: vnode.dirs,
    transition,
    // These should technically only be non-null on mounted VNodes. However,
    // they *should* be copied for kept-alive vnodes. So we just always copy
    // them since them being non-null during a mount doesn't affect the logic as
    // they will simply be overwritten.
    component: vnode.component,
    suspense: vnode.suspense,
    ssContent: vnode.ssContent && cloneVNode(vnode.ssContent),
    ssFallback: vnode.ssFallback && cloneVNode(vnode.ssFallback),
    placeholder: vnode.placeholder,
    el: vnode.el,
    anchor: vnode.anchor,
    ctx: vnode.ctx,
    ce: vnode.ce
  };
  if (transition && cloneTransition) {
    setTransitionHooks(
      cloned,
      transition.clone(cloned)
    );
  }
  return cloned;
}
function deepCloneVNode(vnode) {
  const cloned = cloneVNode(vnode);
  if (isArray(vnode.children)) {
    cloned.children = vnode.children.map(deepCloneVNode);
  }
  return cloned;
}
function createTextVNode(text = " ", flag = 0) {
  return createVNode(Text, null, text, flag);
}
function normalizeChildren(vnode, children) {
  let type = 0;
  const { shapeFlag } = vnode;
  if (children == null) {
    children = null;
  } else if (isArray(children)) {
    type = 16;
  } else if (typeof children === "object") {
    if (shapeFlag & (1 | 64)) {
      const slot = children.default;
      if (slot) {
        slot._c && (slot._d = false);
        normalizeChildren(vnode, slot());
        slot._c && (slot._d = true);
      }
      return;
    } else {
      type = 32;
      const slotFlag = children._;
      if (!slotFlag && !isInternalObject(children)) {
        children._ctx = currentRenderingInstance;
      } else if (slotFlag === 3 && currentRenderingInstance) {
        if (currentRenderingInstance.slots._ === 1) {
          children._ = 1;
        } else {
          children._ = 2;
          vnode.patchFlag |= 1024;
        }
      }
    }
  } else if (isFunction(children)) {
    if (shapeFlag & (1 | 64)) {
      normalizeChildren(vnode, { default: children });
      return;
    }
    children = { default: children, _ctx: currentRenderingInstance };
    type = 32;
  } else {
    children = String(children);
    if (shapeFlag & 64) {
      type = 16;
      children = [createTextVNode(children)];
    } else {
      type = 8;
    }
  }
  vnode.children = children;
  vnode.shapeFlag |= type;
}
function mergeProps(...args) {
  const ret = {};
  for (let i2 = 0; i2 < args.length; i2++) {
    const toMerge = args[i2];
    for (const key in toMerge) {
      if (key === "class") {
        if (ret.class !== toMerge.class) {
          ret.class = normalizeClass([ret.class, toMerge.class]);
        }
      } else if (key === "style") {
        ret.style = normalizeStyle([ret.style, toMerge.style]);
      } else if (isOn(key)) {
        const existing = ret[key];
        const incoming = toMerge[key];
        if (incoming && existing !== incoming && !(isArray(existing) && existing.includes(incoming))) {
          ret[key] = existing ? [].concat(existing, incoming) : incoming;
        } else if (incoming == null && existing == null && // mergeProps({ 'onUpdate:modelValue': undefined }) should not retain
        // the model listener.
        !isModelListener(key)) {
          ret[key] = incoming;
        }
      } else if (key !== "") {
        ret[key] = toMerge[key];
      }
    }
  }
  return ret;
}
var emptyAppContext = createAppContext();
var currentInstance = null;
var getCurrentInstance = () => currentInstance || currentRenderingInstance;
var internalSetCurrentInstance;
var setInSSRSetupState;
{
  const g2 = getGlobalThis();
  const registerGlobalSetter = (key, setter) => {
    let setters;
    if (!(setters = g2[key])) setters = g2[key] = [];
    setters.push(setter);
    return (v) => {
      if (setters.length > 1) setters.forEach((set) => set(v));
      else setters[0](v);
    };
  };
  internalSetCurrentInstance = registerGlobalSetter(
    `__VUE_INSTANCE_SETTERS__`,
    (v) => currentInstance = v
  );
  setInSSRSetupState = registerGlobalSetter(
    `__VUE_SSR_SETTERS__`,
    (v) => isInSSRComponentSetup = v
  );
}
var setCurrentInstance = (instance) => {
  const prev = currentInstance;
  internalSetCurrentInstance(instance);
  instance.scope.on();
  return () => {
    instance.scope.off();
    internalSetCurrentInstance(prev);
  };
};
function isStatefulComponent(instance) {
  return instance.vnode.shapeFlag & 4;
}
var isInSSRComponentSetup = false;
var attrsProxyHandlers = !!(process.env.NODE_ENV !== "production") ? {
  get(target, key) {
    markAttrsAccessed();
    track(target, "get", "");
    return target[key];
  },
  set() {
    warn$1(`setupContext.attrs is readonly.`);
    return false;
  },
  deleteProperty() {
    warn$1(`setupContext.attrs is readonly.`);
    return false;
  }
} : {
  get(target, key) {
    track(target, "get", "");
    return target[key];
  }
};
function getComponentPublicInstance(instance) {
  if (instance.exposed) {
    return instance.exposeProxy || (instance.exposeProxy = new Proxy(proxyRefs(markRaw(instance.exposed)), {
      get(target, key) {
        if (key in target) {
          return target[key];
        } else if (key in publicPropertiesMap) {
          return publicPropertiesMap[key](instance);
        }
      },
      has(target, key) {
        return key in target || key in publicPropertiesMap;
      }
    }));
  } else {
    return instance.proxy;
  }
}
var classifyRE = /(?:^|[-_])\w/g;
var classify = (str) => str.replace(classifyRE, (c) => c.toUpperCase()).replace(/[-_]/g, "");
function getComponentName(Component, includeInferred = true) {
  return isFunction(Component) ? Component.displayName || Component.name : Component.name || includeInferred && Component.__name;
}
function formatComponentName(instance, Component, isRoot = false) {
  let name = getComponentName(Component);
  if (!name && Component.__file) {
    const match = Component.__file.match(/([^/\\]+)\.\w+$/);
    if (match) {
      name = match[1];
    }
  }
  if (!name && instance) {
    const inferFromRegistry = (registry) => {
      for (const key in registry) {
        if (registry[key] === Component) {
          return key;
        }
      }
    };
    name = inferFromRegistry(instance.components) || instance.parent && inferFromRegistry(
      instance.parent.type.components
    ) || inferFromRegistry(instance.appContext.components);
  }
  return name ? classify(name) : isRoot ? `App` : `Anonymous`;
}
function isClassComponent(value) {
  return isFunction(value) && "__vccOpts" in value;
}
function initCustomFormatter() {
  if (!!!(process.env.NODE_ENV !== "production") || typeof window === "undefined") {
    return;
  }
  const vueStyle = { style: "color:#3ba776" };
  const numberStyle = { style: "color:#1677ff" };
  const stringStyle = { style: "color:#f5222d" };
  const keywordStyle = { style: "color:#eb2f96" };
  const formatter = {
    __vue_custom_formatter: true,
    header(obj) {
      if (!isObject(obj)) {
        return null;
      }
      if (obj.__isVue) {
        return ["div", vueStyle, `VueInstance`];
      } else if (isRef(obj)) {
        pauseTracking();
        const value = obj.value;
        resetTracking();
        return [
          "div",
          {},
          ["span", vueStyle, genRefFlag(obj)],
          "<",
          formatValue(value),
          `>`
        ];
      } else if (isReactive(obj)) {
        return [
          "div",
          {},
          ["span", vueStyle, isShallow(obj) ? "ShallowReactive" : "Reactive"],
          "<",
          formatValue(obj),
          `>${isReadonly(obj) ? ` (readonly)` : ``}`
        ];
      } else if (isReadonly(obj)) {
        return [
          "div",
          {},
          ["span", vueStyle, isShallow(obj) ? "ShallowReadonly" : "Readonly"],
          "<",
          formatValue(obj),
          ">"
        ];
      }
      return null;
    },
    hasBody(obj) {
      return obj && obj.__isVue;
    },
    body(obj) {
      if (obj && obj.__isVue) {
        return [
          "div",
          {},
          ...formatInstance(obj.$)
        ];
      }
    }
  };
  function formatInstance(instance) {
    const blocks = [];
    if (instance.type.props && instance.props) {
      blocks.push(createInstanceBlock("props", toRaw(instance.props)));
    }
    if (instance.setupState !== EMPTY_OBJ) {
      blocks.push(createInstanceBlock("setup", instance.setupState));
    }
    if (instance.data !== EMPTY_OBJ) {
      blocks.push(createInstanceBlock("data", toRaw(instance.data)));
    }
    const computed2 = extractKeys(instance, "computed");
    if (computed2) {
      blocks.push(createInstanceBlock("computed", computed2));
    }
    const injected = extractKeys(instance, "inject");
    if (injected) {
      blocks.push(createInstanceBlock("injected", injected));
    }
    blocks.push([
      "div",
      {},
      [
        "span",
        {
          style: keywordStyle.style + ";opacity:0.66"
        },
        "$ (internal): "
      ],
      ["object", { object: instance }]
    ]);
    return blocks;
  }
  function createInstanceBlock(type, target) {
    target = extend({}, target);
    if (!Object.keys(target).length) {
      return ["span", {}];
    }
    return [
      "div",
      { style: "line-height:1.25em;margin-bottom:0.6em" },
      [
        "div",
        {
          style: "color:#476582"
        },
        type
      ],
      [
        "div",
        {
          style: "padding-left:1.25em"
        },
        ...Object.keys(target).map((key) => {
          return [
            "div",
            {},
            ["span", keywordStyle, key + ": "],
            formatValue(target[key], false)
          ];
        })
      ]
    ];
  }
  function formatValue(v, asRaw = true) {
    if (typeof v === "number") {
      return ["span", numberStyle, v];
    } else if (typeof v === "string") {
      return ["span", stringStyle, JSON.stringify(v)];
    } else if (typeof v === "boolean") {
      return ["span", keywordStyle, v];
    } else if (isObject(v)) {
      return ["object", { object: asRaw ? toRaw(v) : v }];
    } else {
      return ["span", stringStyle, String(v)];
    }
  }
  function extractKeys(instance, type) {
    const Comp = instance.type;
    if (isFunction(Comp)) {
      return;
    }
    const extracted = {};
    for (const key in instance.ctx) {
      if (isKeyOfType(Comp, key, type)) {
        extracted[key] = instance.ctx[key];
      }
    }
    return extracted;
  }
  function isKeyOfType(Comp, key, type) {
    const opts = Comp[type];
    if (isArray(opts) && opts.includes(key) || isObject(opts) && key in opts) {
      return true;
    }
    if (Comp.extends && isKeyOfType(Comp.extends, key, type)) {
      return true;
    }
    if (Comp.mixins && Comp.mixins.some((m) => isKeyOfType(m, key, type))) {
      return true;
    }
  }
  function genRefFlag(v) {
    if (isShallow(v)) {
      return `ShallowRef`;
    }
    if (v.effect) {
      return `ComputedRef`;
    }
    return `Ref`;
  }
  if (window.devtoolsFormatters) {
    window.devtoolsFormatters.push(formatter);
  } else {
    window.devtoolsFormatters = [formatter];
  }
}
var warn2 = !!(process.env.NODE_ENV !== "production") ? warn$1 : NOOP;
var devtools = !!(process.env.NODE_ENV !== "production") || true ? devtools$1 : void 0;
var setDevtoolsHook = !!(process.env.NODE_ENV !== "production") || true ? setDevtoolsHook$1 : NOOP;

// node_modules/vue/dist/vue.runtime.esm-bundler.js
function initDev() {
  {
    initCustomFormatter();
  }
}
if (!!(process.env.NODE_ENV !== "production")) {
  initDev();
}

// src/localStorage.ts
var localStorage = unsafeWindow.localStorage;
function write(key, value) {
  GM_setValue(key, JSON.stringify(value));
}
function read(key) {
  return JSON.parse(GM_getValue(key) || "null");
}
function del(key) {
  GM_deleteValue(key);
}

// src/settings.ts
var STORE_KEY = "settings";
var DEFAULT_SETTINGS = {
  decryptFont: true,
  blockReport: true,
  allowCopy: true,
  shelfRemoveConfirm: true,
  logoutConfirm: true,
  readerFont: "",
  customCssEnabled: false,
  customCss: "",
  // 原站书架点封面是继续阅读，保持一致
  bookshelfClickAction: "read",
  enhanceSearch: true,
  // 默认关：携带登录态属于额外的隐私暴露，交给用户显式开启
  searchPersonalized: false,
  enableDownload: true,
  downloadFormat: "epub",
  downloadCharset: "utf-8",
  // 30 是接口单请求返回正文的上限，再大也只回 30 条
  downloadBatchSize: 30,
  // 实测 750ms 能稳定拿满，更短会被限流成每次 1 条
  downloadInterval: 750,
  downloadRetries: 3,
  downloadVolumePage: false,
  downloadImages: true,
  downloadBookCss: true,
  audiobookChapterEnd: "next",
  audiobookFollow: true,
  apiPreference: "app",
  deviceId: "",
  installId: "",
  deviceType: ""
};
function normalize(raw) {
  const s = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== "object") return s;
  const o = raw;
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    const v = o[key];
    if (v === void 0 || v === null) continue;
    if (typeof DEFAULT_SETTINGS[key] === typeof v) {
      s[key] = v;
    }
  }
  if (s.apiPreference !== "app" && s.apiPreference !== "redcandle") {
    s.apiPreference = DEFAULT_SETTINGS.apiPreference;
  }
  if (s.downloadFormat !== "epub" && s.downloadFormat !== "txt") {
    s.downloadFormat = DEFAULT_SETTINGS.downloadFormat;
  }
  if (s.downloadCharset !== "utf-8" && s.downloadCharset !== "gbk") {
    s.downloadCharset = DEFAULT_SETTINGS.downloadCharset;
  }
  if (s.bookshelfClickAction !== "read" && s.bookshelfClickAction !== "detail") {
    s.bookshelfClickAction = DEFAULT_SETTINGS.bookshelfClickAction;
  }
  if (s.audiobookChapterEnd !== "next" && s.audiobookChapterEnd !== "stop") {
    s.audiobookChapterEnd = DEFAULT_SETTINGS.audiobookChapterEnd;
  }
  s.downloadBatchSize = clampInt(s.downloadBatchSize, 1, 30, DEFAULT_SETTINGS.downloadBatchSize);
  s.downloadInterval = clampInt(s.downloadInterval, 0, 1e4, DEFAULT_SETTINGS.downloadInterval);
  s.downloadRetries = clampInt(s.downloadRetries, 0, 10, DEFAULT_SETTINGS.downloadRetries);
  return s;
}
function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
var settings = reactive(normalize(read(STORE_KEY)));
var saveTimer;
watch2(
  settings,
  () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = void 0;
      write(STORE_KEY, { ...settings });
    }, 200);
  },
  { deep: true }
);

// src/utils/index.ts
function concatArrayBuffers(...buffers) {
  const totalLength = buffers.reduce((sum, buf) => sum + buf.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const buf of buffers) {
    result.set(new Uint8Array(buf), offset);
    offset += buf.byteLength;
  }
  return result.buffer;
}

// src/utils/compress.ts
async function gzip(data) {
  if (typeof data === "string") {
    data = new TextEncoder().encode(data).buffer;
  }
  const encoder = new CompressionStream("gzip");
  const stream = new Blob([data]).stream().pipeThrough(encoder);
  const compressed = new Response(stream).arrayBuffer();
  return compressed;
}
async function gunzip(data) {
  const decoder = new DecompressionStream("gzip");
  const stream = new Blob([data]).stream().pipeThrough(decoder);
  const decompressed = new Response(stream).arrayBuffer();
  return decompressed;
}

// src/crypto/ttencrypt.ts
var FIXED_STRING = b64decode(
  "TdTC5rgxYgkOUrPHpnM7pByyRiuCmrWKGWs521cXdST0m69/COjWjSanLjfBqVovHwWlGJKu8pSXMrYqOKrdWA=="
);
async function encrypt(data) {
  const crypto = getCrypto();
  const subtle = getSubtle();
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const hashValue = await hash.sha512bytes(
    concatArrayBuffers(await hash.sha512bytes(randomBytes), FIXED_STRING)
  );
  const k = hashValue.slice(0, 16);
  const iv = hashValue.slice(16, 32);
  const compressedData = await gzip(data);
  const hashedData = concatArrayBuffers(
    await hash.sha512bytes(compressedData),
    compressedData
  );
  const key = await subtle.importKey("raw", k, { name: "AES-CBC", length: 128 }, false, ["encrypt"]);
  const encryptedData = await subtle.encrypt({ name: "AES-CBC", iv }, key, hashedData);
  return concatArrayBuffers(
    new Uint8Array([116, 99, 5, 16, 0, 0]).buffer,
    randomBytes.buffer,
    encryptedData
  );
}

// src/api/devicebody.ts
var ANDROID_VERSIONS = [
  { version: "9", api: 29 },
  { version: "10", api: 30 },
  { version: "11", api: 31 },
  { version: "12", api: 32 },
  { version: "13", api: 33 },
  { version: "14", api: 34 }
];
var DEVICE_MODELS = [
  "RMX1931",
  "MI8",
  "Honor10",
  "P30",
  "V1921A",
  "Redmi Note 7",
  "Redmi K20 Pro",
  "MI 9",
  "Mi 10 Pro",
  "SM-G9750",
  "Pixel 6",
  "HD1910",
  "M2011K2C",
  "LIO-AN00",
  "VOG-TL00",
  "PCLM10",
  "GM1900",
  "Pixel 7 Pro",
  "Pixel 6a",
  "SM-N9760",
  "POCO F1"
];
var DEVICE_BRANDS = [
  "realme",
  "Xiaomi",
  "Huawei",
  "OPPO",
  "vivo",
  "samsung",
  "OnePlus",
  "google",
  "Redmi",
  "HONOR",
  "motorola",
  "POCO"
];
var HEX_LOW = "0123456789abcdef";
var deviceValue = {
  aid: "1967",
  appName: "novelapp",
  channel: "0",
  platform: "android",
  osVersion: "0",
  versionCode: {
    str: "6.3.9.32",
    val: "63932"
  }
};
function randomInt(max) {
  return getCrypto().getRandomValues(new Uint32Array(1))[0] % max;
}
function randomItem(list) {
  return list[randomInt(list.length)];
}
function randomHex(k) {
  if (k <= 0) return "";
  const bytes = getCrypto().getRandomValues(new Uint8Array(k));
  let result = "";
  for (let i2 = 0; i2 < k; i2++) {
    result += HEX_LOW[bytes[i2] % 16];
  }
  return result;
}
function uuid() {
  const c = getCrypto();
  if (typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = b[6] & 15 | 64;
  b[8] = b[8] & 63 | 128;
  const h2 = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h2.slice(0, 8)}-${h2.slice(8, 12)}-${h2.slice(12, 16)}-${h2.slice(16, 20)}-${h2.slice(20)}`;
}
function ipv6LinkLocal() {
  return "::1";
}
function ipv6UniqueLocal() {
  const x = randomInt(1 << 8);
  let result = `fd${HEX_LOW[x >> 4]}${HEX_LOW[x & 15]}`;
  for (let i2 = 0; i2 < 7; i2++) {
    const v = randomInt(1 << 16);
    result += ":" + HEX_LOW[v >> 12 & 15] + HEX_LOW[v >> 8 & 15] + HEX_LOW[v >> 4 & 15] + HEX_LOW[v & 15];
  }
  return result;
}
function generateRequestBody() {
  const osInfo = randomItem(ANDROID_VERSIONS);
  const deviceBrand = randomItem(DEVICE_BRANDS);
  const genTime = Date.now();
  const romVersion = "coloros__" + randomHex(4).toUpperCase() + "." + String(randomInt(1e6)).padStart(6, "0") + "." + String(randomInt(1e8)).padStart(8, "0") + " release-keys";
  return {
    magic_tag: "ss_app_log",
    header: {
      display_name: "\u756A\u8304\u514D\u8D39\u5C0F\u8BF4",
      aid: 1967,
      channel: "43536163a",
      package: "com.dragon.read",
      sdk_version: "3.7.0-rc.25-fanqie-xiaoshuo",
      sdk_target_version: 29,
      git_hash: "711d1a7",
      density_dpi: 240,
      display_density: "hdpi",
      resolution: "720x1280",
      language: "zh",
      timezone: 8,
      access: "wifi",
      not_request_sender: 0,
      carrier: "CHINA MOBILE",
      mcc_mnc: "46000",
      region: "CN",
      tz_name: "Asia/Shanghai",
      tz_offset: 28800,
      sim_region: "cn",
      sim_serial_number: [],
      oaid_may_support: false,
      device_platform: "android",
      custom: { host_bit: 32, dragon_device_type: 0 },
      pre_installed_channel: "",
      is_system_app: 0,
      sdk_flavor: "china",
      guest_mode: 0,
      // 设备硬件与系统信息
      os: "Android",
      os_version: osInfo.version,
      os_api: osInfo.api,
      device_model: randomItem(DEVICE_MODELS),
      device_brand: deviceBrand,
      device_manufacturer: deviceBrand,
      cpu_abi: "arm64-v8a",
      release_build: randomHex(7),
      cdid: uuid(),
      sig_hash: "a4a27c2633195374c15651ffc3c4a497",
      openudid: randomHex(20),
      clientudid: uuid(),
      req_id: uuid(),
      // 可选字段
      rom: randomHex(14).toUpperCase(),
      rom_version: romVersion,
      apk_first_install_time: genTime - randomInt(365) * 864e5,
      ipv6_list: [
        { type: "client_anpi", value: ipv6LinkLocal() },
        { type: "client_anpi", value: ipv6UniqueLocal() },
        { type: "client_anpi", value: ipv6UniqueLocal() }
      ]
    },
    _gen_time: genTime
  };
}

// src/api/device.ts
var REGISTER_URL = "https://i.snssdk.com/service/2/device_register/?tt_data=a";
var READING_BASE = "https://reading.snssdk.com";
var USER_AGENT = "com.dragon.read";
var APP_REQUEST = { credentials: "omit" };
function buildQuery(device, versionCode, extra) {
  return new URLSearchParams({
    device_id: device.device_id,
    iid: device.install_id,
    device_type: device.device_type,
    aid: deviceValue.aid,
    app_name: deviceValue.appName,
    channel: deviceValue.channel,
    device_platform: deviceValue.platform,
    os_version: deviceValue.osVersion,
    version_code: versionCode,
    ...extra
  });
}
async function registerDevice() {
  const body = generateRequestBody();
  const encrypted = await encrypt(
    new TextEncoder().encode(JSON.stringify(body)).buffer
  );
  const res = await apiFetch(REGISTER_URL, {
    ...APP_REQUEST,
    method: "POST",
    headers: {
      "User-Agent": "okhttp/4.10.0",
      "Content-Type": "application/octet-stream; tt-data=a"
    },
    body: encrypted
  });
  if (res.status !== 200) {
    throw new Error(`\u8BBE\u5907\u6CE8\u518C\u5931\u8D25: HTTP ${res.status} ${res.statusText}`);
  }
  const json = res.json();
  if (!json?.device_id || !json.device_id_str || !json.install_id_str) {
    throw new Error(`\u8BBE\u5907\u6CE8\u518C\u5931\u8D25: device_id \u65E0\u6548, \u54CD\u5E94=${res.responseText}`);
  }
  const device = {
    device_id: json.device_id_str,
    install_id: json.install_id_str,
    device_type: body.header.device_model
  };
  console.log("\u8BBE\u5907\u6CE8\u518C\u6210\u529F\uFF01", device);
  return device;
}
async function activatePremium(device) {
  const url = `${READING_BASE}/reading/user/privilege/add/v?` + buildQuery(device, deviceValue.versionCode.val, {
    manifest_version_code: deviceValue.versionCode.val,
    update_version_code: deviceValue.versionCode.val
  }).toString();
  const body = `{"add_count_daily":0,"amount":2592000,"privilege_id":7210376203117531962,"from":8,"unique_key":"${Date.now()}"}`;
  try {
    const headers = await signRequest(url, body);
    const res = await apiFetch(url, {
      ...APP_REQUEST,
      method: "POST",
      headers: {
        ...headers,
        "User-Agent": USER_AGENT,
        "Content-Type": "application/json; charset=utf-8"
      },
      body
    });
    const json = res.json();
    if (json?.code !== 0) {
      console.warn("\u8BBE\u5907\u4F1A\u5458\u6FC0\u6D3B\u5931\u8D25:", res.responseText);
      return "";
    }
    const expireTime = json.data?.expire_time ?? "";
    console.log("\u8BBE\u5907\u4F1A\u5458\u5DF2\u6210\u529F\u6FC0\u6D3B\uFF01\u8FC7\u671F\u65F6\u95F4:", expireTime);
    return expireTime;
  } catch (e) {
    console.warn("\u8BBE\u5907\u4F1A\u5458\u6FC0\u6D3B\u5931\u8D25:", e);
    return "";
  }
}
async function registerKey(device) {
  const url = `${READING_BASE}/reading/crypt/registerkey?` + buildQuery(device, deviceValue.versionCode.str).toString();
  const idBytes = new Uint8Array(16);
  let id = BigInt(device.device_id);
  for (let i2 = 15; i2 >= 0; i2--) {
    idBytes[i2] = Number(id & 0xffn);
    id >>= 8n;
  }
  idBytes.reverse();
  const subtle = getSubtle();
  const iv = getCrypto().getRandomValues(new Uint8Array(16));
  const key = await subtle.importKey("raw", shared_key, { name: "AES-CBC" }, false, ["encrypt"]);
  const encrypted = new Uint8Array(
    await subtle.encrypt({ name: "AES-CBC", iv }, key, idBytes)
  );
  const content = new Uint8Array(iv.length + encrypted.length);
  content.set(iv);
  content.set(encrypted, iv.length);
  const plainBody = JSON.stringify({ content: b64encode(content.buffer) });
  const gzipped = await gzip(plainBody);
  const headers = await signRequest(url, gzipped);
  const res = await apiFetch(url, {
    ...APP_REQUEST,
    method: "POST",
    headers: {
      ...headers,
      "User-Agent": USER_AGENT,
      "Content-Type": "application/json; charset=utf-8",
      "Content-Encoding": "gzip"
    },
    body: gzipped
  });
  if (res.status !== 200) {
    throw new Error(`\u5BC6\u94A5\u6CE8\u518C\u5931\u8D25: HTTP ${res.status} ${res.statusText}`);
  }
  const json = res.json();
  const encryptedKey = json?.data?.key;
  if (!encryptedKey) {
    throw new Error(`\u5BC6\u94A5\u6CE8\u518C\u5931\u8D25: \u54CD\u5E94\u7F3A\u5C11 key, \u54CD\u5E94=${res.responseText}`);
  }
  const buf = b64decode(encryptedKey);
  const decryptKey = await subtle.importKey(
    "raw",
    shared_key,
    { name: "AES-CBC" },
    false,
    ["decrypt"]
  );
  const finalKey = await subtle.decrypt(
    { name: "AES-CBC", iv: buf.slice(0, 16) },
    decryptKey,
    buf.slice(16)
  );
  const keyInfo = { key: finalKey, keyver: json.data?.keyver };
  console.log("\u5BC6\u94A5\u83B7\u53D6\u6210\u529F\uFF0C\u7248\u672C:", keyInfo.keyver, "key:", hex(finalKey));
  return keyInfo;
}

// src/api/provision.ts
var STORE_KEY2 = "device";
function save(c, vipExpireTime) {
  const s = {
    device_id: c.device_id,
    install_id: c.install_id,
    device_type: c.device_type,
    device_brand: c.device_brand,
    vip_expire_time: vipExpireTime
  };
  write(STORE_KEY2, s);
}
async function provisionDevice() {
  const dev = await registerDevice();
  const vipExpireTime = await activatePremium(dev);
  const keyInfo = await registerKey(dev);
  const c = {
    device_id: dev.device_id,
    install_id: dev.install_id,
    device_type: dev.device_type,
    key_info: keyInfo
  };
  config_default.currentConfig = c;
  save(c, vipExpireTime);
  write("keyinfo", {
    key: b64encode(keyInfo.key),
    keyver: keyInfo.keyver
  });
  return c;
}
var replaceInflight = null;
var unverified = false;
function markDeviceHealthy() {
  unverified = false;
}
function replaceDevice() {
  if (replaceInflight) return replaceInflight;
  replaceInflight = doReplace().finally(() => {
    replaceInflight = null;
  });
  return replaceInflight;
}
async function doReplace() {
  if (unverified) {
    console.warn(
      "[fqa:device] \u521A\u6362\u8FC7\u8BBE\u5907\u4ECD\u7136\u6536\u5230\u7A7A\u54CD\u5E94\uFF0C\u95EE\u9898\u591A\u534A\u4E0D\u5728\u8BBE\u5907\uFF08\u68C0\u67E5\u7F51\u7EDC\u4EE3\u7406\u662F\u5426\u62E6\u4E86 reading.snssdk.com\uFF09"
    );
    return null;
  }
  if (settings.deviceId.trim() && settings.installId.trim()) {
    console.warn("[fqa:device] \u5F53\u524D\u662F\u624B\u586B\u8BBE\u5907\uFF0C\u4E0D\u81EA\u52A8\u66FF\u6362\u3002\u82E5\u63A5\u53E3\u6301\u7EED\u5931\u8D25\uFF0C\u8BF7\u5230\u8BBE\u7F6E\u91CC\u6E05\u7A7A\u6216\u6539\u7528\u81EA\u52A8\u6CE8\u518C");
    return null;
  }
  unverified = true;
  console.warn("[fqa:device] \u5F53\u524D\u8BBE\u5907\u5DF2\u88AB\u670D\u52A1\u7AEF\u4F5C\u5E9F\uFF0C\u6B63\u5728\u6CE8\u518C\u65B0\u8BBE\u5907\u2026");
  try {
    del("keyinfo");
    config_default.currentConfig.key_info = void 0;
    const c = await provisionDevice();
    console.log("[fqa:device] \u5DF2\u6362\u5230\u65B0\u8BBE\u5907:", c.device_id);
    return c;
  } catch (e) {
    console.error("[fqa:device] \u6CE8\u518C\u65B0\u8BBE\u5907\u5931\u8D25:", e);
    return null;
  }
}

// src/api/app.ts
var appBaseUrl = "https://reading.snssdk.com/reading";
var redcandleBaseUrl = "https://api5-sinfonlinec.jxbhmy.com/reading";
var appUserAgent = "com.dragon.read";
function buildAppQuery(extra) {
  const c = config_default.currentConfig;
  return new URLSearchParams({
    iid: c.install_id,
    device_id: c.device_id,
    ac: "wifi",
    channel: "43536163a",
    aid: "1967",
    app_name: "novelapp",
    version_code: "70132",
    version_name: "7.0.1.32",
    device_platform: "android",
    os: "android",
    ssmix: "a",
    os_version: "10",
    device_type: c.device_type || "P30",
    device_brand: c.device_brand || "realme",
    update_version_code: "70132",
    manifest_version_code: "70132",
    pv_player: "70132",
    ...extra
  });
}
function isUsable(res) {
  if (!res || res.status !== 200) return false;
  try {
    const j = res.json();
    return !j || j.code === void 0 || j.code === 0;
  } catch {
    return false;
  }
}
async function requestApp(path, query, headers) {
  const url = `${appBaseUrl}${path}?${buildAppQuery(query).toString()}`;
  const signed = await signRequest(url);
  return apiFetch(url, {
    method: "GET",
    headers: { ...signed, "User-Agent": appUserAgent, ...headers }
  });
}
async function requestRedcandle(path, query, headers) {
  const url = `${redcandleBaseUrl}${path}?${buildAppQuery(query).toString()}`;
  return apiFetch(url, {
    method: "GET",
    headers: { "User-Agent": appUserAgent, ...headers }
  });
}
async function requestAppWithRecovery(path, query, headers) {
  const res = await requestApp(path, query, headers);
  if (!isEmptyResponse(res)) {
    markDeviceHealthy();
    return res;
  }
  console.warn(`[fqa:api] ${path} \u8FD4\u56DE\u7A7A\u54CD\u5E94\u4F53\uFF0C\u5224\u5B9A\u5F53\u524D\u8BBE\u5907\u5DF2\u5931\u6548`);
  if (!await replaceDevice()) return res;
  const retry = await requestApp(path, query, headers);
  if (!isEmptyResponse(retry)) markDeviceHealthy();
  return retry;
}
async function appGet(path, query, headers) {
  if (settings.apiPreference === "redcandle") {
    try {
      const res = await requestRedcandle(path, query, headers);
      if (isUsable(res)) return res;
      console.warn(`[fqa:api] \u7EA2\u70DB\u63A5\u53E3\u6570\u636E\u4E0D\u5168\uFF0C\u56DE\u843D\u5230\u756A\u8304 APP: ${path}`);
    } catch (e) {
      console.warn(`[fqa:api] \u7EA2\u70DB\u63A5\u53E3\u8BF7\u6C42\u5931\u8D25\uFF0C\u56DE\u843D\u5230\u756A\u8304 APP: ${path}`, e);
    }
  }
  return requestAppWithRecovery(path, query, headers);
}
async function appPost(path, body, query, headers) {
  return postSigned(appBaseUrl + path, body, query, headers);
}
async function postSigned(base, body, query, headers) {
  const url = `${base}?${buildAppQuery(query).toString()}`;
  const signed = await signRequest(url, body);
  console.log("---start--- APP POST ", url);
  const res = await apiFetch(url, {
    method: "POST",
    headers: {
      ...signed,
      "User-Agent": appUserAgent,
      "Content-Type": "application/json; charset=utf-8",
      ...headers
    },
    body
  });
  console.log("---complete--- APP POST ", url, res);
  return res;
}

// src/crypto/content.ts
async function decryptChapter(encrypted, rawData, config = defaultConfig) {
  if (!encrypted) {
    throw new Error("Invalid encrypted chapter");
  }
  ;
  const buf = b64decode(encrypted);
  const iv = buf.slice(0, 16);
  const data = buf.slice(16);
  const key = config.key_info?.key;
  if (!key) {
    throw new Error("Missing decrypt key");
  }
  const subtle = getSubtle();
  const cryptoKey = await subtle.importKey(
    "raw",
    key,
    { name: "AES-CBC" },
    false,
    ["decrypt"]
  );
  return subtle.decrypt(
    { name: "AES-CBC", iv },
    cryptoKey,
    data
  ).then(async (decrypted) => {
    if (rawData && rawData?.compress_status === 1) {
      decrypted = await gunzip(decrypted);
    }
    const decoder = new TextDecoder();
    const plain = decoder.decode(decrypted);
    if (plain.trim().startsWith("<")) {
      return plain;
    }
    try {
      return JSON.parse(plain);
    } catch (e) {
      console.warn("Invalid chapter content: ", plain, e);
      return void 0;
    }
  });
}

// src/crypto/registerkey.ts
function reverseHex(value) {
  const be = BigInt(value).toString(16).padStart(32, "0");
  let result = "";
  for (let i2 = be.length; i2 > 0; i2 -= 2) result += be.slice(i2 - 2, i2);
  return result;
}
async function encryptKeyinfoBody(config) {
  const deviceId = config.device_id;
  const iv = new TextEncoder().encode(randomString(16));
  const data = new Uint8Array(unhex(reverseHex(deviceId))).slice(0, 8);
  console.log(data);
  const subtle = getSubtle();
  const k = await subtle.importKey(
    "raw",
    shared_key,
    { name: "AES-CBC" },
    false,
    ["encrypt"]
  );
  const encrypted = await subtle.encrypt(
    { name: "AES-CBC", iv },
    k,
    data
  );
  const final = new Uint8Array(iv.length + encrypted.byteLength);
  console.log(final);
  final.set(iv, 0);
  final.set(new Uint8Array(encrypted), iv.length);
  return JSON.stringify({
    content: b64encode(final.buffer)
  });
}
async function decryptKeyinfoResponse(encrypted) {
  const buf = b64decode(encrypted);
  const iv = buf.slice(0, 16);
  const data = buf.slice(16);
  const subtle = getSubtle();
  const k = await subtle.importKey(
    "raw",
    shared_key,
    { name: "AES-CBC" },
    false,
    ["decrypt"]
  );
  return subtle.decrypt(
    { name: "AES-CBC", iv },
    k,
    data
  );
}

// src/api/content.ts
async function refreshKeyinfo() {
  const b = await encryptKeyinfoBody(config_default.currentConfig);
  const res = await appPost("/crypt/registerkey", b);
  const j = res.json();
  const ek = j?.data?.key;
  if (!ek) {
    throw new Error(`Failed to get key info: ${res.responseText}`);
  }
  const key = await decryptKeyinfoResponse(ek);
  const keyinfo = {
    key,
    keyver: j?.data?.keyver
  };
  console.log("Refreshed key info:", keyinfo);
  config_default.currentConfig.key_info = keyinfo;
  write("keyinfo", {
    key: b64encode(key),
    keyver: j?.data?.keyver
  });
}
var refreshInflight = null;
function refreshKey() {
  if (!refreshInflight) {
    refreshInflight = refreshKeyinfo().finally(() => {
      refreshInflight = null;
    });
  }
  return refreshInflight;
}
async function ensureKeyinfo(expectedKeyVersion) {
  const keyinfo = config_default.currentConfig.key_info;
  const cachedKeyInfo = read("keyinfo");
  console.log("cached key info: ", cachedKeyInfo);
  if (cachedKeyInfo) {
    const cki = {
      key: b64decode(cachedKeyInfo.key),
      keyver: cachedKeyInfo.keyver
    };
    if (typeof expectedKeyVersion === "undefined" || cki.keyver === expectedKeyVersion) {
      config_default.currentConfig.key_info = cki;
      return;
    }
  }
  if (!keyinfo) {
    return await refreshKey();
  }
  if (keyinfo?.keyver !== expectedKeyVersion) {
    return await refreshKey();
  }
}
async function getChapter(itemId, _retry) {
  if (typeof _retry === "undefined") _retry = 0;
  if (_retry > 5) {
    throw new Error(`Failed to get chapter: ${itemId}`);
  }
  if (!config_default.currentConfig.key_info) {
    await ensureKeyinfo();
  }
  const res = await appGet("/reader/full/v", { item_id: itemId, req_type: "1" });
  const j = res.json()?.data;
  if (!j) {
    console.warn("Failed to get chapter: ", itemId, ", response: ", res.responseText);
    return await getChapter(itemId, _retry + 1);
  }
  if (j?.content === "Invalid" || j?.key_version !== config_default.currentConfig.key_info?.keyver) {
    console.warn("Key reg expired, regster again and retrying...");
    if (j?.content === "Invalid") {
      await refreshKey();
    } else {
      await ensureKeyinfo(parseInt(j?.key_version));
    }
    return await getChapter(itemId, _retry + 1);
  }
  j.content = await decryptChapter(j?.content, j, config_default.currentConfig);
  return j;
}

// build/worker-entry.ts
async function getFullChapter(itemId) {
  const tryGet = async () => {
    try {
      const ch = await getChapter(itemId);
      const c = typeof ch.content === "string" ? ch.content : JSON.stringify(ch.content);
      if (c && c.length > 300 && !c.includes("Invalid")) {
        return { content: c, title: ch.title || "" };
      }
      return null;
    } catch (e) {
      return null;
    }
  };
  let r = await tryGet();
  if (r) return { ...r, source: "default" };
  try {
    const d = await registerDevice();
    await activatePremium(d).catch(() => "");
    config_default.currentConfig = {
      device_id: d.device_id,
      install_id: d.install_id,
      device_type: d.device_type,
      key_info: void 0
    };
    r = await tryGet();
    if (r) return { ...r, source: "fresh" };
  } catch (e) {
  }
  throw new Error("all devices failed");
}
/*! Bundled license information:

@vue/shared/dist/shared.esm-bundler.js:
  (**
  * @vue/shared v3.5.40
  * (c) 2018-present Yuxi (Evan) You and Vue contributors
  * @license MIT
  **)

@vue/reactivity/dist/reactivity.esm-bundler.js:
  (**
  * @vue/reactivity v3.5.40
  * (c) 2018-present Yuxi (Evan) You and Vue contributors
  * @license MIT
  **)

@vue/runtime-core/dist/runtime-core.esm-bundler.js:
  (**
  * @vue/runtime-core v3.5.40
  * (c) 2018-present Yuxi (Evan) You and Vue contributors
  * @license MIT
  **)

vue/dist/vue.runtime.esm-bundler.js:
  (**
  * vue v3.5.40
  * (c) 2018-present Yuxi (Evan) You and Vue contributors
  * @license MIT
  **)
*/
// APP 搜索（一体化，无需代理/签名）— 红烛搜索接口
// APP 搜索（一体化）— 签名请求 + 红烛直连双路
// APP 搜索（一体化）— 多路径签名尝试
// APP 搜索（一体化）— 签名请求
// APP 搜索（一体化）— 模拟 Chrome 完整请求头
// APP 搜索（一体化）— 官网搜索 API + Cookie 获取
return { getFullChapter };
})();

function xhtmlToText(xhtml) {
  if (!xhtml) return "";
  const m = xhtml.match(/<body[^>]*>([\s\S]*?)<\/body>/);
  const body = m ? m[1] : xhtml;
  let t = body
    .replace(/<\/p>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/h1>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  t = t.replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
       .replace(/&quot;/g, "\"").replace(/&apos;/g, "'")
       .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
       .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
       .replace(/&amp;/g, "&");
  return t.replace(/\n{3,}/g, "\n\n").trim();
}


const FONT_MAP = {58344:"D",58345:"在",58346:"主",58347:"特",58348:"家",58349:"军",58350:"然",58351:"表",58352:"场",58353:"4",58354:"要",58355:"只",58356:"v",58357:"和",58359:"6",58360:"别",58361:"还",58362:"g",58363:"现",58364:"儿",58365:"岁",58368:"此",58369:"象",58370:"月",58371:"3",58372:"出",58373:"战",58374:"工",58375:"相",58376:"o",58377:"男",58378:"直",58379:"失",58380:"世",58381:"F",58382:"都",58383:"平",58384:"文",58385:"什",58386:"V",58387:"O",58388:"将",58389:"真",58390:"T",58391:"那",58392:"当",58394:"会",58395:"立",58396:"些",58397:"u",58398:"是",58399:"十",58400:"张",58401:"学",58402:"气",58403:"大",58404:"爱",58405:"两",58406:"命",58407:"全",58408:"后",58409:"东",58410:"性",58411:"通",58412:"被",58413:"1",58414:"它",58415:"乐",58416:"接",58417:"而",58418:"感",58419:"车",58420:"山",58421:"公",58422:"了",58423:"常",58424:"以",58425:"何",58426:"可",58427:"话",58428:"先",58429:"p",58430:"i",58431:"叫",58432:"轻",58433:"M",58434:"士",58435:"w",58436:"着",58437:"变",58438:"尔",58439:"快",58440:"l",58441:"个",58442:"说",58443:"少",58444:"色",58445:"里",58446:"安",58447:"花",58448:"远",58449:"7",58450:"难",58451:"师",58452:"放",58453:"t",58454:"报",58455:"认",58456:"面",58457:"道",58458:"S",58460:"克",58461:"地",58462:"度",58463:"I",58464:"好",58465:"机",58466:"U",58467:"民",58468:"写",58469:"把",58470:"万",58471:"同",58472:"水",58473:"新",58474:"没",58475:"书",58476:"电",58477:"吃",58478:"像",58479:"斯",58480:"5",58481:"为",58482:"y",58483:"白",58484:"几",58485:"日",58486:"教",58487:"看",58488:"但",58489:"第",58490:"加",58491:"候",58492:"作",58493:"上",58494:"拉",58495:"住",58496:"有",58497:"法",58498:"r",58499:"事",58500:"应",58501:"位",58502:"利",58503:"你",58504:"声",58505:"身",58506:"国",58507:"问",58508:"马",58509:"女",58510:"他",58511:"Y",58512:"比",58513:"父",58514:"x",58515:"A",58516:"H",58517:"N",58518:"s",58519:"X",58520:"边",58521:"美",58522:"对",58523:"所",58524:"金",58525:"活",58526:"回",58527:"意",58528:"到",58529:"z",58530:"从",58531:"j",58532:"知",58533:"又",58534:"内",58535:"因",58536:"点",58537:"Q",58538:"三",58539:"定",58540:"8",58541:"R",58542:"b",58543:"正",58544:"或",58545:"夫",58546:"向",58547:"德",58548:"听",58549:"更",58551:"得",58552:"告",58553:"并",58554:"本",58555:"q",58556:"过",58557:"记",58558:"L",58559:"让",58560:"打",58561:"f",58562:"人",58563:"就",58564:"者",58565:"去",58566:"原",58567:"满",58568:"体",58569:"做",58570:"经",58571:"K",58572:"走",58573:"如",58574:"孩",58575:"c",58576:"G",58577:"给",58578:"使",58579:"物",58581:"最",58582:"笑",58583:"部",58585:"员",58586:"等",58587:"受",58588:"k",58589:"行",58590:"一",58591:"条",58592:"果",58593:"动",58594:"光",58595:"门",58596:"头",58597:"见",58598:"往",58599:"自",58600:"解",58601:"成",58602:"处",58603:"天",58604:"能",58605:"于",58606:"名",58607:"其",58608:"发",58609:"总",58610:"母",58611:"的",58612:"死",58613:"手",58614:"入",58615:"路",58616:"进",58617:"心",58618:"来",58619:"h",58620:"时",58621:"力",58622:"多",58623:"开",58624:"已",58625:"许",58626:"d",58627:"至",58628:"由",58629:"很",58630:"界",58631:"n",58632:"小",58633:"与",58634:"Z",58635:"想",58636:"代",58637:"么",58638:"分",58639:"生",58640:"口",58641:"再",58642:"妈",58643:"望",58644:"次",58645:"西",58646:"风",58647:"种",58648:"带",58649:"J",58651:"实",58652:"情",58653:"才",58654:"这",58656:"E",58657:"我",58658:"神",58659:"格",58660:"长",58661:"觉",58662:"间",58663:"年",58664:"眼",58665:"无",58666:"不",58667:"亲",58668:"关",58669:"结",58670:"0",58671:"友",58672:"信",58673:"下",58674:"却",58675:"重",58676:"己",58677:"老",58678:"2",58679:"音",58680:"字",58681:"m",58682:"呢",58683:"明",58684:"之",58685:"前",58686:"高",58687:"P",58688:"B",58689:"目",58690:"太",58691:"e",58692:"9",58693:"起",58694:"稜",58695:"她",58696:"也",58697:"W",58698:"用",58699:"方",58700:"子",58701:"英",58702:"每",58703:"理",58704:"便",58705:"四",58706:"数",58707:"期",58708:"中",58709:"C",58710:"外",58711:"样",58712:"a",58713:"海",58714:"们",58715:"任"};

// 硬编码代理池（可选）。
// 2026-10-24 实测以下公开端点全部不可用，故不预置：
//   api.cenguigui.cn           -> HTTP 521
//   sdkapi.fanqieopen.com      -> 连接失败
//   fq.travacocro.com          -> 超时
//   novel.snssdk.com           -> 200 但空响应
//   101.35.133.34:5000         -> Empty reply
//   fq.beitai.cc               -> HTTP 525
//   fq.beitai.vip              -> DNS 失败
// 请自行填入实测可用的代理，格式：
//   { name: "x", base: "https://host", contentPath: "/content?item_id={id}" }
// contentPath 可省略，默认 /content?tab=小说&item_id={id}
const HARDCODED_PROXIES = [];

const PROXY_KV_KEY = "proxy:pool";
const PROXY_META_KEY = "proxy:last_probe";

const WEB_BASE = "https://fanqienovel.com";
const UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36";
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type",
};
const json = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json; charset=utf-8", ...CORS } });

async function fetchT(url, opts = {}, ms = 15000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...opts, signal: c.signal }); }
  finally { clearTimeout(t); }
}

async function parseBookId(v) {
  if (!v) return "";
  let s = String(v).trim();
  if (/^\d{10,}$/.test(s)) return s;
  // 从混杂文本中提取 URL（例如「推荐一部好书《…》https://…」）
  const urlM = s.match(/https?:\/\/[^\s"'<>）)]+/);
  if (urlM) s = urlM[0];

  // 七猫：qimao.com/shuku/<id>/ 或 m.qimao.com/shuku/<id>（6+ 位数字 ID）
  // 注意：七猫书 ID 是 6~9 位（如 222767），须在 fanqie 之前匹配。
  const qmM = s.match(/(?:m\.)?qimao\.com\/shuku\/(\d{4,})/);
  if (qmM) return qmM[1];
  // 七猫移动版也可能带 ?book_id=xxx
  if (/qimao\.com/.test(s)) {
    try {
      const bid = new URL(s).searchParams.get("book_id");
      if (bid && /^\d{4,}$/.test(bid)) return bid;
    } catch (e) {}
  }

  // changdunovel.com/t/xxx/ 短链接：读 302 Location 里的 book_id
  if (/changdunovel\.com\/t\//.test(s)) {
    try {
      const r = await fetch(s, { redirect: "manual", headers: { "user-agent": UA } });
      const loc = r.headers.get("location") || "";
      const m1 = loc.match(/[?&]book_id=(\d{10,})/);
      if (m1) return m1[1];
      const m2 = loc.match(/\/(?:page|reader)\/(\d{10,})/);
      if (m2) return m2[1];
      // 退路：follow 一次拿落点
      const r2 = await fetch(s, { redirect: "follow", headers: { "user-agent": UA } });
      const m3 = r2.url.match(/[?&]book_id=(\d{10,})/);
      if (m3) return m3[1];
    } catch (e) {}
    return "";
  }
  // share-v2.html?book_id=xxx
  if (/changdunovel\.com\/wap\/share-v2\.html/.test(s)) {
    try {
      const bid = new URL(s).searchParams.get("book_id");
      if (bid && /^\d{10,}$/.test(bid)) return bid;
    } catch (e) {}
  }
  // book-share?book_id=xxx
  if (/changdunovel\.com\/ug\/pages\/book-share/.test(s)) {
    try {
      const bid = new URL(s).searchParams.get("book_id");
      if (bid && /^\d{10,}$/.test(bid)) return bid;
    } catch (e) {}
  }
  // fanqienovel.com/page/xxx 或 /reader/xxx
  const m = s.match(/\/(?:page|reader)\/(\d{10,})/);
  if (m) return m[1];
  return "";
}

// 从原始文本判断书源：'qimao' | 'fanqie'（默认）
function sourceFromUrl(v) {
  const s = String(v || "");
  return /(?:m\.)?qimao\.com/.test(s) ? "qimao" : "fanqie";
}


// ---------- 最小 ZIP 生成器（store，无压缩） ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function makeZip(files) {
  const enc = new TextEncoder();
  const locals = [];
  const centrals = [];
  let offset = 0;
  const now = new Date();
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF;
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;

  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const data = typeof f.data === "string" ? enc.encode(f.data) : f.data;
    const crc = crc32(data);
    const size = data.length;

    const lh = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    lh.set(nameBytes, 30);

    locals.push(lh, data);

    const ch = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    ch.set(nameBytes, 46);
    centrals.push(ch);

    offset += lh.length + size;
  }

  const cdStart = offset;
  let cdSize = 0;
  for (const c of centrals) cdSize += c.length;

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, cdStart, true);
  ev.setUint16(20, 0, true);

  const total = offset + cdSize + 22;
  const out = new Uint8Array(total);
  let p = 0;
  for (const part of locals) { out.set(part, p); p += part.length; }
  for (const c of centrals) { out.set(c, p); p += c.length; }
  out.set(eocd, p);
  return out;
}

// ---------- ld+json 抓作者/封面 ----------
function extractLdJson(html) {
  const out = {};
  const re = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)%%CS%%/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const j = JSON.parse(m[1]);
      const arr = Array.isArray(j) ? j : [j];
      for (const x of arr) {
        if (x.author && !out.author) {
          const a = Array.isArray(x.author) ? x.author[0] : x.author;
          out.author = a?.name || "";
        }
        if (x.image && !out.cover) {
          out.cover = Array.isArray(x.image) ? x.image[0] : x.image;
        }
        if (x.headline && !out.headline) out.headline = x.headline;
      }
    } catch (e) {}
  }
  return out;
}

const escHtml = (s) => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

function decodeFont(s) {
  let out = "";
  for (const ch of s) {
    const r = FONT_MAP[ch.codePointAt(0)];
    out += r !== undefined ? r : ch;
  }
  return out;
}

function parseState(html) {
  const marker = "window.__INITIAL_STATE__=";
  const i = html.indexOf(marker);
  if (i < 0) return null;
  const s = html.slice(i + marker.length).trimStart();
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let k = 0; k < s.length; k++) {
    const c = s[k];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) { end = k + 1; break; } }
  }
  if (end < 0) return null;
  try { return JSON.parse(s.slice(0, end)); } catch (e) { return null; }
}

const stripTags = (h) => h
  .replace(/<script[\s\S]*?%%CS%%/gi, "")
  .replace(/<style[\s\S]*?<\/style>/gi, "")
  .replace(/<br\s*\/?>/gi, "\n")
  .replace(/<\/p>/gi, "\n")
  .replace(/<[^>]+>/g, "")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
  .replace(/\n{3,}/g, "\n\n").trim();

async function proxyList(env) {
  const out = [];
  // 1) 用户单一代理（不受开关控制，始终优先）
  let user = env?.FANQIE_PROXY_API || null;
  if (!user && env?.FANQIE_KV) user = await env.FANQIE_KV.get("proxy_api");
  if (user) out.push({ name: "user", base: String(user).replace(/\/$/, "") });

  // 2) KV 代理池（需 FANQIE_USE_PROXY=1）
  if (env?.FANQIE_USE_PROXY === "1" && env?.FANQIE_KV) {
    try {
      const raw = await env.FANQIE_KV.get(PROXY_KV_KEY);
      const pool = JSON.parse(raw || "[]");
      for (const p of pool) {
        if (p && p.base) out.push({
          name: p.name || "pool",
          base: String(p.base).replace(/\/$/, ""),
          contentPath: p.contentPath || null,
        });
      }
    } catch (e) {}
  }

  // 3) 硬编码兜底
  for (const p of HARDCODED_PROXIES) out.push(p);
  return out;
}

async function proxyGet(env, path, params) {
  const qs = new URLSearchParams(params).toString();
  for (const p of await proxyList(env)) {
    try {
      let url;
      if (path === "/content" && p.contentPath) {
        url = p.base + p.contentPath.replace("{id}", encodeURIComponent(params.item_id || ""));
      } else {
        url = `${p.base}${path}?${qs}`;
      }
      const r = await fetchT(url, { headers: { "user-agent": UA } }, 10000);
      if (!r.ok) continue;
      const d = await r.json();
      if (d && (d.code === 200 || d.code === 0 || d.success === true)) {
        return { ok: true, from: p.name, data: d };
      }
    } catch (e) {}
  }
  return { ok: false };
}

async function webGet(path, env) {
  const headers = {
    "user-agent": UA,
    accept: "text/html,application/xhtml+xml",
    "accept-language": "zh-CN,zh;q=0.9",
  };
  if (env?.FANQIE_COOKIE) headers.cookie = env.FANQIE_COOKIE;
  else if (env?.FANQIE_KV) {
    const c = await env.FANQIE_KV.get("svip_cookie");
    if (c) headers.cookie = c;
  }
  const r = await fetchT(WEB_BASE + path, { headers }, 15000);
  if (!r.ok) throw new Error(`web ${r.status} ${path}`);
  return r.text();
}

// ---------- 搜索 ----------
async function hSearch(env, key) {
  if (!key) return json({ code: 400, message: "key required" }, 400);
  const r = await proxyGet(env, "/search", { key, tab_type: 3 });
  if (r.ok) return json({ code: 200, from: r.from, data: r.data });
  // 番茄的公网搜索接口会触发滑块验证；无上游搜索服务时仅支持书籍 ID 直开。
  if (/^\d{15,}$/.test(key)) {
    return json({ code: 200, from: "id", data: { book_ids: [key] }, note: "key treated as book_id" });
  }
  return json({
    code: 501,
    message: "title search requires FANQIE_PROXY_API or an authenticated upstream; paste a book URL or numeric book_id instead",
  }, 501);
}

// ---------- 详情 ----------
async function hDetail(env, book_id) {
  book_id = await parseBookId(book_id);
  if (!book_id) return json({ code: 400, message: "book_id or book URL required" }, 400);
  const r = await proxyGet(env, "/detail", { book_id });
  if (r.ok) return json({ code: 200, from: r.from, data: r.data });
  try {
    const html = await webGet(`/page/${book_id}`, env);
    const st = parseState(html);
    const p = st?.page || {};
    if (!p.bookName) return json({ code: 404, from: "web", message: "book not found" }, 404);
    const ld = extractLdJson(html);
    return json({
      code: 200, from: "web",
      data: {
        book_id: String(p.bookId || book_id),
        book_name: p.bookName,
        author: p.author || ld.author || "",
        abstract: p.abstract || "",
        status: String(p.status ?? ""),
        word_number: p.wordNumber ?? 0,
        chapter_total: p.chapterTotal ?? (p.itemIds || []).length,
        last_chapter_title: p.lastChapterTitle || "",
        cover: ld.cover || "",
      },
    });
  } catch (e) { return json({ code: 502, message: String(e) }, 502); }
}

// ---------- 目录 ----------
async function hDirectory(env, book_id) {
  book_id = await parseBookId(book_id);
  if (!book_id) return json({ code: 400, message: "book_id or book URL required" }, 400);
  const r = await proxyGet(env, "/directory", { book_id });
  if (r.ok) return json({ code: 200, from: r.from, data: r.data });
  try {
    const html = await webGet(`/page/${book_id}`, env);
    const st = parseState(html);
    const p = st?.page || {};
    const ids = (p.itemIds || []).slice().reverse(); // 页面为倒序，反转成正序
    if (!ids.length) return json({ code: 404, from: "web", message: "no chapters" }, 404);
    // 标题：chapterList 只覆盖前 50 条，其余 title 留空由 /api/content 补
    const titleMap = {};
    for (const c of (p.chapterList || [])) {
      if (c.itemId) titleMap[String(c.itemId)] = c.title || "";
    }
    const lists = ids.map((id, i) => ({
      item_id: String(id),
      title: titleMap[String(id)] || "",
      order: i + 1,
    }));
    return json({
      code: 200, from: "web",
      data: {
        book_id: String(p.bookId || book_id),
        book_name: p.bookName || "",
        author: p.author || "",
        chapter_total: ids.length,
        lists,
      },
    });
  } catch (e) { return json({ code: 502, message: String(e) }, 502); }
}

// ---------- 正文 ----------
async function hContent(env, item_id) {
  item_id = await parseBookId(item_id);
  if (!item_id) return json({ code: 400, message: "item_id or reader URL required" }, 400);

  // 1) 代理优先
  const pr = await proxyGet(env, "/content", { tab: "小说", item_id });
  if (pr.ok) {
    const d = pr.data;
    let content = "";
    if (d.data && typeof d.data === "object") content = d.data.content || d.data.chapter_content || "";
    else if (typeof d.data === "string") content = d.data;
    if (content) {
      return json({ code: 200, from: pr.from, data: { item_id: String(item_id), content: decodeFont(stripTags(content)), source: "proxy" } });
    }
  }

  // 2) 网页
  let webOk = false;
  let webData = null;
  try {
    const html = await webGet(`/reader/${item_id}`, env);
    const st = parseState(html);
    const cd = st?.reader?.chapterData;
    if (cd && cd.content) {
      const content = decodeFont(stripTags(cd.content));
      const locked = cd.isChapterLock === true;
      if (!locked && content.length >= 500) {
        return json({ code: 200, from: "web", data: {
          item_id: String(cd.itemId || item_id), book_id: String(cd.bookId || ""),
          book_name: cd.bookName || "", title: cd.title || "",
          order: cd.order ?? 0, word_count: cd.chapterWordNumber ?? 0,
          content, locked: false, truncated: false,
        } });
      }
      webOk = true;
      webData = { cd, content, locked };
    }
  } catch (e) {}

  // 3) 网页锁定/失败 → APP 接口
  try {
    const full = await __FQ.getFullChapter(item_id);
    const text = xhtmlToText(full.content);
    if (text && text.length > 200) {
      return json({ code: 200, from: "app", data: {
        item_id: String(item_id), book_id: webData?.cd?.bookId || "",
        book_name: webData?.cd?.bookName || "", title: full.title || webData?.cd?.title || "",
        order: webData?.cd?.order ?? 0, word_count: text.length,
        content: text, locked: false, truncated: false, source: "app",
      } });
    }
  } catch (e) {
    if (webOk && webData) {
      return json({ code: 200, from: "web", data: {
        item_id: String(item_id), book_id: webData.cd.bookId || "",
        book_name: webData.cd.bookName || "", title: webData.cd.title || "",
        order: webData.cd.order ?? 0, word_count: webData.cd.chapterWordNumber ?? 0,
        content: webData.content, locked: webData.locked, truncated: true,
        error: String(e),
      } });
    }
    return json({ code: 502, message: String(e) }, 502);
  }

  return json({ code: 404, message: "chapter not found" }, 404);
}

// ---------- 分段下载 (规避 Workers 子请求上限) ----------
async function hDownload(env, book_id, start, count) {
  book_id = await parseBookId(book_id);
  if (!book_id) return json({ code: 400, message: "book_id or book URL required" }, 400);
  const dj = await (await hDirectory(env, book_id)).json();
  if (dj.code !== 200) return json(dj, dj.code || 500);
  const lists = dj?.data?.lists || [];
  const s = Math.max(0, parseInt(start || "0", 10) || 0);
  const n = Math.min(30, Math.max(1, parseInt(count || "20", 10) || 20));
  const slice = lists.slice(s, s + n);
  if (!slice.length) return json({ code: 416, message: "range out of bounds", total: lists.length }, 416);
  const parts = [];
  for (const it of slice) {
    const cj = await (await hContent(env, String(it.item_id))).json();
    const title = it.title || cj?.data?.title || it.item_id;
    parts.push(`## ${title}\n\n${cj?.data?.content || "[获取失败]"}`);
  }
  return json({
    code: 200,
    book_id, book_name: dj.data.book_name || "",
    total: lists.length, start: s, count: slice.length,
    next: s + slice.length < lists.length ? s + slice.length : null,
    text: parts.join("\n\n"),
  });
}


// ---------- 整本导出（txt / html / epub，分批） ----------
async function hExport(env, book_id, format, start, count) {
  book_id = await parseBookId(book_id);
  if (!book_id) return json({ code: 400, message: "book_id or book URL required" }, 400);
  format = (format || "txt").toLowerCase();
  if (!["txt", "html", "epub"].includes(format)) {
    return json({ code: 400, message: "format must be txt|html|epub" }, 400);
  }

  const dj = await (await hDirectory(env, book_id)).json();
  if (dj.code !== 200) return json(dj, dj.code || 500);
  const lists = dj.data.lists || [];
  const bookName = dj.data.book_name || book_id;
  const total = lists.length;

  const s = Math.max(0, parseInt(start || "0", 10) || 0);
  const n = Math.min(45, Math.max(1, parseInt(count || "20", 10) || 20));
  const slice = lists.slice(s, s + n);
  if (!slice.length) return json({ code: 416, message: "range out of bounds", total }, 416);

  const parts = await fetchChaptersParallel(env, slice, 10);
  const tail = s + slice.length < total ? s + slice.length : null;
  const texts = parts.map((p) => p.text);

  if (format === "txt") {
    return json({ code: 200, format, book_id, book_name: bookName, total, start: s, count: slice.length, next: tail, text: texts.join("\n\n") });
  }

  // html / epub：本批生成片段，客户端拼接或服务端最终打包
  if (format === "html") {
    const body = slice.map((it, i) => {
      const raw = (parts[i] && parts[i].text) || "";
      const title = it.title || raw.split("\n")[0].replace(/^##\s*/, "") || it.item_id;
      const content = raw.replace(/^##[^\n]*\n+/, "").split("\n").map((l) => `<p>${escHtml(l)}</p>`).join("\n");
      return `<section id="c_${it.item_id}"><h2>${escHtml(title)}</h2>${content}</section>`;
    }).join("\n");
    return json({ code: 200, format, book_id, book_name: bookName, total, start: s, count: slice.length, next: tail, html: body });
  }

  // epub：返回本批 xhtml 片段，最终由 /api/export/final 或 DO 打包
  const chapters = slice.map((it, i) => {
    const raw = (parts[i] && parts[i].text) || "";
    const title = it.title || it.item_id;
    const content = raw.replace(/^##[^\n]*\n+/, "").split("\n").map((l) => `<p>${escHtml(l)}</p>`).join("\n");
    return { id: it.item_id, title, xhtml: `<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8"/><title>${escHtml(title)}</title></head><body><h2>${escHtml(title)}</h2>${content}</body></html>` };
  });
  return json({ code: 200, format, book_id, book_name: bookName, total, start: s, count: slice.length, next: tail, chapters });
}

// ---------- 更新检查（对比 KV 记录的章节数） ----------
async function hUpdateCheck(env, book_id) {
  book_id = await parseBookId(book_id);
  if (!book_id) return json({ code: 400, message: "book_id or book URL required" }, 400);

  const dj = await (await hDirectory(env, book_id)).json();
  if (dj.code !== 200) return json(dj, dj.code || 500);
  const total = dj.data.chapter_total;
  const bookName = dj.data.book_name;

  let lastSeen = 0;
  if (env?.FANQIE_KV) {
    const v = await env.FANQIE_KV.get(`record:${book_id}`);
    lastSeen = parseInt(v || "0", 10) || 0;
    if (total > lastSeen) await env.FANQIE_KV.put(`record:${book_id}`, String(total));
  }

  const newCount = lastSeen ? Math.max(0, total - lastSeen) : total;
  return json({
    code: 200, book_id, book_name: bookName,
    total, last_seen: lastSeen, new_chapters: newCount,
    has_kv: !!env?.FANQIE_KV,
    next_start: lastSeen || 0,
  });
}


// ---------- 分批打包 zip（txt/html） ----------
async function hExportZip(env, book_id, format, start, count) {
  book_id = await parseBookId(book_id);
  if (!book_id) return json({ code: 400, message: "book_id or book URL required" }, 400);
  format = (format || "txt").toLowerCase();
  if (!["txt", "html"].includes(format)) {
    return json({ code: 400, message: "format must be txt|html" }, 400);
  }

  const dj = await (await hDirectory(env, book_id)).json();
  if (dj.code !== 200) return json(dj, dj.code || 500);
  const lists = dj.data.lists || [];
  const bookName = dj.data.book_name || book_id;
  const total = lists.length;

  const s = Math.max(0, parseInt(start || "0", 10) || 0);
  const n = Math.min(40, Math.max(1, parseInt(count || "20", 10) || 20));
  const slice = lists.slice(s, s + n);
  if (!slice.length) return json({ code: 416, message: "range out of bounds", total }, 416);

  const parts = await fetchChaptersParallel(env, slice, 10);
  const tail = s + slice.length < total ? s + slice.length : null;
  const texts = parts.map((p) => p.text);
  const safe = bookName.replace(/[<>:"/\\|?*]/g, "_");

  const files = [];
  if (format === "txt") {
    const body = texts.join("\n\n");
    files.push({ name: `${safe}_${s + 1}-${s + slice.length}.txt`, data: `\uFEFF${body}` });
  } else {
    files.push({
      name: "index.html",
      data: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escHtml(bookName)}</title></head><body><h1>${escHtml(bookName)}</h1><p>第 ${s + 1} - ${s + slice.length} 章 / 共 ${total} 章</p></body></html>`,
    });
    slice.forEach((it, i) => {
      const raw = (parts[i] && parts[i].text) || "";
      const title = it.title || it.item_id;
      const content = raw.replace(/^##[^\n]*\n+/, "").split("\n").map((l) => `<p>${escHtml(l)}</p>`).join("\n");
      files.push({
        name: `chapter_${String(s + i + 1).padStart(5, "0")}_${it.item_id}.html`,
        data: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escHtml(title)}</title></head><body><h2>${escHtml(title)}</h2>${content}</body></html>`,
      });
    });
  }

  const zip = makeZip(files);
  const fname = `${safe}_${s + 1}-${s + slice.length}.zip`;
  return new Response(zip, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${fname}"`,
      "x-total": String(total),
      "x-start": String(s),
      "x-count": String(slice.length),
      "x-next": tail === null ? "" : String(tail),
      ...CORS,
    },
  });
}

async function hConfig(req, env) {
  if (req.method === "GET") {
    let v = env?.FANQIE_PROXY_API || "";
    if (env?.FANQIE_KV) v = (await env.FANQIE_KV.get("proxy_api")) || v;
    return json({ code: 200, proxy_configured: v.length>0, hardcoded: HARDCODED_PROXIES.length });
  }
  if (req.method === "POST") {
    if (!env?.FANQIE_KV) return json({ code: 500, message: "FANQIE_KV not bound" }, 500);
    const b = await req.json().catch(() => ({}));
    await env.FANQIE_KV.put("proxy_api", String(b.proxy_api || "").trim());
    return json({ code: 200 });
  }
  return json({ code: 405 }, 405);
}

// ========== 七猫中文网（免费书源） ==========
// 七猫为免费阅读站（广告变现，全书免费）。若接口标记 is_vip != "0"（极少数
// 版权受限作品），按统一策略返回 paid:true，正文为空，不做任何绕过。
const QIMAO_BASE = "https://www.qimao.com";
const QIMAO_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function qmRef(book_id) { return `${QIMAO_BASE}/shuku/${book_id}/`; }

async function qmGet(path, referer) {
  const r = await fetchT(QIMAO_BASE + path, {
    headers: {
      "user-agent": QIMAO_UA,
      "accept": "application/json, text/plain, */*",
      "accept-language": "zh-CN,zh;q=0.9",
      ...(referer ? { referer } : {}),
    },
  }, 20000);
  if (!r.ok) throw new Error(`qimao HTTP ${r.status}`);
  return r.json();
}

async function qmPost(path, referer, form) {
  const r = await fetchT(QIMAO_BASE + path, {
    method: "POST",
    headers: {
      "user-agent": QIMAO_UA,
      "accept": "application/json, text/plain, */*",
      "content-type": "application/x-www-form-urlencoded",
      "referer": referer,
      "origin": QIMAO_BASE,
    },
    body: new URLSearchParams(form).toString(),
  }, 20000);
  if (!r.ok) throw new Error(`qimao HTTP ${r.status}`);
  return r.json();
}

// 从 <p>…</p> 抽正文，保留段落换行；实体解码 + 空白压缩。
function qmParagraphs(html) {
  if (!html) return "";
  const out = [];
  const re = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = re.exec(html))) {
    const text = m[1]
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\u0026quot;/g, '"')
      .replace(/\u0026apos;/g, "'")
      .replace(/\u0026#39;/g, "'")
      .split(/\s+/).filter(Boolean).join(" ")
      .trim();
    if (text) out.push(text);
  }
  return out.length ? out.join("\n\n") : (html.replace(/<[^>]+>/g, "").trim());
}

// ---------- 七猫：搜索 ----------
async function hQimaoSearch(env, key) {
  if (!key) return json({ code: 400, message: "key required" }, 400);
  try {
    const v = await qmGet("/api/search/result?keyword=" + encodeURIComponent(key), QIMAO_BASE + "/");
    const list = (v?.data?.search_list) || [];
    if (!list.length) return json({ code: 404, message: "qimao search: no results" }, 404);
    const items = list.map((b) => ({
      book_id: String(b.book_id || ""),
      book_name: b.title || b.book_name || "",
      author: b.author || "",
      book_abstract: b.intro || b.abstract || "",
      thumb_url: b.image_link || b.cover || "",
      creation_status: b.status ? String(b.status) : "",
      source: "qimao",
    })).filter((b) => b.book_id);
    return json({ code: 200, from: "qimao", data: { search_book_data_list: items, total_count: items.length } });
  } catch (e) { return json({ code: 502, message: String(e) }, 502); }
}

// ---------- 七猫：目录 ----------
async function hQimaoDirectory(env, book_id) {
  book_id = String(book_id || "").trim();
  if (!book_id) return json({ code: 400, message: "book_id required" }, 400);
  try {
    const v = await qmGet("/api/book/chapter-list?book_id=" + encodeURIComponent(book_id), qmRef(book_id));
    const arr = (v?.data?.chapters) || [];
    if (!arr.length) return json({ code: 404, message: "qimao directory: no chapters" }, 404);
    const lists = arr.map((c, i) => ({
      item_id: String(c.id || ""),
      title: c.title || "",
      order: i + 1,
      is_vip: String(c.is_vip || "0") !== "0",
      words: c.words || 0,
    })).filter((c) => c.item_id);
    // 书名/作者：优先用第一章正文接口（同域同风控，稳定），失败则留空
    let book_name = "", author = "";
    try {
      const first = lists[0].item_id;
      const ch = await qmPost("/api/book/chapter", qmRef(book_id), { book_id, chapter_id: first });
      book_name = ch?.data?.chapter?.book_title || "";
      author = ch?.data?.chapter?.author || "";
    } catch (e) { /* 忽略，正文接口失败不影响目录 */ }
    return json({
      code: 200, from: "qimao",
      data: { book_id, book_name, author, chapter_total: lists.length, lists },
    });
  } catch (e) { return json({ code: 502, message: String(e) }, 502); }
}

// ---------- 七猫：正文 ----------
async function hQimaoContent(env, item_id, book_id) {
  item_id = String(item_id || "").trim();
  if (!item_id) return json({ code: 400, message: "item_id required" }, 400);
  book_id = String(book_id || "").trim();
  try {
    const form = book_id ? { book_id, chapter_id: item_id } : { chapter_id: item_id };
    const ref = book_id ? qmRef(book_id) : QIMAO_BASE + "/";
    const v = await qmPost("/api/book/chapter", ref, form);
    const ch = v?.data?.chapter || {};
    const isVip = String(ch.is_vip || "0") !== "0";
    const raw = v?.data?.content || "";
    const content = isVip && !raw.trim() ? "" : qmParagraphs(raw);
    return json({
      code: 200, from: "qimao",
      data: {
        item_id,
        title: ch.title || "",
        book_name: ch.book_title || "",
        author: ch.author || "",
        content,
        paid: isVip,
        notice: isVip ? "（付费章节 — 本项目仅支持免费内容，不提供付费章节下载）" : "",
      },
    });
  } catch (e) { return json({ code: 502, message: String(e) }, 502); }
}

// ---------- 按书源分发目录/正文（供 TG 下载用） ----------
async function directoryFor(env, source, bookId) {
  if (source === "qimao") return await hQimaoDirectory(env, bookId);
  return await hDirectory(env, bookId);
}
async function contentFor(env, source, itemId, bookId) {
  if (source === "qimao") return await hQimaoContent(env, itemId, bookId);
  return await hContent(env, itemId);
}

// ---------- 书源能力声明 ----------
function hCaps(env) {
  return json({
    code: 200,
    sources: {
      fanqie: { free: true, paid: "cookie", enabled: true },
      qimao: { free: true, paid: false, enabled: true },
      qidian: { free: false, paid: false, enabled: false, note: "VIP 章节受 DRM/付费墙保护，不提供绕过" },
      qqread: { free: false, paid: false, enabled: false, note: "VIP 章节受 DRM/付费墙保护，不提供绕过" },
    },
  });
}


// ========== 账号系统与管理面板（移植自 tgbot.py）==========
const KV_USERS = "users";
const KV_SETTINGS = "settings";
const KV_LOGIN_LOG = "login_log";
const KV_ADMIN_SESSIONS = "admin_sessions";
const KV_LOGIN_SESSIONS = "login_sessions";
const DEFAULT_DAILY_LIMIT = 5;
const DEFAULT_WELCOME = "📖 番茄小说下载器\n\n发送小说链接即可下载完整 TXT。";

async function kvGet(env, key, def) {
  if (!env?.FANQIE_KV) return def;
  const v = await env.FANQIE_KV.get(key);
  if (v === null) return def;
  try { return JSON.parse(v); } catch (e) { return def; }
}
async function kvSet(env, key, val) {
  if (!env?.FANQIE_KV) return;
  await env.FANQIE_KV.put(key, JSON.stringify(val));
}
async function loadUsers(env) { return await kvGet(env, KV_USERS, {}); }
async function saveUsers(env, v) { return await kvSet(env, KV_USERS, v); }
async function loadSettings(env) {
  const s = await kvGet(env, KV_SETTINGS, null);
  return s || { daily_limit: DEFAULT_DAILY_LIMIT, welcome: "", announcement: "" };
}
async function saveSettings(env, s) { return await kvSet(env, KV_SETTINGS, s); }
async function loadLoginLog(env) { return await kvGet(env, KV_LOGIN_LOG, {}); }
async function saveLoginLog(env, v) { return await kvSet(env, KV_LOGIN_LOG, v); }
async function loadAdminSessions(env) { return await kvGet(env, KV_ADMIN_SESSIONS, []); }
async function saveAdminSessions(env, v) { return await kvSet(env, KV_ADMIN_SESSIONS, v); }
async function loadLoginSessions(env) { return await kvGet(env, KV_LOGIN_SESSIONS, {}); }
async function saveLoginSessions(env, v) { return await kvSet(env, KV_LOGIN_SESSIONS, v); }

function validUsername(n) { return /^[A-Za-z0-9][A-Za-z0-9_-]{2,31}$/.test(n); }
function passwordIssues(pw) {
  if (pw.length < 8) return "密码至少 8 位";
  if (!/[A-Za-z]/.test(pw)) return "密码需包含字母";
  if (!/[0-9]/.test(pw)) return "密码需包含数字";
  return "";
}
async function hashPw(pw) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pw));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}
function accountExists(users, name) {
  const n = name.toLowerCase();
  return Object.values(users).some(u => String(u.account || "").toLowerCase() === n);
}
function findUserByAccount(users, name) {
  const n = name.toLowerCase();
  return Object.values(users).find(u => String(u.account || "").toLowerCase() === n);
}
function todayStr() {
  const now = new Date();
  const cst = new Date(now.getTime() + 8 * 3600 * 1000);
  return cst.toISOString().slice(0, 10);
}

async function isAdmin(env, uid) {
  const s = await loadAdminSessions(env);
  return Array.isArray(s) && s.includes(String(uid));
}
async function isBanned(env, uid) {
  const u = await loadUsers(env);
  return !!(u[String(uid)] && u[String(uid)].banned);
}
async function logLogin(env, chatId, username, ok, reason) {
  const log = await loadLoginLog(env);
  const key = String(chatId);
  if (!log[key]) log[key] = [];
  log[key].push({
    t: new Date().toISOString().slice(0, 19),
    username, ok: !!ok, reason: reason || "",
  });
  log[key] = log[key].slice(-50);
  await saveLoginLog(env, log);
}
async function recentFails(env, chatId, windowSec) {
  const log = await loadLoginLog(env);
  const entries = (log[String(chatId)] || []).slice(-20);
  const now = Date.now();
  let n = 0;
  for (const e of entries) {
    const t = Date.parse(e.t);
    if (!isNaN(t) && (now - t) / 1000 <= windowSec && !e.ok) n++;
  }
  return n;
}

async function recordUser(env, from, chatId) {
  const users = await loadUsers(env);
  const key = String(chatId);
  const today = todayStr();
  let u = users[key];
  if (!u) {
    u = { id: chatId, username: from?.username || "", first_name: from?.first_name || "",
          today, today_count: 0, total: 0, banned: false, first_seen: today, last_seen: today };
  } else {
    u.username = from?.username || u.username || "";
    u.first_name = from?.first_name || u.first_name || "";
    u.last_seen = today;
    if (u.today !== today) { u.today = today; u.today_count = 0; }
  }
  users[key] = u;
  await saveUsers(env, users);
  return u;
}

async function checkAndConsumeQuota(env, uid) {
  const users = await loadUsers(env);
  const key = String(uid);
  const u = users[key];
  if (!u) return { ok: false, msg: "用户记录不存在，请先发送 /start" };
  const today = todayStr();
  if (u.today !== today) { u.today = today; u.today_count = 0; }
  if (await isAdmin(env, uid)) {
    u.today_count = (u.today_count || 0) + 1;
    u.total = (u.total || 0) + 1;
    users[key] = u; await saveUsers(env, users);
    return { ok: true, msg: "" };
  }
  const settings = await loadSettings(env);
  let limit = (u.daily_limit === undefined || u.daily_limit === null) ? settings.daily_limit : u.daily_limit;
  limit = parseInt(limit, 10) || 0;
  if (limit === 0) return { ok: false, msg: "⛔ 你的账号当前被禁止下载，请联系管理员。" };
  if (limit < 0) {
    u.today_count = (u.today_count || 0) + 1;
    u.total = (u.total || 0) + 1;
    users[key] = u; await saveUsers(env, users);
    return { ok: true, msg: "" };
  }
  const used = u.today_count || 0;
  if (used >= limit) return { ok: false, msg: `⚠️ 今日下载次数已达上限（${limit} 次/天）。\n管理员无此限制，明天 0 点（北京时间）自动重置。` };
  u.today_count = used + 1;
  u.total = (u.total || 0) + 1;
  users[key] = u; await saveUsers(env, users);
  return { ok: true, msg: "" };
}

async function refundQuota(env, uid) {
  const users = await loadUsers(env);
  const key = String(uid);
  const u = users[key];
  if (!u) return;
  if ((u.today_count || 0) > 0) u.today_count -= 1;
  if ((u.total || 0) > 0) u.total -= 1;
  users[key] = u;
  await saveUsers(env, users);
}


// ---------- 管理面板 UI ----------
async function tgAnswerCallback(token, callbackId, text, alert) {
  return tgCall(token, "answerCallbackQuery", {
    callback_query_id: callbackId,
    text: text || "",
    show_alert: !!alert,
  });
}

async function tgEditMessage(token, chatId, messageId, text, replyMarkup) {
  return tgCall(token, "editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: replyMarkup || undefined,
  });
}

function adminMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "👥 用户记录", callback_data: "admin_users" }, { text: "📊 下载统计", callback_data: "admin_stats" }],
      [{ text: "🚫 封禁列表", callback_data: "admin_bans" }, { text: "🎚 每日上限", callback_data: "admin_limit" }],
      [{ text: "📝 欢迎语", callback_data: "admin_welcome" }, { text: "📢 公告", callback_data: "admin_announce" }],
      [{ text: "🔐 登录日志", callback_data: "admin_logins" }, { text: "❌ 关闭", callback_data: "admin_close" }],
    ],
  };
}

function userDisplay(u) {
  const un = u.account || u.username || "";
  const fn = u.first_name || "";
  const name = un ? `@${un}` : (fn || "（无昵称）");
  return name;
}

async function adminUsersPage(env, offset) {
  const users = await loadUsers(env);
  const items = Object.values(users).sort((a, b) => Number(b.id) - Number(a.id));
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.max(0, Math.min(offset || 0, totalPages - 1));
  const slice = items.slice(page * pageSize, (page + 1) * pageSize);
  const lines = [`👥 用户记录（第 ${page + 1}/${totalPages} 页，共 ${items.length} 人）\n`];
  for (const u of slice) {
    const ban = u.banned ? "🚫" : "✅";
    lines.push(`${ban} ${tgEscape(userDisplay(u))}\n   ID: <code>${u.id}</code>  今日: ${u.today_count || 0}  总计: ${u.total || 0}`);
  }
  if (!slice.length) lines.push("暂无用户记录");
  const buttons = [];
  const row = [];
  if (page > 0) row.push({ text: "⬅️ 上一页", callback_data: `admin_users:${page - 1}` });
  if (page < totalPages - 1) row.push({ text: "➡️ 下一页", callback_data: `admin_users:${page + 1}` });
  if (row.length) buttons.push(row);
  for (const u of slice) {
    const uid = u.id;
    const dl = u.daily_limit;
    const limitTag = dl === undefined || dl === null ? "" : ` | ${dl === 0 ? "禁止" : dl === -1 ? "∞" : dl + "次"}`;
    buttons.push([{ text: u.banned ? `✅ 解封 ${userDisplay(u)}` : `🚫 封禁 ${userDisplay(u)}`, callback_data: `admin_${u.banned ? "unban" : "ban"}:${uid}` }]);
    buttons.push([{ text: `🎚 设上限 ${userDisplay(u)}${limitTag}`, callback_data: `admin_setlimit:${uid}` }]);
  }
  buttons.push([{ text: "🔙 返回", callback_data: "admin_menu" }]);
  return { text: lines.join("\n"), keyboard: { inline_keyboard: buttons } };
}

async function adminBansPage(env) {
  const users = await loadUsers(env);
  const banned = Object.values(users).filter(u => u.banned);
  const lines = [`🚫 封禁列表（${banned.length} 人）\n`];
  for (const u of banned) lines.push(`${userDisplay(u)}  ID: <code>${u.id}</code>`);
  if (!banned.length) lines.push("当前没有被封禁的用户");
  const buttons = banned.map(u => [{ text: `✅ 解封 ${userDisplay(u)}`, callback_data: `admin_unban:${u.id}` }]);
  buttons.push([{ text: "🔙 返回", callback_data: "admin_menu" }]);
  return { text: lines.join("\n"), keyboard: { inline_keyboard: buttons } };
}


// ---------- 管理回调处理 ----------
async function tgHandleCallback(env, token, cq) {
  const uid = cq.from?.id;
  const data = cq.data || "";
  const msg = cq.message;
  const chatId = msg?.chat?.id;
  const messageId = msg?.message_id;

  if (!uid || !(await isAdmin(env, uid))) {
    await tgAnswerCallback(token, cq.id, "⛔ 无权限", true);
    return;
  }
  await tgAnswerCallback(token, cq.id, "", false);

  const edit = async (text, kb) => {
    try { await tgEditMessage(token, chatId, messageId, text, kb); }
    catch (e) { await tgCall(token, "sendMessage", { chat_id: chatId, text, parse_mode: "HTML", reply_markup: kb }); }
  };

  if (data === "admin_menu") {
    await edit("🛠 管理面板", adminMenuKeyboard());
    return;
  }
  if (data === "admin_close") {
    try { await tgCall(token, "deleteMessage", { chat_id: chatId, message_id: messageId }); } catch (e) {}
    return;
  }
  if (data === "admin_users" || data.startsWith("admin_users:")) {
    const off = data.startsWith("admin_users:") ? parseInt(data.split(":")[1], 10) : 0;
    const r = await adminUsersPage(env, off);
    await edit(r.text, r.keyboard);
    return;
  }
  if (data === "admin_bans") {
    const r = await adminBansPage(env);
    await edit(r.text, r.keyboard);
    return;
  }
  if (data.startsWith("admin_ban:") || data.startsWith("admin_unban:")) {
    const [act, target] = data.split(":");
    const users = await loadUsers(env);
    const t = users[String(target)];
    if (!t) { await edit("⚠️ 未找到该用户", { inline_keyboard: [[{ text: "🔙 返回", callback_data: "admin_menu" }]] }); return; }
    t.banned = act === "admin_ban";
    users[String(target)] = t;
    await saveUsers(env, users);
    const verb = act === "admin_ban" ? "🚫 已封禁" : "✅ 已解封";
    const r = await adminBansPage(env);
    await edit(`${verb}：${userDisplay(t)}（<code>${target}</code>）\n\n${r.text}`, r.keyboard);
    return;
  }
  if (data === "admin_stats") {
    const users = await loadUsers(env);
    const today = todayStr();
    const items = Object.values(users);
    const activeToday = items.filter(u => u.today === today && (u.today_count || 0) > 0).length;
    const bannedN = items.filter(u => u.banned).length;
    const totalDl = items.reduce((s, u) => s + Number(u.total || 0), 0);
    const todayDl = items.filter(u => u.today === today).reduce((s, u) => s + Number(u.today_count || 0), 0);
    const s = await loadSettings(env);
    const lim = s.daily_limit;
    const limDesc = lim === 0 ? "禁止下载" : lim === -1 ? "无上限" : `${lim} 次/人/天`;
    await edit(
      `📊 下载统计\n\n👤 总用户数：${items.length}\n🟢 今日活跃：${activeToday}\n🚫 已封禁：${bannedN}\n📥 今日下载：${todayDl} 次\n📚 历史下载：${totalDl} 次\n🎚 全局每日上限：${limDesc}`,
      { inline_keyboard: [[{ text: "🔙 返回", callback_data: "admin_menu" }]] }
    );
    return;
  }
  if (data === "admin_limit") {
    const s = await loadSettings(env);
    const lim = s.daily_limit;
    const desc = lim === 0 ? "⛔ 禁止下载（维护状态）" : lim === -1 ? "♾ 无上限" : `每人 ${lim} 次/天`;
    await edit(
      `🎚 全局每日下载上限\n\n当前：${desc}\n管理员始终不受限制。\n\n发送新数值修改：\n• 正整数（如 5）= 每人每天 5 次\n• 0 = 禁止下载\n• -1 = 无上限\n• /cancel 取消`,
      { inline_keyboard: [[{ text: "🔙 返回", callback_data: "admin_menu" }]] }
    );
    await kvSet(env, `pending:${chatId}`, { type: "limit" });
    return;
  }
  if (data.startsWith("admin_setlimit:")) {
    const target = data.split(":")[1];
    const users = await loadUsers(env);
    const t = users[String(target)];
    if (!t) { await edit("⚠️ 未找到该用户", { inline_keyboard: [[{ text: "🔙 返回", callback_data: "admin_users:0" }]] }); return; }
    const cur = t.daily_limit;
    const curDesc = cur === undefined || cur === null ? "跟随全局" : cur === 0 ? "⛔ 禁止下载" : cur === -1 ? "♾ 无上限" : `${cur} 次/天`;
    const s = await loadSettings(env);
    await edit(
      `🎚 设置 ${userDisplay(t)} 的每日下载上限\n\n当前：${curDesc}\n全局上限：${s.daily_limit}\n\n发送新数值：\n• 正整数 = 该用户每天 n 次\n• 0 = 禁止该用户下载\n• -1 = 该用户无上限\n• del = 恢复跟随全局\n• /cancel 取消`,
      { inline_keyboard: [[{ text: "🔙 返回", callback_data: "admin_users:0" }]] }
    );
    await kvSet(env, `pending:${chatId}`, { type: "setlimit", target });
    return;
  }
  if (data === "admin_welcome") {
    const s = await loadSettings(env);
    const cur = s.welcome || DEFAULT_WELCOME;
    await edit(
      `📝 欢迎语设置\n\n当前：\n${tgEscape(cur)}\n\n直接发送新的欢迎语内容即可修改（/cancel 取消）。`,
      { inline_keyboard: [[{ text: "🔙 返回", callback_data: "admin_menu" }]] }
    );
    await kvSet(env, `pending:${chatId}`, { type: "welcome" });
    return;
  }
  if (data === "admin_announce") {
    const s = await loadSettings(env);
    const cur = String(s.announcement || "").trim();
    await edit(
      `📢 公告设置\n\n当前：\n${cur ? tgEscape(cur) : "（空，无公告）"}\n\n发送新公告内容即可修改；发送单个减号 - 清除公告；/cancel 取消。`,
      { inline_keyboard: [[{ text: "🔙 返回", callback_data: "admin_menu" }]] }
    );
    await kvSet(env, `pending:${chatId}`, { type: "announce" });
    return;
  }
  if (data === "admin_logins") {
    const log = await loadLoginLog(env);
    const lines = ["🔐 登录日志（各 chat 最近 8 条）\n"];
    for (const [chat, entries] of Object.entries(log)) {
      const acct = entries.length ? (entries[entries.length - 1].username || "?") : "?";
      lines.push(`Chat <code>${chat}</code>（最近账号：${acct}）`);
      for (const e of entries.slice(-8)) {
        const mark = e.ok ? "✅" : "❌";
        lines.push(`  ${mark} ${e.t} ${e.reason || ""}`);
      }
      lines.push("");
    }
    if (!Object.keys(log).length) lines.push("暂无登录记录");
    await edit(lines.join("\n").slice(0, 3500), { inline_keyboard: [[{ text: "🔙 返回", callback_data: "admin_menu" }]] });
    return;
  }
}

// ---------- Telegram Bot ----------
const TG_API = "https://api.telegram.org/bot";


function tgEscape(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function tgCall(token, method, body) {
  return fetch(`${TG_API}${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function tgSend(token, chatId, text) {
  return tgCall(token, "sendMessage", { chat_id: chatId, text, disable_web_page_preview: true });
}

async function tgSendHtml(token, chatId, text) {
  return tgCall(token, "sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true });
}

async function tgSendDoc(token, chatId, filename, content, caption) {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  if (caption) form.append("caption", caption);
  form.append("document", new Blob([content], { type: "text/plain; charset=utf-8" }), filename);
  return fetch(`${TG_API}${token}/sendDocument`, { method: "POST", body: form });
}

async function fetchChaptersParallel(env, items, concurrency, source, bookId) {
  const src = source || "fanqie";
  const bid = bookId || "";
  // 七猫对高频 POST 有风控：降低并发 + 批间/章间延迟，避免触发限流。
  const isQm = src === "qimao";
  const eff = isQm ? Math.min(concurrency, 3) : concurrency;
  const batchDelay = isQm ? 800 : 150;
  const retryBase = isQm ? 1500 : 400;
  const out = [];
  for (let i = 0; i < items.length; i += eff) {
    const batch = items.slice(i, i + eff);
    const rs = await Promise.all(batch.map(async (it) => {
      const itemId = String(it.item_id);
      let lastErr = "";
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const cj = await (await contentFor(env, src, itemId, bid)).json();
          if (cj && cj.code === 200 && cj.data && cj.data.content) {
            const title = it.title || cj.data.title || itemId;
            return { id: itemId, title, ok: true, text: `## ${title}\n\n${cj.data.content}` };
          }
          lastErr = (cj && cj.message) || "empty content";
        } catch (e) {
          lastErr = String(e);
        }
        if (attempt < 2) await new Promise((r) => setTimeout(r, retryBase * (attempt + 1)));
      }
      return { id: itemId, title: it.title || itemId, ok: false, text: `## ${it.title || itemId}\n\n[获取失败: ${lastErr}]` };
    }));
    out.push(...rs);
    if (i + eff < items.length) await new Promise((r) => setTimeout(r, batchDelay));
  }
  return out;
}

async function tgHandleUpdate(env, token, update, origin) {
  // 回调按钮
  if (update.callback_query) {
    return tgHandleCallback(env, token, update.callback_query);
  }

  const msg = update.message || update.channel_post;
  if (!msg || !msg.text) return;
  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const from = msg.from || {};

  await recordUser(env, from, chatId);

  if (await isBanned(env, chatId)) {
    await tgSend(token, chatId, "⛔ 您已被管理员封禁，如有疑问请联系管理员。");
    return;
  }

  // ---------- 全局 /cancel：优先中断活跃下载 ----------
  if (text === "/cancel") {
    let interrupted = false;
    if (env?.FANQIE_KV && env?.FANQIE_DO) {
      try {
        const active = await env.FANQIE_KV.get(`active:${chatId}`);
        if (active) {
          const info = JSON.parse(active);
          const did = env.FANQIE_DO.idFromName(`book:${info.bookId}:${chatId}`);
          const dstub = env.FANQIE_DO.get(did);
          await dstub.fetch("https://do/cancel", { method: "POST" });
          interrupted = true;
          await tgSend(token, chatId, `⏹ 已请求中断《${info.bookName || info.bookId}》的补抓，正在发送当前结果...`);
        }
      } catch (e) {}
    }
    if (!interrupted) {
      const ss = await loadLoginSessions(env);
      delete ss[String(chatId)];
      await saveLoginSessions(env, ss);
      if (env?.FANQIE_KV) { try { await env.FANQIE_KV.delete(`pending:${chatId}`); } catch (e) {} }
      await tgSend(token, chatId, "已取消。");
    }
    return;
  }

  // ---------- 管理面板等待输入 ----------
  const pending = await kvGet(env, `pending:${chatId}`, null);
  if (pending) {
    if (text === "/cancel") {
      await env.FANQIE_KV.delete(`pending:${chatId}`);
      await tgSend(token, chatId, "已取消。");
      return;
    }
    if (pending.type === "limit") {
      const n = parseInt(text, 10);
      if (isNaN(n) || (n !== -1 && n !== 0 && (n < 1 || n > 999))) {
        await tgSend(token, chatId, "⚠️ 数值超出范围（1~999、0 或 -1），请重发或 /cancel 取消。");
        return;
      }
      const s = await loadSettings(env);
      s.daily_limit = n;
      await saveSettings(env, s);
      await env.FANQIE_KV.delete(`pending:${chatId}`);
      const desc = n === 0 ? "禁止下载" : n === -1 ? "无上限" : `${n} 次/天`;
      await tgSend(token, chatId, `✅ 全局每日上限已设为：${desc}`);
      return;
    }
    if (pending.type === "setlimit") {
      const users = await loadUsers(env);
      const t = users[String(pending.target)];
      if (!t) { await env.FANQIE_KV.delete(`pending:${chatId}`); await tgSend(token, chatId, "⚠️ 未找到该用户"); return; }
      if (text === "del") { delete t.daily_limit; users[String(pending.target)] = t; await saveUsers(env, users); await env.FANQIE_KV.delete(`pending:${chatId}`); await tgSend(token, chatId, "✅ 已恢复跟随全局上限"); return; }
      const n = parseInt(text, 10);
      if (isNaN(n) || (n !== -1 && n !== 0 && (n < 1 || n > 999))) {
        await tgSend(token, chatId, "⚠️ 数值超出范围（1~999、0、-1 或 del），请重发或 /cancel 取消。");
        return;
      }
      t.daily_limit = n;
      users[String(pending.target)] = t;
      await saveUsers(env, users);
      await env.FANQIE_KV.delete(`pending:${chatId}`);
      const desc = n === 0 ? "禁止下载" : n === -1 ? "无上限" : `${n} 次/天`;
      await tgSend(token, chatId, `✅ ${userDisplay(t)} 的每日上限已设为：${desc}`);
      return;
    }
    if (pending.type === "welcome" || pending.type === "announce") {
      const s = await loadSettings(env);
      if (pending.type === "welcome") s.welcome = text;
      else s.announcement = text === "-" ? "" : text;
      await saveSettings(env, s);
      await env.FANQIE_KV.delete(`pending:${chatId}`);
      await tgSend(token, chatId, `✅ ${pending.type === "welcome" ? "欢迎语" : "公告"}已更新。`);
      return;
    }
  }

  // ---------- /start /help ----------
  if (text === "/start" || text === "/help") {
    const s = await loadSettings(env);
    const welcome = tgEscape(s.welcome || DEFAULT_WELCOME);
    const ann = String(s.announcement || "").trim();
    let out = welcome;
    if (ann) out += `\n\n📢 <b>公告</b>\n${tgEscape(ann)}`;
    out += "\n\n<b>命令</b>\n/login 登录\n/signup 注册\n/admin 管理面板（管理员）\n/cancel 取消当前输入";
    await tgCall(token, "sendMessage", { chat_id: chatId, text: out, parse_mode: "HTML", disable_web_page_preview: true });
    return;
  }

  // ---------- 登录/注册会话 ----------
  const sessions = await loadLoginSessions(env);
  const sess = sessions[String(chatId)];
  if (sess) {
    if (text === "/cancel") {
      delete sessions[String(chatId)];
      await saveLoginSessions(env, sessions);
      await tgSend(token, chatId, "已取消。");
      return;
    }
    if (sess.step === "username") {
      const input = text.trim();
      if (sess.mode === "signup") {
        if (!validUsername(input)) { await tgSend(token, chatId, "⚠️ 用户名格式不正确（3~32 位，字母/数字/下划线/横线，首位为字母或数字）"); return; }
        const users = await loadUsers(env);
        if (accountExists(users, input)) { await tgSend(token, chatId, "⚠️ 该用户名已被占用，请换一个。"); return; }
        sess.username = input; sess.step = "reg_password";
        sessions[String(chatId)] = sess; await saveLoginSessions(env, sessions);
        await tgSend(token, chatId, "🔑 请输入密码（至少 8 位，需同时包含字母和数字）");
        return;
      }
      sess.username = input; sess.step = "password";
      sessions[String(chatId)] = sess; await saveLoginSessions(env, sessions);
      await tgSend(token, chatId, "🔑 请输入密码：");
      return;
    }
    if (sess.step === "reg_password") {
      const newUser = sess.username || "";
      const pw = text.trim();
      delete sessions[String(chatId)];
      await saveLoginSessions(env, sessions);
      const issue = passwordIssues(pw);
      if (issue) { await tgSend(token, chatId, `⚠️ ${issue}，请重新 /signup 注册。`); return; }
      const users = await loadUsers(env);
      if (accountExists(users, newUser)) { await tgSend(token, chatId, "⚠️ 该用户名已被占用，请换一个重新 /signup。"); return; }
      let u = users[String(chatId)];
      if (!u) u = { id: chatId, username: from.username || "", first_name: from.first_name || "", today: todayStr(), today_count: 0, total: 0, banned: false, first_seen: todayStr(), last_seen: todayStr() };
      u.account = newUser;
      u.pwd_hash = await hashPw(pw);
      users[String(chatId)] = u;
      await saveUsers(env, users);
      await logLogin(env, chatId, newUser, true, "signup");
      await tgSend(token, chatId, `✅ 注册成功！账号：${newUser}\n现在可以正常下载了。`);
      return;
    }
    if (sess.step === "password") {
      const inputUser = sess.username || "";
      const inputPass = text.trim();
      delete sessions[String(chatId)];
      await saveLoginSessions(env, sessions);
      const admU = env?.FANQIE_ADMIN_USERNAME || "";
      const admP = env?.FANQIE_ADMIN_PASSWORD || "";
      if (admU && admP && inputUser === admU && inputPass === admP) {
        const list = await loadAdminSessions(env);
        if (!list.includes(String(chatId))) list.push(String(chatId));
        await saveAdminSessions(env, list);
        await logLogin(env, chatId, inputUser, true, "admin");
        await tgSend(token, chatId, "✅ 管理员登录成功！\n发送 /admin 打开管理面板。");
        return;
      }
      const users = await loadUsers(env);
      const u = findUserByAccount(users, inputUser);
      const pwh = await hashPw(inputPass);
      if (u && u.pwd_hash === pwh) {
        await logLogin(env, chatId, inputUser, true, "user");
        await tgSend(token, chatId, `✅ 登录成功！账号：${inputUser}`);
        return;
      }
      await logLogin(env, chatId, inputUser, false, "bad_credentials");
      const fails = await recentFails(env, chatId, 600);
      if (fails >= 3) {
        await tgSend(token, chatId, "❌ 账号或密码错误。\n⚠️ 短时间内多次失败，已通知管理员。");
        const admins = await loadAdminSessions(env);
        for (const aid of admins) {
          try { await tgSendHtml(token, aid, `⚠️ 异常登录告警\nChat ID: <code>${chatId}</code>\n用户名尝试：${tgEscape(inputUser)}\n10 分钟内失败 ${fails} 次`); } catch (e) {}
        }
      } else {
        await tgSend(token, chatId, "❌ 账号或密码错误。");
      }
      return;
    }
    delete sessions[String(chatId)];
    await saveLoginSessions(env, sessions);
  }

  if (text === "/login") {
    if (!env?.FANQIE_KV) { await tgSend(token, chatId, "⚠️ 未绑定 KV，账号系统不可用"); return; }
    sessions[String(chatId)] = { step: "username", mode: "login" };
    await saveLoginSessions(env, sessions);
    await tgSend(token, chatId, "🔐 请输入账号：");
    return;
  }
  if (text === "/signup") {
    if (!env?.FANQIE_KV) { await tgSend(token, chatId, "⚠️ 未绑定 KV，账号系统不可用"); return; }
    sessions[String(chatId)] = { step: "username", mode: "signup" };
    await saveLoginSessions(env, sessions);
    await tgSend(token, chatId, "📝 注册：请输入用户名（3~32 位，字母/数字/下划线/横线）");
    return;
  }
  if (text === "/admin") {
    if (!(await isAdmin(env, chatId))) return;
    await tgCall(token, "sendMessage", { chat_id: chatId, text: "🛠 管理面板", reply_markup: adminMenuKeyboard() });
    return;
  }

  // ---------- 下载 ----------
  const bookId = await parseBookId(text);
  if (!bookId) {
    await tgSend(token, chatId, "⚠️ 无法识别小说URL或ID。\n\n请发送类似：https://fanqienovel.com/page/7615694942362422297 或 https://m.qimao.com/shuku/222767/");
    return;
  }
  const src = sourceFromUrl(text);  // 'qimao' | 'fanqie'
  if (!(await isAdmin(env, chatId))) {
    const users = await loadUsers(env);
    const u = users[String(chatId)];
    if (!u || !u.account) {
      await tgSend(token, chatId, "⚠️ 请先注册账号后才能下载。\n发送 /signup 注册（用户名+密码）。");
      return;
    }
  }
  const quota = await checkAndConsumeQuota(env, chatId);
  if (!quota.ok) { await tgSend(token, chatId, quota.msg); return; }
  const dirJson = await (await directoryFor(env, src, bookId)).json();
  if (dirJson.code !== 200) {
    await refundQuota(env, chatId);
    await tgSend(token, chatId, "获取目录失败: " + (dirJson.message || "未知错误"));
    return;
  }
  const lists = dirJson.data.lists || [];
  const bookName = dirJson.data.book_name || bookId;
  const total = lists.length;
  if (!total) { await refundQuota(env, chatId); await tgSend(token, chatId, "目录为空"); return; }

  if (env?.FANQIE_DO) {
    const id = env.FANQIE_DO.idFromName(`book:${bookId}:${chatId}`);
    const stub = env.FANQIE_DO.get(id);
    await stub.fetch("https://do/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chatId, bookId, bookName, total, lists, cursor: 0, chunks: [], createdAt: Date.now(), source: src }),
    });
    await tgSend(token, chatId, `《${bookName}》共 ${total} 章，已启动加速下载（约 ${Math.ceil(total / 45)} 轮 × 数秒），完成后自动发送全书 TXT。`);
    return;
  }
  if (env?.FANQIE_KV) {
    const jobKey = `job:${bookId}:${chatId}`;
    await env.FANQIE_KV.put(jobKey, JSON.stringify({ chatId, bookId, bookName, total, lists, cursor: 0, chunks: [], createdAt: Date.now(), source: src }));
    let pendingList = [];
    try { pendingList = JSON.parse((await env.FANQIE_KV.get("jobs:pending")) || "[]"); } catch (e) {}
    if (!pendingList.includes(jobKey)) pendingList.push(jobKey);
    await env.FANQIE_KV.put("jobs:pending", JSON.stringify(pendingList));
    await tgSend(token, chatId, `《${bookName}》共 ${total} 章，已加入队列。每分钟抓 45 章，预计约 ${Math.ceil(total / 45)} 分钟完成。`);
    return;
  }
  await refundQuota(env, chatId);
  await tgSend(token, chatId, "⚠️ 需要绑定 Durable Object 或 KV 才能下载。");
}

async function hTelegramWebhook(request, env, ctx) {
  const token = env?.TG_BOT_TOKEN;
  if (!token) return json({ ok: false, error: "TG_BOT_TOKEN not set" }, 500);

  if (env?.TG_WEBHOOK_SECRET) {
    const hdr = request.headers.get("x-telegram-bot-api-secret-token");
    if (hdr !== env.TG_WEBHOOK_SECRET) return json({ ok: false }, 403);
  }

  let update;
  try { update = await request.json(); } catch (e) { return json({ ok: true }); }

  const origin = new URL(request.url).origin;
  ctx.waitUntil(tgHandleUpdate(env, token, update, origin).catch(() => {}));
  return json({ ok: true });
}

async function hTelegramSetup(request, env) {
  const token = env?.TG_BOT_TOKEN;
  if (!token) return json({ ok: false, error: "TG_BOT_TOKEN not set" }, 500);
  const origin = new URL(request.url).origin;
  const body = { url: `${origin}/tg/webhook` };
  if (env?.TG_WEBHOOK_SECRET) body.secret_token = env.TG_WEBHOOK_SECRET;
  const r = await fetch(`${TG_API}${token}/setWebhook`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return json({ ok: r.ok, webhook: body.url, telegram: await r.json() });
}

// ---------- Cron 全自动队列 ----------
async function handleCron(env) {
  if (!env?.FANQIE_KV) return;
  const token = env?.TG_BOT_TOKEN;
  if (!token) return;

  let pending = [];
  try { pending = JSON.parse((await env.FANQIE_KV.get("jobs:pending")) || "[]"); } catch (e) {}
  if (!pending.length) return;

  const jobKey = pending[0];
  const jobRaw = await env.FANQIE_KV.get(jobKey);
  if (!jobRaw) {
    pending.shift();
    await env.FANQIE_KV.put("jobs:pending", JSON.stringify(pending));
    return;
  }

  let job;
  try { job = JSON.parse(jobRaw); } catch (e) {
    await env.FANQIE_KV.delete(jobKey);
    pending.shift();
    await env.FANQIE_KV.put("jobs:pending", JSON.stringify(pending));
    return;
  }

  const BATCH = job.source === "qimao" ? 12 : 45;
  const start = job.cursor || 0;
  const end = Math.min(start + BATCH, job.total);
  const slice = job.lists.slice(start, end);

  const parts = await fetchChaptersParallel(env, slice, 10, job.source, job.bookId);
  job.chunks = job.chunks || [];
  job.chunks.push(...parts);
  job.cursor = end;

  if (job.cursor >= job.total) {
    const failedIdxs = job.chunks.map((c, i) => (c && c.ok === false) ? i : -1).filter((i) => i >= 0);
    if (failedIdxs.length > 0 && failedIdxs.length <= 40) {
      const retryItems = failedIdxs.map((i) => {
        const cid = job.chunks[i].id;
        return job.lists.find((l) => String(l.item_id) === cid) || { item_id: cid, title: cid };
      });
      try {
        const retried = await fetchChaptersParallel(env, retryItems, 5, job.source, job.bookId);
        for (let k = 0; k < retried.length; k++) {
          if (retried[k].ok) job.chunks[failedIdxs[k]] = retried[k];
        }
      } catch (e) {}
    }
    let txt = job.chunks.map((c) => (c && c.text) || "").join("\n\n");
    const stillFailed = job.chunks.filter((c) => c && c.ok === false).length;
    const MAX_BYTES = 45 * 1024 * 1024;
    let truncated = false;
    if (new TextEncoder().encode(txt).length > MAX_BYTES) {
      txt = txt.slice(0, Math.floor(txt.length * MAX_BYTES / new TextEncoder().encode(txt).length));
      truncated = true;
    }
    const cap = `全书 ${job.total} 章`
      + (stillFailed > 0 ? `（${stillFailed} 章获取失败）` : "")
      + (truncated ? "（已截断至 45MB）" : "");
    await tgSendDoc(token, job.chatId, `${job.bookName}.txt`, txt, cap);
    await tgSend(token, job.chatId,
      `《${job.bookName}》全部 ${job.total} 章已发送完毕`
      + (stillFailed > 0 ? `，其中 ${stillFailed} 章补抓后仍失败` : ""));
    await env.FANQIE_KV.delete(jobKey);
    pending.shift();
    await env.FANQIE_KV.put("jobs:pending", JSON.stringify(pending));
  } else {
    await env.FANQIE_KV.put(jobKey, JSON.stringify(job));
    const prev = Math.floor(start / job.total * 4);
    const now = Math.floor(job.cursor / job.total * 4);
    if (now > prev) {
      const pct = Math.floor(job.cursor / job.total * 100);
      await tgSend(token, job.chatId, `《${job.bookName}》进度 ${job.cursor}/${job.total} (${pct}%)`);
    }
  }
}


// ---------- Durable Object: 链式 alarm 加速 ----------
export class FanqieJob {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/cancel") {
      await this.state.storage.put("cancelled", true);
      return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
    }
    const job = await request.json();
    job.chunks = job.chunks || [];
    await this.state.storage.put("job", job);
    await this.state.storage.put("cancelled", false);
    await this.state.storage.setAlarm(Date.now() + 100);
    // 记录活跃任务，供 /cancel 查找
    if (this.env?.FANQIE_KV) {
      try {
        await this.env.FANQIE_KV.put(`active:${job.chatId}`, JSON.stringify({ bookId: job.bookId, bookName: job.bookName }));
      } catch (e) {}
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
  }

  async finish(job, token) {
    let txt = job.chunks.map((c) => (c && c.text) || "").join("\n\n");
    const stillFailed = job.chunks.filter((c) => c && c.ok === false).length;
    const MAX_BYTES = 45 * 1024 * 1024;
    let truncated = false;
    if (new TextEncoder().encode(txt).length > MAX_BYTES) {
      txt = txt.slice(0, Math.floor(txt.length * MAX_BYTES / new TextEncoder().encode(txt).length));
      truncated = true;
    }
    if (token) {
      const cap = `全书 ${job.total} 章`
        + (stillFailed > 0 ? `（${stillFailed} 章获取失败）` : "")
        + (truncated ? "（已截断至 45MB）" : "");
      try {
        await tgSendDoc(token, job.chatId, `${job.bookName}.txt`, txt, cap);
        await tgSend(token, job.chatId,
          `《${job.bookName}》全部 ${job.total} 章已发送完毕`
          + (stillFailed > 0 ? `，其中 ${stillFailed} 章补抓后仍失败` : ""));
      } catch (e) {}
    }
    if (this.env?.FANQIE_KV) {
      try { await this.env.FANQIE_KV.delete(`active:${job.chatId}`); } catch (e) {}
    }
    await this.state.storage.deleteAll();
  }

  async alarm() {
    const job = await this.state.storage.get("job");
    if (!job) return;
    const token = this.env?.TG_BOT_TOKEN;
    const cancelled = await this.state.storage.get("cancelled");

    // 取消：直接发当前结果
    if (cancelled) {
      await this.finish(job, token);
      return;
    }

    // 正常批次
    if ((job.cursor || 0) < job.total) {
      const BATCH = job.source === "qimao" ? 12 : 45;
      const start = job.cursor || 0;
      const end = Math.min(start + BATCH, job.total);
      const slice = job.lists.slice(start, end);
      let parts = [];
      try {
        parts = await fetchChaptersParallel(this.env, slice, 10, job.source, job.bookId);
      } catch (e) {
        parts = slice.map((it) => ({ id: String(it.item_id), title: it.title || it.item_id, ok: false, text: `## ${it.title || it.item_id}\n\n[获取失败: ${String(e)}]` }));
      }
      job.chunks = job.chunks || [];
      job.chunks.push(...parts);
      job.cursor = end;
      await this.state.storage.put("job", job);

      const prev = Math.floor(start / job.total * 4);
      const now = Math.floor(job.cursor / job.total * 4);
      if (token && now > prev) {
        const pct = Math.floor(job.cursor / job.total * 100);
        try { await tgSend(token, job.chatId, `《${job.bookName}》进度 ${job.cursor}/${job.total} (${pct}%)`); } catch (e) {}
      }
      await this.state.storage.setAlarm(Date.now() + 1000);
      return;
    }

    // 全部抓完 → 补抓失败章节，最多 5 分钟
    const now0 = Date.now();
    const retryStart = job.retryStart || now0;
    job.retryStart = retryStart;
    const elapsed = now0 - retryStart;
    const FAILED = job.chunks.map((c, i) => (c && c.ok === false) ? i : -1).filter((i) => i >= 0);

    if (FAILED.length === 0) {
      await this.finish(job, token);
      return;
    }
    if (elapsed >= 5 * 60 * 1000) {
      if (token) {
        try { await tgSend(token, job.chatId, `⏱ 补抓已达 5 分钟上限，仍有 ${FAILED.length} 章失败，发送当前结果。`); } catch (e) {}
      }
      await this.finish(job, token);
      return;
    }

    // 分批补抓，每批最多 40 章，20 秒一次
    const batchIdx = FAILED.slice(0, 40);
    const retryItems = batchIdx.map((i) => {
      const cid = job.chunks[i].id;
      return job.lists.find((l) => String(l.item_id) === cid) || { item_id: cid, title: cid };
    });
    try {
      const retried = await fetchChaptersParallel(this.env, retryItems, 8, job.source, job.bookId);
      for (let k = 0; k < retried.length; k++) {
        if (retried[k].ok) job.chunks[batchIdx[k]] = retried[k];
      }
    } catch (e) {}
    await this.state.storage.put("job", job);

    const remain = job.chunks.filter((c) => c && c.ok === false).length;
    if (token) {
      const leftMin = Math.ceil((5 * 60 * 1000 - elapsed) / 60000);
      try {
        await tgSend(token, job.chatId, `🔄 补抓中：还剩 ${remain} 章失败，已用 ${Math.floor(elapsed / 1000)}s / 300s（剩余约 ${leftMin} 分钟）。发送 /cancel 可立即停止。`);
      } catch (e) {}
    }
    await this.state.storage.setAlarm(Date.now() + 20000);
  }
}


// ---------- 代理池探测 ----------
const PROBE_CANDIDATES = [
  // 用户可在 KV proxy:candidates 里覆盖此列表
];

async function probeOne(base, contentPath, testId) {
  const url = contentPath
    ? base + contentPath.replace("{id}", encodeURIComponent(testId))
    : `${base}/content?tab=小说&item_id=${encodeURIComponent(testId)}`;
  const t0 = Date.now();
  try {
    const r = await fetchT(url, { headers: { "user-agent": UA } }, 8000);
    if (!r.ok) return { ok: false, reason: `HTTP ${r.status}` };
    const d = await r.json();
    let content = "";
    if (d && d.data) {
      content = typeof d.data === "string" ? d.data : (d.data.content || d.data.chapter_content || "");
    } else if (d && d.content) {
      content = d.content;
    }
    if (!content || content.length < 500) return { ok: false, reason: `short ${content.length}` };
    return { ok: true, ms: Date.now() - t0, len: content.length };
  } catch (e) {
    return { ok: false, reason: String(e).slice(0, 60) };
  }
}

async function probePool(env, testId) {
  if (!env?.FANQIE_KV) return { ok: false, error: "FANQIE_KV not bound" };
  testId = testId || "7656115954476139033";

  let candidates = PROBE_CANDIDATES;
  const raw = await env.FANQIE_KV.get("proxy:candidates");
  if (raw) {
    try { candidates = JSON.parse(raw); } catch (e) {}
  }

  const alive = [];
  const dead = [];
  for (const c of candidates) {
    const base = String(c.base || "").replace(/\/$/, "");
    if (!base) continue;
    const r = await probeOne(base, c.contentPath || null, testId);
    if (r.ok) alive.push({ name: c.name || base, base, contentPath: c.contentPath || null, ms: r.ms, len: r.len });
    else dead.push({ name: c.name || base, base, reason: r.reason });
  }

  await env.FANQIE_KV.put(PROXY_KV_KEY, JSON.stringify(alive));
  await env.FANQIE_KV.put(PROXY_META_KEY, JSON.stringify({
    at: new Date().toISOString(),
    total: candidates.length,
    alive: alive.length,
    dead: dead.length,
    deadDetail: dead,
  }));
  return { ok: true, alive: alive.length, dead: dead.length, detail: dead };
}



// ==================== 在线阅读（环境变量 FANQIE_ONLINE_READ=1 启用）====================
const READ_PAGE_HTML = "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">\n<title>在线阅读</title>\n<style>\n:root{\n  --md-sys-color-primary:#6750a4;\n  --md-sys-color-on-primary:#ffffff;\n  --md-sys-color-primary-container:#eaddff;\n  --md-sys-color-on-primary-container:#21005d;\n  --md-sys-color-secondary:#625b71;\n  --md-sys-color-on-secondary:#ffffff;\n  --md-sys-color-secondary-container:#e8def8;\n  --md-sys-color-on-secondary-container:#1d192b;\n  --md-sys-color-surface:#fef7ff;\n  --md-sys-color-on-surface:#1d1b20;\n  --md-sys-color-surface-variant:#e7e0ec;\n  --md-sys-color-on-surface-variant:#49454f;\n  --md-sys-color-outline:#79747e;\n  --md-sys-color-outline-variant:#cac4d0;\n  --md-sys-color-background:#fef7ff;\n  --md-sys-color-on-background:#1d1b20;\n  --md-sys-color-error:#b3261e;\n  --md-sys-color-on-error:#ffffff;\n  --md-sys-color-error-container:#f9dedc;\n  --md-sys-color-on-error-container:#410e0b;\n  --md-sys-elevation-1:0 1px 2px rgba(0,0,0,.3),0 1px 3px 1px rgba(0,0,0,.15);\n  --md-sys-elevation-2:0 1px 2px rgba(0,0,0,.3),0 2px 6px 2px rgba(0,0,0,.15);\n  --md-sys-elevation-3:0 4px 8px 3px rgba(0,0,0,.15),0 1px 3px rgba(0,0,0,.3);\n  --md-fab-size:56px;\n}\n[data-theme=\"dark\"]{\n  --md-sys-color-primary:#d0bcff;\n  --md-sys-color-on-primary:#381e72;\n  --md-sys-color-primary-container:#4f378b;\n  --md-sys-color-on-primary-container:#eaddff;\n  --md-sys-color-secondary:#ccc2dc;\n  --md-sys-color-on-secondary:#332d41;\n  --md-sys-color-secondary-container:#4a4458;\n  --md-sys-color-on-secondary-container:#e8def8;\n  --md-sys-color-surface:#141218;\n  --md-sys-color-on-surface:#e6e0e9;\n  --md-sys-color-surface-variant:#49454f;\n  --md-sys-color-on-surface-variant:#cac4d0;\n  --md-sys-color-outline:#938f99;\n  --md-sys-color-outline-variant:#49454f;\n  --md-sys-color-background:#141218;\n  --md-sys-color-on-background:#e6e0e9;\n  --md-sys-color-error:#f2b8b5;\n  --md-sys-color-on-error:#601410;\n  --md-sys-color-error-container:#8c1d18;\n  --md-sys-color-on-error-container:#f9dedc;\n}\n*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}\nbody{margin:0;background:var(--md-sys-color-background);color:var(--md-sys-color-on-surface);font:15px/1.7 -apple-system,\"PingFang SC\",\"Noto Sans CJK SC\",sans-serif}\n.mdc-top-app-bar{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--md-sys-color-surface);color:var(--md-sys-color-on-surface);box-shadow:var(--md-sys-elevation-2)}\n.mdc-top-app-bar .title{flex:1;min-width:0;font-size:17px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.mdc-icon-button{width:40px;height:40px;border:none;border-radius:50%;background:transparent;color:inherit;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center}\n.mdc-icon-button:active{background:var(--md-sys-color-surface-variant)}\n.mdc-search-bar{display:flex;align-items:center;gap:10px;margin:12px;padding:10px 14px;background:var(--md-sys-color-surface-variant);border-radius:28px}\n.mdc-search-bar input{flex:1;border:none;background:transparent;outline:none;font-size:15px;color:var(--md-sys-color-on-surface)}\n.mdc-search-bar input::placeholder{color:var(--md-sys-color-on-surface-variant)}\n.mdc-search-bar .search-icon{color:var(--md-sys-color-on-surface-variant);font-size:18px}\n.mdc-card{background:var(--md-sys-color-surface);border-radius:12px;box-shadow:var(--md-sys-elevation-1);overflow:hidden}\n.book-list{list-style:none;padding:0;margin:0}\n.book-item{display:flex;gap:12px;padding:14px;border-bottom:1px solid var(--md-sys-color-outline-variant);cursor:pointer}\n.book-item:active{background:var(--md-sys-color-surface-variant)}\n.book-cover{width:56px;height:76px;border-radius:8px;background:var(--md-sys-color-primary-container);color:var(--md-sys-color-on-primary-container);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;overflow:hidden;flex-shrink:0}\n.book-cover img{width:100%;height:100%;object-fit:cover}\n.book-info{flex:1;min-width:0}\n.book-title{font-size:16px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.book-author{font-size:13px;color:var(--md-sys-color-on-surface-variant);margin-top:2px}\n.book-abstract{font-size:13px;color:var(--md-sys-color-on-surface-variant);margin-top:6px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}\n.book-status{font-size:12px;color:var(--md-sys-color-primary);margin-top:6px}\n.mdc-list{list-style:none;padding:0;margin:0}\n.mdc-list-item{display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;border-bottom:1px solid var(--md-sys-color-outline-variant)}\n.mdc-list-item:active{background:var(--md-sys-color-surface-variant)}\n.mdc-list-item .item-title{flex:1;min-width:0;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.mdc-list-item .item-meta{font-size:12px;color:var(--md-sys-color-on-surface-variant)}\n.mdc-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 16px;height:40px;border:none;border-radius:20px;font-size:14px;font-weight:600;cursor:pointer;background:var(--md-sys-color-primary);color:var(--md-sys-color-on-primary)}\n.mdc-button:active{opacity:.8}\n.mdc-button.tonal{background:var(--md-sys-color-secondary-container);color:var(--md-sys-color-on-secondary-container)}\n.mdc-button.text{background:transparent;color:var(--md-sys-color-primary)}\n.mdc-button:disabled{opacity:.4;cursor:default}\n.mdc-fab{position:fixed;right:20px;bottom:24px;width:var(--md-fab-size);height:var(--md-fab-size);border-radius:16px;background:var(--md-sys-color-primary-container);color:var(--md-sys-color-on-primary-container);box-shadow:var(--md-sys-elevation-3);border:none;font-size:24px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:15}\n.mdc-fab:active{opacity:.85}\n.mdc-navigation-bar{position:fixed;bottom:0;left:0;right:0;display:flex;background:var(--md-sys-color-surface);box-shadow:0 -1px 3px rgba(0,0,0,.1);z-index:14}\n.mdc-navigation-item{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 0 10px;font-size:11px;color:var(--md-sys-color-on-surface-variant);cursor:pointer}\n.mdc-navigation-item.active{color:var(--md-sys-color-primary)}\n.mdc-navigation-item .nav-icon{font-size:20px}\nmain{max-width:720px;margin:0 auto;padding:12px 0 88px}\n#content{white-space:pre-wrap;word-wrap:break-word;font-size:var(--fs,17px);line-height:1.95;padding:4px 18px}\n.read-nav{display:flex;gap:10px;margin:20px 0;padding:0 16px}\n.read-nav .mdc-button{flex:1}\n.tip{color:var(--md-sys-color-on-surface-variant);font-size:14px;text-align:center;padding:32px 0}\n.loading{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,.72);color:#fff;padding:12px 20px;border-radius:12px;font-size:14px;display:none;z-index:30}\n.loading.on{display:block}\n.skeleton{background:var(--md-sys-color-surface-variant);border-radius:8px;height:16px;margin:12px 0}\n@media(min-width:600px){main{max-width:840px}}\n</style>\n</head>\n<body>\n<header class=\"mdc-top-app-bar\">\n  <button class=\"mdc-icon-button\" id=\"back\">&#8592;</button>\n  <div class=\"title\" id=\"title\">在线阅读</div>\n  <button class=\"mdc-icon-button\" id=\"theme\">&#9681;</button>\n</header>\n<main id=\"app\"><div class=\"tip\">加载中…</div></main>\n<div class=\"loading\" id=\"loading\">加载中…</div>\n<nav class=\"mdc-navigation-bar\" id=\"nav\">\n  <div class=\"mdc-navigation-item active\" data-view=\"home\"><span class=\"nav-icon\">&#8962;</span><span>首页</span></div>\n  <div class=\"mdc-navigation-item\" data-view=\"search\"><span class=\"nav-icon\">&#128269;</span><span>搜索</span></div>\n</nav>\n<script>\n(function(){\n  var q = new URLSearchParams(location.search);\n  var bookId = q.get('book_id') || '';\n  var itemId = q.get('item_id') || '';\n  var src = q.get('source') || 'fanqie';  // fanqie | qimao\n  var app = document.getElementById('app');\n  var titleEl = document.getElementById('title');\n  var loading = document.getElementById('loading');\n  var dirCache = [], dirMap = {}, detailCache = null, searchCache = null;\n  var SOURCES = {\n    fanqie: { name: '番茄小说', search: '/api/search?key=', directory: '/api/directory?book_id=', content: '/api/content?item_id=' },\n    qimao:  { name: '七猫中文网', search: '/api/qimao/search?key=', directory: '/api/qimao/directory?book_id=', content: '/api/qimao/content?item_id=' }\n  };\n  function ep(kind, id){\n    var s = SOURCES[src] || SOURCES.fanqie;\n    if (src === 'qimao' && kind === 'detail') return s.directory + encodeURIComponent(id || '');\n    if (src === 'qimao' && kind === 'content') return s.content + encodeURIComponent(id || '') + '&book_id=' + encodeURIComponent(bookId || '');\n    return s[kind] + encodeURIComponent(id || '');\n  }\n\n  var savedTheme = localStorage.getItem('md3_theme');\n  if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);\n  var fs = parseInt(localStorage.getItem('md3_fs') || '17', 10);\n  document.documentElement.style.setProperty('--fs', fs + 'px');\n\n  document.getElementById('theme').onclick = function(){\n    var dark = document.documentElement.getAttribute('data-theme') === 'dark';\n    if (dark) document.documentElement.removeAttribute('data-theme');\n    else document.documentElement.setAttribute('data-theme', 'dark');\n    localStorage.setItem('md3_theme', dark ? '' : 'dark');\n  };\n  document.getElementById('back').onclick = function(){\n    if (itemId && bookId) { go(bookId, ''); }\n    else if (bookId) { go('', ''); }\n    else if (history.length > 1) history.back();\n    else location.href = '/';\n  };\n\n  function show(on){ loading.className = on ? 'loading on' : 'loading'; }\n  function esc(s){ return String(s == null ? '' : s).replace(/[&<>\"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'\"'}[c]; }); }\n  function setTitle(s){ titleEl.textContent = s; document.title = s; }\n  function api(path){ return fetch(path, { headers: { accept: 'application/json' } }).then(function(r){ return r.json(); }); }\n  function setNav(view){ var items = document.querySelectorAll('.mdc-navigation-item'); for(var i=0;i<items.length;i++){ items[i].className = items[i].getAttribute('data-view')===view ? 'mdc-navigation-item active' : 'mdc-navigation-item'; } }\n\n  function go(book, item){\n    bookId = book || ''; itemId = item || '';\n    var qs = [];\n    if (bookId) qs.push('book_id=' + encodeURIComponent(bookId));\n    if (itemId) qs.push('item_id=' + encodeURIComponent(itemId));\n    if (src && src !== 'fanqie') qs.push('source=' + encodeURIComponent(src));\n    history.pushState({}, '', qs.length ? '?' + qs.join('&') : location.pathname);\n    render();\n    window.scrollTo(0, 0);\n  }\n\n  function renderHome(){\n    setTitle('在线阅读'); setNav('home');\n    var cur = SOURCES[src] || SOURCES.fanqie;\n    app.innerHTML = '<div style=\"padding:16px 18px\">' +\n      '<div style=\"display:flex;gap:8px;margin-bottom:12px\">' +\n      '<button class=\"mdc-button' + (src==='fanqie'?'':' text') + '\" id=\"srcFanqie\" style=\"flex:1;height:40px\">番茄小说</button>' +\n      '<button class=\"mdc-button' + (src==='qimao'?'':' text') + '\" id=\"srcQimao\" style=\"flex:1;height:40px\">七猫中文网</button>' +\n      '</div>' +\n      '<h1 style=\"font-size:22px;margin:0 0 4px\">' + cur.name + '</h1>' +\n      '<div style=\"font-size:14px;color:var(--md-sys-color-on-surface-variant)\">快速在线阅读，支持书名搜索</div>' +\n      '<div class=\"mdc-search-bar\"><span class=\"search-icon\">&#128269;</span><input id=\"bid\" placeholder=\"输入书名、链接或书籍 ID\" autocomplete=\"off\"></div>' +\n      '<button class=\"mdc-button\" id=\"go\" style=\"width:100%;height:48px;border-radius:24px\">打开书籍</button>' +\n      '<div style=\"font-size:12px;color:var(--md-sys-color-on-surface-variant);margin-top:16px;line-height:1.8\">提示：' + (src==='qimao' ? '可直接输入七猫书籍 ID（如 1655407）或书名搜索。' : '搜索需配置 FANQIE_PROXY_API 代理；也可以直接粘贴番茄小说链接或书籍 ID。') + '</div>' +\n      '</div>';\n    var open = function(){\n      var v = (document.getElementById('bid').value || '').trim();\n      if (!v) return;\n      var m = v.match(/(\\d{10,})/);\n      go(m ? m[1] : v, '');\n    };\n    document.getElementById('go').onclick = open;\n    document.getElementById('bid').addEventListener('keydown', function(e){ if (e.key === 'Enter') open(); });\n    var f = document.getElementById('srcFanqie');\n    var qm = document.getElementById('srcQimao');\n    if (f) f.onclick = function(){ src='fanqie'; renderHome(); };\n    if (qm) qm.onclick = function(){ src='qimao'; renderHome(); };\n  }\n\n  function renderSearch(){\n    setTitle('搜索' + (SOURCES[src]||SOURCES.fanqie).name); setNav('search');\n    app.innerHTML = '<div style=\"padding:12px 16px 4px;font-size:13px;color:var(--md-sys-color-on-surface-variant)\">当前书源：' + (SOURCES[src]||SOURCES.fanqie).name + '</div>' +\n      '<div class=\"mdc-search-bar\"><span class=\"search-icon\">&#128269;</span><input id=\"sq\" placeholder=\"搜索书名\" autocomplete=\"off\"><button class=\"mdc-icon-button\" id=\"sgo\" style=\"color:var(--md-sys-color-primary)\">&#8594;</button></div>' +\n      '<div id=\"results\"></div>';\n    var input = document.getElementById('sq');\n    var doSearch = function(){\n      var k = (input.value || '').trim();\n      if (!k) return;\n      show(true);\n      api(ep('search', k)).then(function(r){\n        show(false);\n        renderResults(r);\n      }).catch(function(e){ show(false); document.getElementById('results').innerHTML = '<div class=\"tip\">搜索失败：' + esc(e && e.message ? e.message : e) + '</div>'; });\n    };\n    document.getElementById('sgo').onclick = doSearch;\n    input.addEventListener('keydown', function(e){ if (e.key === 'Enter') doSearch(); });\n    if (searchCache) renderResults(searchCache);\n  }\n\n  function renderResults(r){\n    var box = document.getElementById('results');\n    if (!box) return;\n    searchCache = r;\n    var data = (r && r.data) || {};\n    var list = data.search_book_data_list || data.book_list || data.book_ids || [];\n    if (r && r.code === 501) { box.innerHTML = '<div class=\"tip\">' + esc(r.message || '搜索不可用') + '</div>'; return; }\n    if (!list || !list.length) { box.innerHTML = '<div class=\"tip\">未找到相关书籍</div>'; return; }\n    var html = '<ul class=\"book-list\">';\n    for (var i = 0; i < list.length; i++) {\n      var b = list[i];\n      if (typeof b === 'string') { html += '<li class=\"book-item\" data-id=\"' + esc(b) + '\"><div class=\"book-info\"><div class=\"book-title\">' + esc(b) + '</div></div></li>'; continue; }\n      var bid = b.book_id || b.bookId || b.id || '';\n      var name = b.book_name || b.title || b.bookName || (bid ? ('书籍 ' + bid) : '未知');\n      var author = b.author || b.author_name || '';\n      var cover = b.thumb_url || b.cover || b.thumb || '';\n      var abstr = b.book_abstract || b.abstract || '';\n      var status = b.creation_status || b.status || '';\n      var statusTxt = status === '1' || status === 'serial' || status === '连载' ? '连载中' : (status === '2' || status === 'finished' ? '已完结' : '');\n      html += '<li class=\"book-item\" data-id=\"' + esc(bid) + '\">';\n      html += '<div class=\"book-cover\">' + (cover ? '<img src=\"' + esc(cover) + '\" alt=\"\">' : esc((name || '').slice(0,1))) + '</div>';\n      html += '<div class=\"book-info\"><div class=\"book-title\">' + esc(name) + '</div>';\n      if (author) html += '<div class=\"book-author\">' + esc(author) + '</div>';\n      if (abstr) html += '<div class=\"book-abstract\">' + esc(String(abstr).slice(0, 80)) + '</div>';\n      if (statusTxt) html += '<div class=\"book-status\">' + esc(statusTxt) + '</div>';\n      html += '</div></li>';\n    }\n    html += '</ul>';\n    box.innerHTML = html;\n    var items = box.querySelectorAll('.book-item');\n    for (var k = 0; k < items.length; k++) items[k].onclick = function(){ var id = this.getAttribute('data-id'); if (id) go(id, ''); };\n  }\n\n  function renderBook(){\n    show(true);\n    Promise.all([\n      detailCache ? Promise.resolve(detailCache) : api(ep('detail', bookId)),\n      api(ep('directory', bookId))\n    ]).then(function(res){\n      show(false);\n      var d = res[0] || {}, dd = res[1] || {};\n      detailCache = d;\n      var info = (d.data && (d.data.book_name || d.data.bookName)) ? d.data : (dd.data || {});\n      var name = info.book_name || info.bookName || ('书籍 ' + bookId);\n      setTitle(name);\n      var lists = (dd.data && dd.data.lists) || [];\n      dirCache = lists; dirMap = {};\n      for (var i = 0; i < lists.length; i++) dirMap[String(lists[i].item_id)] = lists[i];\n      var cover = info.cover || info.thumb_url || '';\n      var html = '<div class=\"mdc-card\" style=\"margin:16px\"><div style=\"display:flex;gap:14px;padding:16px\">';\n      html += '<div class=\"book-cover\" style=\"width:88px;height:120px\">' + (cover ? '<img src=\"' + esc(cover) + '\" alt=\"\">' : esc((name || '').slice(0,1))) + '</div>';\n      html += '<div style=\"flex:1;min-width:0\"><div class=\"book-title\" style=\"font-size:18px\">' + esc(name) + '</div>';\n      if (info.author) html += '<div class=\"book-author\">' + esc(info.author) + '</div>';\n      html += '<div class=\"book-status\">共 ' + lists.length + ' 章</div>';\n      html += '<button class=\"mdc-button\" id=\"read\" style=\"margin-top:12px\">开始阅读</button>';\n      html += '</div></div>';\n      if (info.abstract) html += '<div style=\"padding:0 16px 14px;font-size:14px;color:var(--md-sys-color-on-surface-variant);line-height:1.7\">' + esc(String(info.abstract).slice(0, 200)) + '</div>';\n      html += '</div>';\n      if (!lists.length) html += '<div class=\"tip\">目录为空，请检查书籍 ID</div>';\n      else {\n        html += '<div style=\"padding:8px 16px;font-size:14px;font-weight:600;color:var(--md-sys-color-on-surface-variant)\">章节目录</div>';\n        html += '<ul class=\"mdc-list\">';\n        for (var j = 0; j < lists.length; j++) {\n          var c = lists[j];\n          html += '<li class=\"mdc-list-item\" data-item=\"' + esc(c.item_id) + '\"><span class=\"item-title\">' + esc(c.title || ('第 ' + (c.order || j + 1) + ' 章')) + '</span><span class=\"item-meta\">' + (c.word_number ? Math.round(c.word_number/1000) + 'k字' : '') + '</span></li>';\n        }\n        html += '</ul>';\n      }\n      app.innerHTML = html;\n      var readBtn = document.getElementById('read');\n      if (readBtn && lists.length) readBtn.onclick = function(){ go(bookId, lists[0].item_id); };\n      var items = app.querySelectorAll('.mdc-list-item');\n      for (var k = 0; k < items.length; k++) items[k].onclick = function(){ go(bookId, this.getAttribute('data-item')); };\n    }).catch(function(e){\n      show(false);\n      app.innerHTML = '<div class=\"tip\">加载失败：' + esc(e && e.message ? e.message : e) + '</div>';\n    });\n  }\n\n  function renderChapter(){\n    show(true);\n    api(ep('content', itemId)).then(function(r){\n      show(false);\n      var d = r.data || {};\n      var title = d.title || (dirMap[itemId] && dirMap[itemId].title) || '章节';\n      var text = d.content || '';\n      if (!text) { app.innerHTML = '<div class=\"tip\">本章获取失败或需登录，请稍后重试。</div>'; return; }\n      if (d.paid) { app.innerHTML = '<div class=\"tip\">' + esc(d.notice || '本章为付费章节，本项目仅支持免费内容。') + '</div>'; return; }\n      setTitle(title + (d.book_name ? ' - ' + d.book_name : ''));\n      var idx = -1;\n      for (var i = 0; i < dirCache.length; i++) if (String(dirCache[i].item_id) === String(itemId)) { idx = i; break; }\n      var html = '<div style=\"padding:14px 18px 0\"><div style=\"font-size:18px;font-weight:600\">' + esc(title) + '</div>';\n      if (d.book_name) html += '<div style=\"font-size:13px;color:var(--md-sys-color-on-surface-variant);margin-top:2px\">' + esc(d.book_name) + '</div>';\n      html += '</div><div id=\"content\">' + esc(text) + '</div><div class=\"read-nav\">';\n      html += '<button class=\"mdc-button\" id=\"prev\"' + (idx > 0 ? '' : ' disabled') + '>上一章</button>';\n      html += '<button class=\"mdc-button tonal\" id=\"toc\">目录</button>';\n      html += '<button class=\"mdc-button\" id=\"next\"' + (idx >= 0 && idx < dirCache.length - 1 ? '' : ' disabled') + '>下一章</button></div>';\n      app.innerHTML = html;\n      document.getElementById('toc').onclick = function(){ go(bookId, ''); };\n      document.getElementById('prev').onclick = function(){ if (idx > 0) go(bookId, dirCache[idx - 1].item_id); };\n      document.getElementById('next').onclick = function(){ if (idx >= 0 && idx < dirCache.length - 1) go(bookId, dirCache[idx + 1].item_id); };\n    }).catch(function(e){\n      show(false);\n      app.innerHTML = '<div class=\"tip\">加载失败：' + esc(e && e.message ? e.message : e) + '</div>';\n    });\n  }\n\n  function render(){\n    detailCache = null;\n    if (itemId && bookId) renderChapter();\n    else if (bookId) renderBook();\n    else renderHome();\n  }\n\n  window.addEventListener('popstate', function(){\n    var p = new URLSearchParams(location.search);\n    bookId = p.get('book_id') || ''; itemId = p.get('item_id') || '';\n    src = p.get('source') || 'fanqie';\n    render();\n  });\n\n  // 底部导航\n  var navItems = document.querySelectorAll('.mdc-navigation-item');\n  for (var ni = 0; ni < navItems.length; ni++) {\n    navItems[ni].onclick = function(){\n      var v = this.getAttribute('data-view');\n      if (v === 'search') { go('', ''); renderSearch(); }\n      else { go('', ''); renderHome(); }\n    };\n  }\n\n  render();\n})();\n%%CS%%\n</body>\n</html>\n";

function onlineReadEnabled(env) {
  const v = env && env.FANQIE_ONLINE_READ;
  return String(v == null ? "0" : v).trim() === "1";
}

function fixReadHtml(h){var BS=String.fromCharCode(92),SL=String.fromCharCode(47),LT=String.fromCharCode(60),GT=String.fromCharCode(62);var bad=LT+BS+SL+String.fromCharCode(115,99,114,105,112,116)+GT;var good=LT+SL+String.fromCharCode(115,99,114,105,112,116)+GT;return h.split(bad).join(good);}
function hRead(request, env) {
  if (!onlineReadEnabled(env)) {
    return new Response("在线阅读未启用（FANQIE_ONLINE_READ=0）", {
      status: 403,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  const headers = {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  };
  if (request.method === "HEAD") return new Response(null, { headers });
  return new Response(fixReadHtml(READ_PAGE_HTML), { headers });
}


export default {
  async fetch(request, env, ctx) {
    const u = new URL(request.url), p = u.pathname;
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    try {
      if (p === "/") return json({
        code: 200,
        endpoints: [
          "/api/search?key=",
          "/api/detail?book_id=",
          "/api/directory?book_id=",
          "/api/content?item_id=",
          "/api/download?book_id=&start=0&count=20",
          "/api/export?book_id=&format=txt|html|epub&start=0&count=20",
          "/api/export/zip?book_id=&format=txt|html&start=0&count=20",
          "/api/update?book_id=",
          "/api/config",
          "POST /tg/webhook",
          "GET /tg/setup",
          "/read (FANQIE_ONLINE_READ=1 时启用的在线阅读页)",
          "CRON * * * * * (全自动队列)",
        ],
        font_map_entries: Object.keys(FONT_MAP).length,
      });
      if (p === "/api/search") return hSearch(env, u.searchParams.get("key") || "");
      if (p === "/api/detail") return hDetail(env, u.searchParams.get("book_id") || "");
      if (p === "/api/directory") return hDirectory(env, u.searchParams.get("book_id") || "");
      if (p === "/api/content") return hContent(env, u.searchParams.get("item_id") || "");
      if (p === "/api/download") return hDownload(env, u.searchParams.get("book_id") || "", u.searchParams.get("start"), u.searchParams.get("count"));
      if (p === "/api/export") return hExport(env, u.searchParams.get("book_id") || "", u.searchParams.get("format"), u.searchParams.get("start"), u.searchParams.get("count"));
      if (p === "/api/update") return hUpdateCheck(env, u.searchParams.get("book_id") || "");
      if (p === "/api/export/zip") return hExportZip(env, u.searchParams.get("book_id") || "", u.searchParams.get("format"), u.searchParams.get("start"), u.searchParams.get("count"));
      if (p === "/api/config") return hConfig(request, env);
      // 七猫免费书源
      if (p === "/api/caps") return hCaps(env);
      if (p === "/api/qimao/search") return hQimaoSearch(env, u.searchParams.get("key") || "");
      if (p === "/api/qimao/directory") return hQimaoDirectory(env, u.searchParams.get("book_id") || "");
      if (p === "/api/qimao/content") return hQimaoContent(env, u.searchParams.get("item_id") || "", u.searchParams.get("book_id") || "");
      if (p === "/read" || p === "/read/" || p === "/read/index.html") return hRead(request, env);
      if (p === "/api/proxy/pool") {
        if (request.method === "GET") {
          if (!env?.FANQIE_KV) return json({ code: 500, message: "FANQIE_KV not bound" }, 500);
          const pool = JSON.parse((await env.FANQIE_KV.get(PROXY_KV_KEY)) || "[]");
          const meta = JSON.parse((await env.FANQIE_KV.get(PROXY_META_KEY)) || "{}");
          return json({ code: 200, use_proxy: env?.FANQIE_USE_PROXY === "1", alive: pool.length, pool, last_probe: meta });
        }
        if (request.method === "POST") {
          const b = await request.json().catch(() => ({}));
          if (Array.isArray(b.candidates)) {
            await env.FANQIE_KV.put("proxy:candidates", JSON.stringify(b.candidates));
          }
          if (b.probe) {
            const r = await probePool(env, b.test_id);
            return json({ code: 200, ...r });
          }
          return json({ code: 200, ok: true, message: "candidates saved; add \"probe\":true to run" });
        }
        return json({ code: 405 }, 405);
      }
      if (p === "/tg/webhook" && request.method === "POST") return hTelegramWebhook(request, env, ctx);
      if (p === "/tg/setup") return hTelegramSetup(request, env);
      return json({ code: 404 }, 404);
    } catch (e) { return json({ code: 500, message: String(e) }, 500); }
  },
  async scheduled(event, env, ctx) {
    const cron = event && event.cron;
    if (cron === "0 0 * * *" || cron === "0 8 * * *") {
      ctx.waitUntil(probePool(env).catch(() => {}));
      return;
    }
    ctx.waitUntil(handleCron(env));
  },
};
