#!/usr/bin/env bash
# NovelDownloader 一键安装（Linux / macOS / WSL）
# 用法: curl -fsSL https://raw.githubusercontent.com/a8219/noveldownloader/main/install.sh | bash
set -euo pipefail

VERSION="0.3.0"
BIN="noveldownloader"
URL_BASE="https://github.com/a8219/noveldownloader/releases/download/v${VERSION}"

detect() {
  local os arch
  os=$(uname -s | tr '[:upper:]' '[:lower:]')
  arch=$(uname -m)
  case "$arch" in
    x86_64|amd64)  arch="x86_64" ;;
    aarch64|arm64) arch="aarch64" ;;
    *) echo "Unsupported arch: $arch"; exit 1 ;;
  esac
  echo "${os}-${arch}"
}

install() {
  local target
  target=$(detect)
  local bin_name="${BIN}"
  case "$target" in
    linux-x86_64)    bin_name="${BIN}-x86_64-linux-gnu" ;;
    linux-aarch64)   bin_name="${BIN}-aarch64-linux-gnu" ;;
    darwin-x86_64)   bin_name="${BIN}-x86_64-macos" ;;
    darwin-aarch64)  bin_name="${BIN}-aarch64-macos" ;;
    *) echo "No release for: $target"; exit 1 ;;
  esac

  echo "→ Installing ${bin_name} (${target})..."
  local tmp
  tmp=$(mktemp)
  curl -fSL "$URL_BASE/${bin_name}" -o "$tmp"
  install -m 755 "$tmp" "/usr/local/bin/${BIN}"
  rm -f "$tmp"
  echo "✓ ${BIN} installed to /usr/local/bin/${BIN}"
}

post() {
  echo ""
  echo "快速启动:"
  echo "  ${BIN}                          # 默认 :8080"
  echo "  BIND_ADDR=127.0.0.1:9090 ${BIN}  # 自定义端口"
  echo ""
  echo "必需环境变量 (用 export 或 .env):"
  echo "  FANQIE_COOKIE       番茄登录 cookie (完整章节)"
  echo "  FANQIE_PROXY_API    搜索代理 API (可选，提升搜索)"
  echo "  TG_BOT_TOKEN        Telegram Bot Token (可选)"
  echo "  FANQIE_ADMIN_USERNAME / FANQIE_ADMIN_PASSWORD  (可选，启用认证)"
  echo ""
  echo "启动后访问:"
  echo "  /read           在线阅读"
  echo "  /api/search     搜索"
  echo "  /api/download   下载 TXT"
  echo "  /tg/setup       注册 TG Bot webhook"
}

main() {
  install
  post
}

main