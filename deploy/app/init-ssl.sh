#!/bin/bash
set -euo pipefail

# ============================================
# FluxImage SSL 初始化脚本
# 用法: ./init-ssl.sh your-domain.com your-email@example.com
# ============================================

DOMAIN="${1:?用法: $0 <域名> <邮箱>}"
EMAIL="${2:?用法: $0 <域名> <邮箱>}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🔧 域名: $DOMAIN"
echo "🔧 邮箱: $EMAIL"

# 1. 替换 nginx.conf 中的域名占位符
if grep -q '${DOMAIN}' "$SCRIPT_DIR/nginx.conf"; then
  sed -i "s/\${DOMAIN}/$DOMAIN/g" "$SCRIPT_DIR/nginx.conf"
  echo "✅ nginx.conf 域名已替换为 $DOMAIN"
else
  echo "ℹ️  nginx.conf 中未发现占位符，跳过替换"
fi

# 2. 先用 HTTP-only 模式启动 Nginx（注释掉 SSL 配置）
echo "🔄 临时启动 Nginx（仅 HTTP）用于 ACME 验证..."
TEMP_CONF="$SCRIPT_DIR/nginx-temp.conf"
cat > "$TEMP_CONF" <<'EOF'
worker_processes auto;
events { worker_connections 1024; }
http {
    server {
        listen 80;
        server_name _;
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
        location / {
            return 200 'SSL initializing...';
            add_header Content-Type text/plain;
        }
    }
}
EOF

docker compose -f "$SCRIPT_DIR/docker-compose.yml" run -d --rm \
  --name fluximage-nginx-temp \
  -p 80:80 \
  -v "$TEMP_CONF:/etc/nginx/nginx.conf:ro" \
  -v fluximage-certbot-webroot:/var/www/certbot \
  nginx nginx -g 'daemon off;' 2>/dev/null || true

# 等待 Nginx 启动
sleep 3

# 3. 申请证书
echo "🔐 申请 Let's Encrypt 证书..."
docker compose -f "$SCRIPT_DIR/docker-compose.yml" run --rm certbot \
  certbot certonly \
    --webroot \
    -w /var/www/certbot \
    -d "$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    --force-renewal

# 4. 停止临时 Nginx
echo "🔄 停止临时 Nginx..."
docker stop fluximage-nginx-temp 2>/dev/null || true
rm -f "$TEMP_CONF"

# 5. 用完整配置启动所有服务
echo "🚀 使用完整配置启动所有服务..."
docker compose -f "$SCRIPT_DIR/docker-compose.yml" up -d

echo ""
echo "✅ 完成！你的站点已经可以通过 https://$DOMAIN 访问了"
