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

# 1. 先用 HTTP-only 模式启动 Nginx 用于 ACME 验证
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

# 创建共享 volume（如不存在）
docker volume create certbot-webroot 2>/dev/null || true
docker volume create certbot-etc 2>/dev/null || true
docker volume create certbot-var 2>/dev/null || true

docker run -d --rm \
  --name fluximage-nginx-temp \
  -p 80:80 \
  -v "$TEMP_CONF:/etc/nginx/nginx.conf:ro" \
  -v certbot-webroot:/var/www/certbot \
  nginx:alpine

# 等待 Nginx 启动
sleep 3

# 3. 申请证书（一次性，不常驻）
echo "🔐 申请 Let's Encrypt 证书..."
docker run --rm \
  -v certbot-etc:/etc/letsencrypt \
  -v certbot-var:/var/lib/letsencrypt \
  -v certbot-webroot:/var/www/certbot \
  certbot/certbot certonly \
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
