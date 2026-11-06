#!/usr/bin/env bash
# NovelDownloader 一键安装（从源码构建，始终最新，含全部安全修复）
#
# 用法:
#   curl -fsSL https://raw.githubusercontent.com/a8219/noveldownloader/main/install.sh | bash
#
# 说明:
#   - 自成一体 / 无需后端的命令行下载器（Rust + Axum）
#   - 支持任何 Rust 能编译到的平台（Linux / macOS / WSL / Android-Termux ...）
#   - 直接 cargo 从源码构建 → 永远是包含最新安全修复的版本，不依赖预编译 release
set -euo pipefail

REPO="https://github.com/a8219/noveldownloader.git"
CRATE="noveldownloader"

echo "==> [1/3] 检查 Rust 工具链"
if ! command -v cargo >/dev/null 2>&1; then
  echo "    未检测到 cargo，正在安装 stable 工具链 (rustup)..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable --profile minimal
  # shellcheck disable=SC1091
  [ -f "${HOME}/.cargo/env" ] && source "${HOME}/.cargo/env"
fi
cargo --version

echo "==> [2/3] 从源码安装 ${CRATE} (release, 锁定依赖)"
# --locked 使用已核验无未修复高危的 Cargo.lock；--force 覆盖旧版本
cargo install "${CRATE}" \
  --git "${REPO}" --branch main --locked --force \
  --root "${HOME}/.cargo/bin"

echo "==> [3/3] 完成"
if ! command -v "${CRATE}" >/dev/null 2>&1; then
  echo "    可执行文件位于: ${HOME}/.cargo/bin/${CRATE}"
  echo "    若命令未生效，请确保 ${HOME}/.cargo/bin 在 PATH 中:"
  echo '      export PATH="$HOME/.cargo/bin:$PATH"'
else
  echo "    已就绪: $(command -v "${CRATE}")"
fi

cat <<'EOF'

------------------------------------------------------------
快速启动:
  noveldownloader                       # 默认监听 0.0.0.0:8080
  BIND_ADDR=127.0.0.1:9090 noveldownloader

环境变量 (export 或 .env):
  FANQIE_COOKIE           番茄登录 cookie（完整章节）
  FANQIE_PROXY_API        搜索代理 API（可选）
  TG_BOT_TOKEN            Telegram Bot Token（可选）
  TG_WEBHOOK_SECRET       Webhook 校验串（公网部署务必设置）
  FANQIE_ADMIN_USERNAME   管理员账号（设置后启用 HTTP Basic 认证）
  FANQIE_ADMIN_PASSWORD   管理员密码

启动后访问:
  /read          在线阅读
  /api/search    搜索
  /api/download  下载 TXT
  /tg/setup      注册 Telegram Bot webhook
------------------------------------------------------------
EOF