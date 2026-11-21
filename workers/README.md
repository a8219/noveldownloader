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
| `POST /api/auth` | 网页登录（账号+密码，返回 token） |
| `GET/POST/DELETE /api/history` | 阅读历史（需 `x-auth-token`） |
| `GET/POST/DELETE /api/shelf` | 我的书架（需 `x-auth-token`） |
| `GET /api/qimao/search\|directory\|content` | 七猫搜索 / 目录 / 正文 |
| `GET /api/ciweimao/search\|directory\|content` | 刺猬猫搜索 / 目录 / 正文 |

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
- 密码 SHA-256 哈希存储
- 登录失败限流 + 管理员告警

---

## 🚀 如何部署

### 1. 前置条件
- [Node.js](https://nodejs.org/) ≥ 18
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)：`npm install -g wrangler`
- Cloudflare 账号（免费版即可）

### 2. 克隆项目
```bash
git clone https://github.com/a8219/noveldownloader.git
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

> **注意**：`wrangler.toml` 中的 `FANQIE_DO`（Durable Object）通过 `[exports.FanqieJob]` 声明式绑定，首次部署自动创建，无需手动迁移。

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

### 6. 部署
```bash
wrangler deploy
```

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

## 📄 License
- 项目基于 [AGPL-3.0](../LICENSE) 开源协议。
