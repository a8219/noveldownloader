# fanqie-downloader Workers

基于 Cloudflare Workers + Durable Objects 的番茄小说下载/在线阅读服务。

> ⚠️ **免责声明**
> 本项目仅供学习、研究和技术交流使用。请勿用于任何商业用途或侵犯他人权益的行为。
> - 本项目不存储、不传播任何侵权内容，所有数据均实时抓取自公开网络接口。
> - 小说内容版权归原作者及平台所有，请尊重版权，下载后请在 24 小时内删除。
> - 使用者应自行承担使用本项目的一切后果，包括但不限于账号封禁、法律纠纷等。
> - 本项目作者不对任何因使用本服务造成的直接或间接损失负责。
> - 请遵守当地法律法规，合法合规使用。

---

## ✨ 功能

### 📖 在线阅读（MD3 UI）
- 基于 **Material Design 3** 的现代在线阅读界面
- **书名搜索**：支持按书名搜索（需配置代理 API）
- 书籍详情、章节目录、正文阅读
- 浅色/深色主题切换、字号调节（localStorage 持久化）
- 底部导航（首页 / 搜索）、书籍卡片列表
- 入口：`/read`（需 `FANQIE_ONLINE_READ=1` 启用）

### 🔍 核心 API
| 端点 | 说明 |
|---|---|
| `GET /` | 首页：端点列表 + 状态 |
| `GET /api/search?key=` | 搜索小说（代理优先，key 为书籍 ID 时兜底） |
| `GET /api/detail?book_id=` | 书籍详情 |
| `GET /api/directory?book_id=` | 章节目录 |
| `GET /api/content?item_id=` | 单章正文（代理 → 网页 → APP 三级兜底） |
| `GET /api/download?book_id=&start=&count=` | 分段下载纯文本 |
| `GET /api/export?book_id=&format=&start=&count=` | 导出 txt / html / epub |
| `GET /api/export/zip?book_id=&format=&start=&count=` | 分批打包 zip |
| `GET /api/update?book_id=` | 更新检查（对比 KV 记录） |
| `GET/POST /api/config` | 查看/设置代理 API |
| `POST /api/proxy/pool` | 代理池管理 |

### 🤖 Telegram Bot
- 账号注册/登录（SHA-256 密码哈希）
- 每日下载配额（默认 5 次/天），管理员无限制
- 登录失败告警、封禁机制
- 管理面板：用户管理、配额设置、欢迎语/公告
- 下载完成自动发送全书 TXT

### ⚡ 下载加速
- **Durable Objects**（推荐）：秒级并发抓取，每轮 45 章，可 `/cancel` 中断
- **KV + Cron**（兜底）：每分钟抓 45 章入队列

### 🛡️ 安全机制
- 管理员账号密码仅从环境变量读取，无硬编码
- 密码 SHA-256 哈希存储；会话 token 为服务端随机 24 字节，存于 KV 并带 30 天有效期
- 网页登录按 IP 的尝试次数限制；失败计数只在口令错误后累加，正确口令不会被锁定（防止定向锁死账号）
- 用户口令为 PBKDF2-SHA256 加盐哈希（旧的无盐 SHA-256 哈希在下次登录时自动升级），会话数据里保存的是哈希而不是口令
- 每个会话一个独立 KV 键（带 30 天 TTL），缴费与注销不需要整表读改写；同一账号只保留一个有效会话
- 管理员会话校验器使用带 pepper 的 HMAC；退出登录会在服务端删除会话键
- Telegram `/login` 连续失败 5 次锁定 15 分钟；退出登录会吊销服务端会话 token
- 网页登录使用请求头 `x-auth-token` 传递 token，不依赖 Cookie
- 阅读页返回 CSP（`script-src 'self'` + 内联脚本 SHA-256 白名单，并用 `default-src`/`style-src`/`img-src`/`connect-src`/`media-src` 收紧其余来源）、`X-Frame-Options: DENY`、`X-Content-Type-Options: nosniff`、`Referrer-Policy: no-referrer`、`X-Robots-Tag: noindex`
- 阅读页所有外部数据（书名、章节标题、正文、搜索词）均经转义后渲染，不使用 `eval` / `innerHTML` 拼接未转义内容
- Telegram Webhook 未配置 `TG_WEBHOOK_SECRET` 时默认拒绝，校验使用恒定时间比较
- 导出文件名过滤控制字符与路径保留字符，zip 内章节目录名只保留字母数字下划线，避免解压路径穿越
- 短链解析只跟随一次重定向，跳转目标会再次通过书源域名白名单校验，防止 SSRF
- 阅读页额外返回 HSTS；JSON 接口统一 `no-store` + `nosniff`

---

## 🚀 如何部署

### 1. 前置条件
- [Node.js](https://nodejs.org/) ≥ 18
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)：`npm install -g wrangler`
- Cloudflare 账号（免费版即可）

### 2. 克隆项目
```bash
git clone https://github.com/OWNER/noveldownloader.git
cd noveldownloader/workers
```

### 3. 登录 Cloudflare
```bash
wrangler login
```

### 4. 创建 KV 命名空间
```bash
wrangler kv namespace create FANQIE_KV
```
复制输出的 `id`，填入 `wrangler.toml` 的 `[[kv_namespaces]]` 中 `id = "<your-kv-id>"`。

> **注意**：`wrangler.toml` 中的 `FANQIE_DO`（Durable Object）由 `[[migrations]]` 自动创建，无需手动配置。

### 5. 设置环境变量（Secrets）
```bash
# 必填
wrangler secret put TG_BOT_TOKEN            # Telegram Bot Token
wrangler secret put FANQIE_ADMIN_USERNAME   # 管理员账号
wrangler secret put FANQIE_ADMIN_PASSWORD   # 管理员密码

# 可选
wrangler secret put FANQIE_ONLINE_READ      # 1=启用在线阅读，0=禁用（默认0）
wrangler secret put FANQIE_COOKIE           # 番茄登录 Cookie（可选）
wrangler secret put FANQIE_PROXY_API        # 代理 API 基址（可选，搜索/抓取需要）
wrangler secret put FANQIE_USE_PROXY        # 1=启用代理池
wrangler secret put TG_WEBHOOK_SECRET       # Webhook 校验串
```

### 6. 构建并部署
阅读页源码在仓库根目录的 `static/read.html`，`workers/worker.js` 是内嵌生成的单文件版本。修改阅读页或配色后先重新生成：

```bash
cd ..                     # 回到仓库根目录
python3 workers/build_reader.py
```

该脚本会把 `static/read.html`、`static/material-theme.txt` 内嵌进 `workers/worker.js`，并按内联脚本重新计算 CSP 哈希。然后部署：

```bash
cd workers
wrangler deploy
```

> 不要只改 `workers/worker.js` 里的 `const READ_PAGE_HTML = ...`：它是生成结果，页面改动应写在 `static/read.html`。

### 7. 设置 Telegram Webhook（可选）
部署后，访问或调用：
```
GET https://<your-worker-domain>/tg/setup
```
或手动设置：
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://<your-worker-domain>/tg/webhook&secret_token=<TG_WEBHOOK_SECRET>"
```

---

## 📋 环境变量一览

| 变量 | 必填 | 说明 |
|---|---|---|
| `TG_BOT_TOKEN` | ✅ | Telegram Bot Token |
| `FANQIE_ADMIN_USERNAME` | ✅ | 管理员账号 |
| `FANQIE_ADMIN_PASSWORD` | ✅ | 管理员密码 |
| `FANQIE_ONLINE_READ` | ❌ | `1` 启用在线阅读，`0` 禁用，默认 `0` |
| `FANQIE_COOKIE` | ❌ | 番茄登录 Cookie（网页抓取用） |
| `FANQIE_PROXY_API` | ❌ | 代理 API 基址（搜索/内容抓取） |
| `FANQIE_USE_PROXY` | ❌ | `1` 启用代理池 |
| `TG_WEBHOOK_SECRET` | ❌ | Telegram Webhook 校验串 |

> ⚠️ 管理员账号密码仅从环境变量读取，代码中无硬编码，也不写入 KV。

---

## 📖 使用说明

### 在线阅读
1. 确保 `FANQIE_ONLINE_READ=1`
2. 访问 `https://<your-worker-domain>/read`
3. 首页输入书名/链接/ID 搜索或打开书籍

### Telegram 机器人
1. 打开与 Bot 的聊天，发送 `/start`
2. 发送小说链接或 ID（如 `https://fanqienovel.com/page/7615694942362422297`）
3. 自动下载完成后发送全书 TXT

---

## ⚠️ 免责声明（再次强调）

- 本项目**仅供学习交流**，不构成任何形式的服务承诺。
- 所有下载内容版权归原作者及平台所有，请尊重版权。
- 使用本项目即表示您同意自行承担所有风险与责任。
- 若您不同意以上条款，请立即停止使用并删除本项目。

---

## UI 预览环境

`wrangler.preview.toml` 部署独立的 `noveldownloader-ui-preview`，从 `../static/read.html` 导入阅读页。使用已登录的 Wrangler 执行：

```bash
npx wrangler deploy --config wrangler.preview.toml
```

预览页的 `/api/*` 通过 `READER_API` service binding 调用现有的 `fanqie-downloader`。搜索、目录、正文、认证、书架和历史均使用现有后端；书架与历史操作会修改现有账号数据。预览不复制生产密钥或存储绑定，也不提供 Telegram 设置/回调路由。生产阅读页不随预览部署改变。

外观面板支持自动尝试 CSS `AccentColor`、自选主题色、明暗主题和全局玻璃材质。Android Chrome 等浏览器可能不开放系统强调色，网页无法直接读取壁纸莫奈色；检测不到时明确提示，并使用可手动调整的主题色。动态色板通过本地打包的 Google Material Color Utilities 0.4.0 生成，覆盖主色、容器、表面及文字等颜色角色；未把普通混色声称为系统取色。图标均为内联 SVG，许可见 `../static/LUCIDE-LICENSE.txt`。原生系统选择器、权限提示与系统语音界面仍由浏览器/系统绘制。

阅读支持「上下滚动」与「左右翻页」两种方式，正文上方和外观面板都可切换。翻页按当前可视高度分栏，提供页码、按钮、左右滑动与方向键操作；跨越章首/章末可进入相邻章节（向前返回上一章末页）。窗口尺寸改变后按章内比例重排，阅读方式和最近一次章内翻页进度保存在本浏览器。直接打开章节链接时也会加载目录以启用相邻章节导航，朗读仍读取整章文本。

`material-theme-entry.js` 是配色入口，使用 `@material/material-color-utilities@0.4.0` 和 esbuild 构建成 `../static/material-theme.txt`（IIFE，全局变量 `MaterialTheme`）。预览 Worker 将文本模块作为 `/material-theme.js` 返回，运行时不访问 CDN。重新构建时保留 Google 版权和 Apache-2.0 许可，完整许可另见 `../static/MATERIAL-LICENSE.txt`。

## 📄 License
- 项目基于 [AGPL-3.0](../LICENSE) 开源协议。
