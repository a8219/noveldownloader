# THIRD_PARTY_NOTICES.md

## 第三方代码与组件声明

本仓库包含来自以下第三方项目的代码。各组件按其原始许可证授权，本项目的 AGPL-3.0 许可证不影响这些组件的原始授权条款。

---

### 1. fanqie-assistant

| 项目 | 内容 |
|---|---|
| 来源 | https://github.com/naiyQAQ/fanqie-assistant |
| 作者 | naiyQAQ |
| 许可证 | **GPL-3.0** (GNU General Public License v3.0) |
| 位置 | `workers/worker.js` 中的 `__FQ` IIFE（第 ~30 行至 ~3900 行） |
| 原始大小 | 约 150,000 字符（打包后裁剪版） |
| 用途 | APP 正文接口：请求签名（X-Argus/X-Ladon）、匿名设备注册、密钥获取、AES-CBC 章节解密 |
| 包含算法 | SM3（国密哈希）、Simon-128、Speck-128、AES-128-CBC、Protobuf 编码、MD5 |
| 修改说明 | 裁剪打包产物，移除脚本 UI 与油猴 API 依赖，添加 `GM_xmlhttpRequest` 模拟层以适配 Cloudflare Workers 环境 |

**许可文件**: 该项目的完整 GPL-3.0 许可证文本见其仓库 [LICENSE](https://github.com/naiyQAQ/fanqie-assistant/blob/main/LICENSE) 文件。

由于 GPL-3.0 的传染性条款，`workers/worker.js` 因包含此代码而整体以 AGPL-3.0 分发（AGPL-3.0 与 GPL-3.0 兼容）。

---

### 2. Vue.js Runtime

| 项目 | 内容 |
|---|---|
| 来源 | https://github.com/vuejs/core |
| 作者 | Yuxi (Evan) You and Vue contributors |
| 许可证 | **MIT License** |
| 版本 | 3.5.40 |
| 位置 | `workers/worker.js` 的 `__FQ` IIFE 内部（`node_modules/@vue/*`） |
| 包含模块 | @vue/shared、@vue/reactivity、@vue/runtime-core、vue（runtime） |
| 用途 | 原始脚本的 UI 框架。本 Worker 实际未调用任何 Vue 函数，保留是因为裁剪会破坏打包结构 |

**许可文件**: MIT License，版权声明已保留在 worker.js 的 "Bundled license information" 注释块中。

---

### 3. 免费字体映射（FONT_MAP）

| 项目 | 内容 |
|---|---|
| 来源 | 自行逆向工程 |
| 方法 | 将番茄小说自绘字体（子集 woff2 `dc027189e0ba4cd`）的每个字形轮廓 MD5 与思源黑体 SourceHanSansCN-Normal v2.002 比对 |
| 结果 | 362 个 PUA（Private Use Area）码点 → 实际汉字映射，三本不同书籍验证全覆盖 |
| 位置 | `workers/worker.js` 中的 `FONT_MAP` 常量 |
| 许可 | 本项目原创，适用 AGPL-3.0 |

---

### 4. 参考项目（不含代码，仅参考 API 契约）

| 项目 | 说明 |
|---|---|
| [ying-ck/fanqienovel-downloader](https://github.com/ying-ck/fanqienovel-downloader) | AGPL-3.0。Python 番茄下载器。本项目最初衍生自此项目，后完全重写。仅参考了番茄公开接口的 URL 格式与 JSON 字段名（API 契约事实）。当前仓库不包含此项目的任何源代码。 |
| [qxqycb/search-novel](https://github.com/qxqycb/search-novel) | 番茄搜索工具，参考了搜索接口参数格式。 |
| [lingo34/fanqienovel-downloader](https://github.com/lingo34/fanqienovel-downloader) | 番茄下载器，参考了目录/正文解析思路。 |

---

## 许可证兼容性说明

```
fanqie-assistant (GPL-3.0)
    ↓ 内联到 workers/worker.js
workers/worker.js → 整体 AGPL-3.0（AGPL-3.0 兼容 GPL-3.0）

Vue.js (MIT) → 保留原始版权声明即可
原创部分 → AGPL-3.0
```

本项目选择 **AGPL-3.0** 作为整体许可证，因为：
1. AGPL-3.0 兼容 GPL-3.0，可以合法包含 GPL-3.0 代码
2. AGPL-3.0 与 ying-ck/fanqienovel-downloader 的原始协议一致
3. AGPL-3.0 要求网络服务也开源源码，保护最终用户权益