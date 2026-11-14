# NovelDownloader

一个自成一体的小说下载与在线阅读服务器，使用 **Rust + Axum** 原生实现。附带 Cloudflare Worker 兼容后端。

> ⚠️ **免责声明**
>
> 本项目仅供个人学习、研究和技术交流使用。使用本项目即表示您已阅读并同意以下条款：
>
> 1. **版权声明**：所有小说内容的版权归原作者和对应平台所有。本项目不存储、不分发任何小说内容，仅提供技术接口用于个人离线阅读。
> 2. **使用限制**：禁止将本项目用于商业用途、批量爬取、数据倒卖或其他侵犯他人权益的行为。
> 3. **风险承担**：使用本项目可能导致账号封禁、IP 封锁或其他平台处罚。使用者应自行承担一切风险和后果。本项目作者不对任何因使用本服务造成的直接或间接损失负责。
> 4. **合规使用**：请遵守您所在地的法律法规和平台服务条款。若您不同意以上条款，请立即停止使用并删除本项目。
> 5. **无担保**：本项目按"现状"提供，不提供任何明示或暗示的担保。作者不保证项目的可用性、准确性或完整性。

## 致谢 / Credits

本项目的部分功能建立在其他开源项目的工作之上，在此感谢以下作者：

| 项目 | 作者 | 许可证 | 贡献内容 |
|---|---|---|---|
| [fanqie-assistant](https://github.com/naiyQAQ/fanqie-assistant) | [naiyQAQ](https://github.com/naiyQAQ) | GPL-3.0 | APP 请求签名（X-Argus/X-Ladon）、匿名设备注册、章节加密解密 |
| [Vue.js](https://github.com/vuejs/core) | Yuxi (Evan) You | MIT | Worker 内打包的 Vue runtime（实际未使用） |
| [fanqienovel-downloader](https://github.com/ying-ck/fanqienovel-downloader) | [ying-ck](https://github.com/ying-ck) | AGPL-3.0 | 番茄公开 API 契约参考（本项目最初衍生自此，后完全重写） |
| [qxqycb/search-novel](https://github.com/qxqycb/search-novel) | [qxqycb](https://github.com/qxqycb) | — | 搜索接口参数参考 |
| [fanqienovel-downloader](https://github.com/lingo34/fanqienovel-downloader) | [lingo34](https://github.com/lingo34) | — | 目录/正文解析思路参考 |

原创部分（MD3 阅读页、字体映射、Telegram Bot、Durable Object 队列、Rust API 层、Docker 部署等）由 [a8219](https://github.com/a8219) 开发。

完整的第三方代码声明与许可详情见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 功能

### 原生实现
- **请求签名**：Argus + Ladon 签名（SM3、Simon-128、Speck-128、Protobuf、AES-CBC）
- **设备注册**：自动注册匿名设备，获取 device_id / install_id
- **密钥注册**：通过 `/reading/crypt/registerkey` 获取章节解密密钥
- **章节解密**：AES-CBC 解密 + 字体映射解码（362 个 PUA 字符）
- **HTML 清洗**：标签剥离、实体解码、换行规范化
- **MD3 在线阅读**：搜索、目录、正文、主题切换、字号调节

### API 接口
| 路径 | 功能 | 认证 |
|---|---|---|
| `GET /` | 服务状态与端点清单 | 公开 |
| `GET /health` | 健康检查 | 公开 |
| `GET /read` | Material Design 3 在线阅读页 | 公开 |
| `GET /api/config` | 配置状态（仅布尔，不泄漏 URL） | 公开 |
| `GET /api/search?key=` | 书名搜索 | 管理员 |
| `GET /api/detail?book_id=` | 书籍详情 | 管理员 |
| `GET /api/directory?book_id=` | 章节目录 | 管理员 |
| `GET /api/content?item_id=` | 单章正文 | 管理员 |
| `GET /api/download` | 分段文本下载 | 管理员 |
| `GET /api/export` | 导出 txt / html | 管理员 |
| `GET /api/export/zip` | ZIP 打包导出 | 管理员 |
| `GET /api/library` | 书库管理 | 管理员 |
| `GET /api/jobs` | 下载任务 | 管理员 |
| `POST /tg/webhook` | Telegram Webhook（校验 secret） | 签名 |
| `GET /tg/setup` | 注册 TG Webhook | 管理员 |

### 支持下载的平台（书源）

| 平台 | 书源 ID | 在线读 | 下载 | 搜索 | 说明 |
|---|---|---|---|---|---|
| 番茄小说（Fanqie） | `fanqie` | ✅ | ✅ | ✅（需 `FANQIE_PROXY_API`） | 免费 + Cookie 解锁完整章节 |
| 七猫中文网（Qimao） | `qimao` | ✅ | ✅ | ✅ | 免费书源，全书免费阅读 |
| 刺猬猫（Ciweimao） | `ciweimao` | ✅ | ✅ | ⚠️（站内搜索暂不可用，请直接粘贴书籍链接 / ID） | 部分章节需登录，仅支持免费公开内容（正文接口为双层 AES 加密，已支持解密） |

> 在线读：`/read?source=<书源ID>&book_id=<ID>`；下载：`/api/download?source=<书源ID>&book_id=<ID>&start=0&count=20`（Worker）或 Telegram Bot 直接发送书籍链接/ID。

## 部署

### 一键安装（推荐）
```bash
curl -fsSL https://raw.githubusercontent.com/a8219/noveldownloader/main/install.sh | bash
```
自动检测 Rust 工具链（缺失则装 rustup），然后 `cargo install noveldownloader --git ... --locked --release`
从源码构建（锁定 Cargo.lock 版本），安装到 `~/.cargo/bin/noveldownloader`。
支持任何 Rust 能编译到的平台（Linux / macOS / WSL / Termux …），无预编译 release。

### Docker Compose
```bash
git clone https://github.com/a8219/noveldownloader.git
cd noveldownloader
cp .env.example .env
docker compose up -d --build
```

### 源码编译
```bash
cargo run --release
```
访问 `http://127.0.0.1:8080/read`

## 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `BIND_ADDR` | `0.0.0.0:8080` | 监听地址 |
| `RUST_LOG` | `info,tower_http=info` | 日志级别 |
| `REQUEST_TIMEOUT_SECS` | `45` | 请求超时 |
| `FANQIE_COOKIE` | 空 | 可选会话 Cookie（解锁完整章节） |
| `FANQIE_PROXY_API` | 空 | 可选搜索代理 |
| `TG_BOT_TOKEN` | 空 | Telegram Bot Token |
| `TG_WEBHOOK_SECRET` | 空 | Webhook 校验串（强烈建议设置） |
| `FANQIE_ADMIN_USERNAME` | 空 | 管理员账号（设置后启用 HTTP Basic 认证） |
| `FANQIE_ADMIN_PASSWORD` | 空 | 管理员密码 |
| `FANQIE_ONLINE_READ` | `1` | 在线阅读开关 |
| `FANQIE_ADMIN_TOKEN` | 空 | Worker 管理令牌（x-admin-token 请求头），设置后 /api/config、/api/proxy/pool、/tg/setup 的写操作需携带，否则 403 |

## 移动端 / iOS 使用方式

本项目提供的是**自成一体**的命令行 / 服务器二进制，不依赖任何外部后端。
由于 iPhone 沙箱禁止 App 开 TCP 监听端口，**不提供 iOS App 壳**。
iOS 用户请任选以下方案接入下载：

1. **workers 版接 Telegram Bot**：部署 `workers/` 到 Cloudflare，配好 `TG_BOT_TOKEN` + `TG_WEBHOOK_SECRET`，访问 `/tg/setup` 注册 webhook，把书链接发给 Bot 即得 TXT 文件。
2. **Rust 服务器版接 Telegram Bot**：在 VPS / 家用机跑 `noveldownloader` 二进制，同样配 `TG_BOT_TOKEN` + `TG_WEBHOOK_SECRET`，走 `/tg/setup`。
3. **网页在线阅读**：浏览器（含 iPhone Safari）打开 `http://<服务器>:8080/read`，配 `FANQIE_COOKIE` 后可读完整正文。

以上三种方案都**不经过 App Store、无需签名、无需上架**，iOS 端零门槛。

## 安全说明

- 默认**不启用认证**（服务仅本机监听时安全）。若把 `BIND_ADDR` 指向公网，**务必**设置 `FANQIE_ADMIN_USERNAME` + `FANQIE_ADMIN_PASSWORD`，否则 `/api/*` 与 `/tg/setup` 可被匿名调用。
- 启用管理员后，所有 `/api/*` 与 `/tg/setup` 需携带 HTTP Basic 认证；`/tg/webhook` 由 Telegram 服务器回调（不带 Basic 头），故豁免 Basic 认证，改为校验 `TG_WEBHOOK_SECRET`——**设置了 `TG_WEBHOOK_SECRET` 时**，webhook 必须携带匹配的 `secret_token`，否则返回 403。不设置该变量时 webhook 不校验（建议公网部署务必设置）。
- `/api/config` 只返回布尔开关，不泄漏代理 URL / Cookie 等敏感值。
- 文件 / ZIP 导出文件名经路径与 CRLF 过滤，防止路径遍历与响应头注入。
- 依赖版本已通过 `cargo audit`（RustSec advisory-db）核验，无未修复高危。

## 许可证

本项目以 [AGPL-3.0](LICENSE) 分发。

选择 AGPL-3.0 是因为 `workers/worker.js` 包含来自 [fanqie-assistant](https://github.com/naiyQAQ/fanqie-assistant)（GPL-3.0）的代码，根据 GPL-3.0 的传染性条款，衍生作品须以兼容许可证分发。AGPL-3.0 与 GPL-3.0 兼容，且额外要求网络服务也开源源码。

详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。