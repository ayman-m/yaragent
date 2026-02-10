#!/bin/sh
set -e

KEY_FILE="/tmp/ui_key.pem"
CERT_FILE="/tmp/ui_cert.pem"

if [ -z "${UI_CERT_PRIV:-}" ]; then
  echo "ERROR: UI_CERT_PRIV is required. Refusing to start UI without TLS." >&2
  exit 1
fi

printf '%b' "$UI_CERT_PRIV" > "$KEY_FILE"
chmod 600 "$KEY_FILE"

if [ -n "${UI_CERT_PUB:-}" ] && echo "$UI_CERT_PUB" | grep -q "BEGIN CERTIFICATE"; then
  printf '%b' "$UI_CERT_PUB" > "$CERT_FILE"
else
  openssl req -new -x509 -key "$KEY_FILE" -out "$CERT_FILE" -days 365 -subj "/CN=ui" >/dev/null 2>&1
fi

export UI_SSL_KEY_FILE="$KEY_FILE"
export UI_SSL_CERT_FILE="$CERT_FILE"

exec "$@"
