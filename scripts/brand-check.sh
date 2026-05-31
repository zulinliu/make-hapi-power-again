#!/usr/bin/env bash
# brand-check.sh — 扫描源码中的 hapi 旧品牌残留
# 用法: ./scripts/brand-check.sh [--strict]
# --strict: 同时检查注释中的残留（默认只检查用户可见文本）
#
# 退出码: 0 = 无残留, 1 = 发现残留
#
# 白名单（不报错）:
#   - @hapipower (npm 包名)
#   - HAPI_POWER_ (环境变量前缀)
#   - hapiPower / hapi_power / hapi-power (代码标识符/目录名)
#   - hapiHubUrl / hapi_hub_url (已有 camelCase/snake_case 标识符)
#   - hapi-power.dev (新域名)
#   - hapipower (全小写标识符)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
STRICT="${1:-}"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 扫描目录
SCAN_DIRS=(
    "$PROJECT_ROOT/cli/src"
    "$PROJECT_ROOT/cli/tests"
    "$PROJECT_ROOT/shared/src"
    "$PROJECT_ROOT/hub/src"
    "$PROJECT_ROOT/hub/scripts"
    "$PROJECT_ROOT/web/src"
    "$PROJECT_ROOT/website/src"
    "$PROJECT_ROOT/scripts"
)

# 白名单模式（grep -v 过滤）
WHITELIST_PATTERNS=(
    '@hapipower'
    'HAPI_POWER_'
    'hapiPower'
    'hapi_power'
    'hapi-power'
    'hapiHubUrl'
    'hapi_hub_url'
    'hapi-power.dev'
    'hapipower'
    'hapiPowerCliVersion'
    'hapiPowerHomeDir'
    'hapiPowerLibDir'
    'hapiPowerHubUrl'
    'hapi_power_'
    'node_modules'
)

echo "=== Hapi Power 品牌残留检查 ==="
echo ""

# 构建白名单 grep -v 参数
whitelist_args=()
for pattern in "${WHITELIST_PATTERNS[@]}"; do
    whitelist_args+=(-e "$pattern")
done

found_issues=0

# 检查 1: 独立的 \bHAPI\b（最关键）
echo "[检查 1] 扫描独立的 'HAPI' 品牌..."
hapi_results=$(
    grep -rn '\bHAPI\b' \
        --include='*.ts' --include='*.tsx' --include='*.json' \
        --include='*.md' --include='*.html' --include='*.css' \
        "${SCAN_DIRS[@]}" 2>/dev/null | \
    grep -v "${whitelist_args[@]}" | \
    grep -v 'dist/' || true
)

if [ -n "$hapi_results" ]; then
    echo -e "${RED}发现独立的 HAPI 品牌残留:${NC}"
    echo "$hapi_results"
    found_issues=$((found_issues + 1))
else
    echo -e "  ${GREEN}通过${NC} — 无独立 HAPI 残留"
fi
echo ""

# 检查 2: 旧域名 hapi.run
echo "[检查 2] 扫描旧域名 hapi.run..."
domain_results=$(
    grep -rn 'hapi\.run' \
        --include='*.ts' --include='*.tsx' --include='*.json' \
        --include='*.md' --include='*.html' \
        "${SCAN_DIRS[@]}" 2>/dev/null | \
    grep -v 'node_modules' | \
    grep -v 'dist/' || true
)

if [ -n "$domain_results" ]; then
    echo -e "${RED}发现旧域名 hapi.run 残留:${NC}"
    echo "$domain_results"
    found_issues=$((found_issues + 1))
else
    echo -e "  ${GREEN}通过${NC} — 无旧域名残留"
fi
echo ""

# 检查 3: 旧数据目录 ~/.hapi（不含 ~/.hapi-power）
echo "[检查 3] 扫描旧数据目录引用 ~/.hapi (非 ~/.hapi-power)..."
dir_results=$(
    grep -rn '~/.hapi' \
        --include='*.ts' --include='*.tsx' --include='*.json' \
        --include='*.md' --include='*.sh' \
        "${SCAN_DIRS[@]}" 2>/dev/null | \
    grep -v 'hapi-power' | \
    grep -v 'node_modules' | \
    grep -v 'dist/' || true
)

if [ -n "$dir_results" ]; then
    echo -e "${RED}发现旧目录 ~/.hapi 引用（非 ~/.hapi-power）:${NC}"
    echo "$dir_results"
    found_issues=$((found_issues + 1))
else
    echo -e "  ${GREEN}通过${NC} — 无旧目录引用"
fi
echo ""

# 检查 4: 旧环境变量前缀（独立的 HAPI_ 非 HAPI_POWER_）
echo "[检查 4] 扫描旧环境变量 HAPI_ (非 HAPI_POWER_)..."
env_results=$(
    grep -rn '\bHAPI_[A-Z]' \
        --include='*.ts' --include='*.tsx' --include='*.sh' \
        "${SCAN_DIRS[@]}" 2>/dev/null | \
    grep -v 'HAPI_POWER_' | \
    grep -v 'node_modules' | \
    grep -v 'dist/' || true
)

if [ -n "$env_results" ]; then
    echo -e "${RED}发现旧环境变量 HAPI_* (非 HAPI_POWER_*):${NC}"
    echo "$env_results"
    found_issues=$((found_issues + 1))
else
    echo -e "  ${GREEN}通过${NC} — 无旧环境变量"
fi
echo ""

# 检查 5 (--strict): 注释中的 HAPI
if [ "$STRICT" = "--strict" ]; then
    echo "[检查 5 - strict] 扫描注释中的 HAPI..."
    comment_results=$(
        grep -rn '//.*\bHAPI\b' \
            --include='*.ts' --include='*.tsx' \
            "${SCAN_DIRS[@]}" 2>/dev/null | \
        grep -v "${whitelist_args[@]}" | \
        grep -v 'node_modules' | \
        grep -v 'dist/' || true
    )

    if [ -n "$comment_results" ]; then
        echo -e "${YELLOW}注释中发现 HAPI 引用（建议更新）:${NC}"
        echo "$comment_results"
        # 注释不增加错误计数，但显示警告
    else
        echo -e "  ${GREEN}通过${NC} — 注释中无残留"
    fi
    echo ""
fi

# 检查 6: 旧 npm 包名 @hapi/（非 @hapipower/）
echo "[检查 5] 扫描旧包名 @hapi/ (非 @hapipower/)..."
pkg_results=$(
    grep -rn '@hapi/' \
        --include='*.ts' --include='*.tsx' --include='*.json' \
        "${SCAN_DIRS[@]}" 2>/dev/null | \
    grep -v '@hapipower/' | \
    grep -v 'node_modules' | \
    grep -v 'dist/' || true
)

if [ -n "$pkg_results" ]; then
    echo -e "${RED}发现旧包名 @hapi/ (非 @hapipower/):${NC}"
    echo "$pkg_results"
    found_issues=$((found_issues + 1))
else
    echo -e "  ${GREEN}通过${NC} — 无旧包名"
fi
echo ""

# 汇总
echo "================================"
if [ "$found_issues" -eq 0 ]; then
    echo -e "${GREEN}品牌检查全部通过!${NC}"
    exit 0
else
    echo -e "${RED}发现 ${found_issues} 类品牌残留问题，请立即修复!${NC}"
    echo ""
    echo "修复指南: 参见 .planning/research/BRAND-RESIDUE.md"
    echo "替换规则: 独立 HAPI → Hapi Power | hapi.run → github.com/zulinliu/make-hapi-power-again"
    exit 1
fi
