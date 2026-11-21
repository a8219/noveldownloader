# NovelDownloader

一个基于 **Cloudflare Workers** 的小说下载与在线阅读服务，支持番茄小说、七猫中文网、刺猬猫三个书源。附带 Telegram Bot 与 Material Design 3 在线阅读界面。

> 📌 本项目已全力转向 Workers 版本，原 Rust + Axum 服务器版本已从仓库移除（历史可在 Git 记录中查看）。

> ⚠️ **免责声明**
>
> 本项目仅供个人学习、研究和技术交流使用。使用本项目即表示您已阅读并同意以下条款：
>
> 1. **版权声明**：所有小说内容的版权归原作者和对应平台所有。本项目不存储、不分发任何小说内容，仅提供技术接口用于个人离线阅读。
> 2. **使用限制**：禁止将本项目用于商业用途、批量爬取、数据倒卖或其他侵犯他人权益的行为。
> 3. **风险承担**：使用本项目可能导致账号封禁、IP 封锁或其他平台处罚。使用者应自行承担一切风险和后果。本项目作者不对任何因使用本服务造成的直接或间接损失负责。
> 4. **合规使用**：请遵守您所在地的法律法规和平台服务条款。若您不同意以上条款，请立即停止使用并删除本项目。
> 5. **无担保**：本项目按"现状"提供，不提供任何明示或暗示的担保。作者不保证项目的可用性、准确性或完整性。

## 功能

### 📖 在线阅读（MD3）
- Material Design 3 界面：搜索、详情、目录、正文、上下章
- 浅色 / 深色主题切换、字号调节（localStorage 持久化）
- **TTS 朗读**：系统语音，或配置 OpenAI 兼容的自定义 TTS API
- **账号系统**：TG 注册的账号可直接登录网页版，支持**我的书架**与**阅读历史**（云端同步）
- 入口：`/read`（需 `FANQIE_ONLINE_READ=1` 启用）

### 🔍 书源
| 平台 | 书源 ID | 在线读 | 下载 | 搜索 | 说明 |
|---|---|---|---|---|---|
| 番茄小说 | `fanqie` | ✅ | ✅ | ✅（需 `FANQIE_PROXY_API`） | 支持 APP 接口解密，`FANQIE_COOKIE` 可解锁完整章节 |
| 七猫中文网 | `qimao` | ✅ | ✅ | ✅ | 免费书源 |
| 刺猬猫 | `ciweimao` | ✅ | ✅ | ⚠️（站内搜索不可用，请粘贴书籍链接 / ID） | 仅支持免费公开内容，双层 AES 已解密 |

> 在线阅读：`/read?source=<书源ID>&book_id=<ID>`

### 🤖 Telegram Bot
- 账号注册 / 登录（SHA-256 哈希存储）
- 每日下载配额（默认 5 次/天），管理员无限制
- 登录失败限流与告警、封禁机制
- 管理面板：用户管理、配额设置、欢迎语 / 公告
- 发送书籍链接或 ID，下载完成自动回传全书 TXT

### ⚡ 下载加速
- **Durable Objects**：并发抓取，每轮 45 章，`/cancel` 可中断
- **KV + Cron**：每分钟抓取入队，作为兜底

## API 端点

| 路径 | 功能 | 认证 |
|---|---|---|
| `GET /` | 首页：服务状态与端点清单 | 公开 |
| `GET /read` | MD3 在线阅读页 | 公开 |
| `GET /api/search?key=` | 番茄书名搜索（代理优先） | 公开 |
| `GET /api/detail?book_id=` | 番茄书籍详情 | 公开 |
| `GET /api/directory?book_id=` | 番茄章节目录 | 公开 |
| `GET /api/content?item_id=` | 番茄单章正文（代理 → 网页 → APP 三级兜底） | 公开 |
| `GET /api/qimao/search\|directory\|content` | 七猫搜索 / 目录 / 正文 | 公开 |
| `GET /api/ciweimao/search\|directory\|content` | 刺猬猫搜索 / 目录 / 正文 | 公开 |
| `GET /api/download?book_id=&start=&count=` | 分段下载纯文本 | 公开 |
| `GET /api/export?book_id=&format=&start=&count=` | 导出 txt / html / epub | 公开 |
| `GET /api/export/zip?book_id=&format=&start=&count=` | 分批打包 zip | 公开 |
| `GET /api/update?book_id=` | 更新检查（对比 KV 记录） | 公开 |
| `POST /api/auth` | 网页登录（账号 + 密码，返回 token） | 公开 |
| `GET/POST/DELETE /api/history` | 阅读历史（`x-auth-token` 请求头） | 账号 |
| `GET/POST/DELETE /api/shelf` | 我的书架（`x-auth-token` 请求头） | 账号 |
| `GET /tg/setup` | 注册 Telegram Webhook | 管理员 |
| `POST /tg/webhook` | Telegram 回调（校验 `secret_token`） | 签名 |

## 部署

详细步骤见 [workers/README.md](workers/README.md)，简要流程：

```bash
# 1. 安装 Wrangler
npm install -g wrangler

# 2. 进入 workers 目录并登录
cd workers
wrangler login

# 3. 创建 KV 命名空间，把 id 填入 wrangler.toml
wrangler kv namespace create FANQIE_KV

# 4. 配置 Secrets（必填）
wrangler secret put TG_BOT_TOKEN
wrangler secret put FANQIE_ADMIN_USERNAME
wrangler secret put FANQIE_ADMIN_PASSWORD

# 5. 部署
wrangler deploy
```

## 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `TG_BOT_TOKEN` | ✅ | Telegram Bot Token |
| `FANQIE_ADMIN_USERNAME` | ✅ | 管理员账号 |
| `FANQIE_ADMIN_PASSWORD` | ✅ | 管理员密码 |
| `FANQIE_ONLINE_READ` | ❌ | `1` 启用在线阅读页 `/read`，默认 `0` |
| `FANQIE_COOKIE` | ❌ | 番茄登录 Cookie（解锁完整章节） |
| `FANQIE_PROXY_API` | ❌ | 搜索 / 抓取代理 API 基址 |
| `FANQIE_USE_PROXY` | ❌ | `1` 启用代理池 |
| `TG_WEBHOOK_SECRET` | ❌ | Telegram Webhook 校验串（公网部署强烈建议设置） |

> 管理员账号密码仅从环境变量读取，代码中无硬编码，也不写入 KV。

## 安全说明

- 管理员凭据仅经 `wrangler secret` 注入，不落库、不写进代码。
- `/tg/webhook` 校验 Telegram 的 `secret_token`，不匹配直接 403（配置了 `TG_WEBHOOK_SECRET` 时）。
- 登录失败按规范化账号 + IP 限流，多余尝试会被锁定；认证限流器不可用时拒绝认证。
- 请求体按 UTF-8 字节流限制大小，超限即中断；代理请求不自动跟随重定向。
- 网页登录令牌绑定账号与密码指纹，改密后旧令牌自动失效。

## 致谢 / Credits

本项目的部分功能建立在其他开源项目的工作之上，在此感谢以下作者：

| 项目 | 作者 | 许可证 | 贡献内容 |
|---|---|---|---|
| [fanqie-assistant](https://github.com/naiyQAQ/fanqie-assistant) | [naiyQAQ](https://github.com/naiyQAQ) | GPL-3.0 | APP 请求签名（X-Argus/X-Ladon）、匿名设备注册、章节加密解密 |
| [Vue.js](https://github.com/vuejs/core) | Yuxi (Evan) You | MIT | Worker 内打包的 Vue runtime（实际未使用） |
| [fanqienovel-downloader](https://github.com/ying-ck/fanqienovel-downloader) | [ying-ck](https://github.com/ying-ck) | AGPL-3.0 | 番茄公开 API 契约参考（本项目最初衍生自此，后完全重写） |
| [qxqycb/search-novel](https://github.com/qxqycb/search-novel) | [qxqycb](https://github.com/qxqycb) | — | 搜索接口参数参考 |
| [fanqienovel-downloader](https://github.com/lingo34/fanqienovel-downloader) | [lingo34](https://github.com/lingo34) | — | 目录/正文解析思路参考 |

原创部分（MD3 阅读页、字体映射、Telegram Bot、Durable Object 队列、Web 账号 / 书架 / 历史、TTS 集成等）由 [a8219](https://github.com/a8219) 开发。

完整的第三方代码声明与许可详情见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 许可证

本项目以 [AGPL-3.0](LICENSE) 分发。

选择 AGPL-3.0 是因为 `workers/worker.js` 包含来自 [fanqie-assistant](https://github.com/naiyQAQ/fanqie-assistant)（GPL-3.0）的代码，根据 GPL-3.0 的传染性条款，衍生作品须以兼容许可证分发。AGPL-3.0 与 GPL-3.0 兼容，且额外要求网络服务也开源源码。

详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
