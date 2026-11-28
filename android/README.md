# Android 离线版（本地一体包）

把在线阅读页和 Cloudflare Worker 的全部逻辑打包进一个 Android APK：搜索、图书详情、目录、正文解密、下载/导出、书架、阅读历史、外观与翻页都在手机本地执行。

- **不监听任何端口、不启动本地 HTTP 服务器**：页面通过 `file:///android_asset/` 加载，`/api/*` 请求由 WebView 内的 Worker 处理函数直接返回。
- **不经过自建服务器**：只有取书时才访问书源接口，不会把阅读数据发到任何自建服务。
- **内置番茄搜索**：使用内置的 APP 签名请求（`/bookapi/search/page/v/`），无需代理即可搜书。
- 本地自动创建「本地阅读」账号，书架与阅读历史存在本机 `localStorage`。
- 可选设置（阅读页右下角 ⚙）：代理 API 基址、番茄网页 Cookie；保存后立即生效，也可一键清除本地数据。

## 构建

前置：

- JDK（`javac`）：`apt install openjdk-21-jdk-headless`
- Android platform 23 与 build-tools 29.0.3（提供 `aapt2`/`zipalign`/`apksigner`）：
  `apt install android-sdk-platform-23 android-sdk-build-tools`
- `d8`：从 Google Maven 下载 r8，例如
  `curl -L -o r8.jar https://maven.google.com/com/android/tools/r8/8.3.37/r8-8.3.37.jar`
- 首次签名会自动生成 keystore（可用 `KEYSTORE`/`KS_PASS` 环境变量指定）

打包：

```bash
# 需要先生成生产版 Worker（会内嵌阅读页与配色）
python3 workers/build_reader.py
bash android/build_apk.sh
```

产物：`android/build/本地小说阅读-离线版-1.0.apk`。可用 `SDK_JAR`、`BT`、`AAPT2`、`D8` 环境变量覆盖默认工具路径。

## 结构

| 文件 | 作用 |
|---|---|
| `build_assets.py` | 从 `static/read.html` + 生产 Worker 生成离线资产，并加入内置搜索与本地模式适配 |
| `local-bridge.js` | WebView 内的本地运行时：`localStorage` 当 KV、Durable Object 桩、`/api/*` 就地处理、本地账号与设置面板 |
| `java/.../MainActivity.java` | 只有 WebView 壳；无服务、无端口 |
| `build_apk.sh` | 编译、dex、链接资源、对齐、签名 |

## 已知限制

- 系统 TTS 在 WebView 中可能不可用；自定义 OpenAI 兼容 TTS（https 接口）可用。
- Telegram Bot / 管理后台 / Cloudflare 专属功能在 APK 内不可达。
- 目标 SDK 29 是为了保留 `file://` 页面的跨域访问能力（直接访问书源接口所需）。
- 仍需联网取书；APK 只是把服务端逻辑搬到本地。

## License

与主仓库一致，AGPL-3.0。
