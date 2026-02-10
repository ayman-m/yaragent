#!/bin/sh
set -e

KEY_FILE="/tmp/nginx_key.pem"
CERT_FILE="/tmp/nginx_cert.pem"

if [ -z "${NGINX_CERT_PRIV:-}" ]; then
  echo "ERROR: NGINX_CERT_PRIV is required. Refusing to start nginx without TLS." >&2
  exit 1
fi

printf '%b' "$NGINX_CERT_PRIV" > "$KEY_FILE"
chmod 600 "$KEY_FILE"

if [ -n "${NGINX_CERT_PUB:-}" ] && echo "$NGINX_CERT_PUB" | grep -q "BEGIN CERTIFICATE"; then
  printf '%b' "$NGINX_CERT_PUB" > "$CERT_FILE"
else
  openssl req -new -x509 -key "$KEY_FILE" -out "$CERT_FILE" -days 365 -subj "/CN=localhost" >/dev/null 2>&1
fi

export NGINX_CERT_FILE="$CERT_FILE"
export NGINX_KEY_FILE="$KEY_FILE"
export SERVER_NAME="${SERVER_NAME:-localhost}"
export UI_UPSTREAM="${UI_UPSTREAM:-ui:3000}"
export API_UPSTREAM="${API_UPSTREAM:-orchestrator:8002}"
export MCP_UPSTREAM="${MCP_UPSTREAM:-mcp-server:8001}"
export API_TIMEOUT_SECONDS="${API_TIMEOUT_SECONDS:-60}"

envsubst '${NGINX_CERT_FILE} ${NGINX_KEY_FILE} ${SERVER_NAME} ${UI_UPSTREAM} ${API_UPSTREAM} ${MCP_UPSTREAM} ${API_TIMEOUT_SECONDS}' \
  < /opt/nginx/templates/nginx.conf.template > /etc/nginx/nginx.conf

envsubst '${SERVER_NAME} ${UI_UPSTREAM} ${API_UPSTREAM} ${MCP_UPSTREAM} ${API_TIMEOUT_SECONDS}' \
  < /opt/nginx/templates/conf.d/yaragent.conf.template > /etc/nginx/conf.d/yaragent.conf

exec "$@"
