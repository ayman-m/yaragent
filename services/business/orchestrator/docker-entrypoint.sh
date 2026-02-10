#!/bin/sh
set -e

KEY_FILE="/tmp/orchestrator_key.pem"
CERT_FILE="/tmp/orchestrator_cert.pem"

if [ -z "${ORCH_CERT_PRIV:-}" ]; then
  echo "ERROR: ORCH_CERT_PRIV is required. Refusing to start orchestrator without TLS." >&2
  exit 1
fi

printf '%b' "$ORCH_CERT_PRIV" > "$KEY_FILE"
chmod 600 "$KEY_FILE"

if [ -n "${ORCH_CERT_PUB:-}" ] && echo "$ORCH_CERT_PUB" | grep -q "BEGIN CERTIFICATE"; then
  printf '%b' "$ORCH_CERT_PUB" > "$CERT_FILE"
else
  openssl req -new -x509 -key "$KEY_FILE" -out "$CERT_FILE" -days 365 -subj "/CN=orchestrator" >/dev/null 2>&1
fi

if [ "$1" = "python" ] && [ "$2" = "-m" ] && [ "$3" = "uvicorn" ]; then
  set -- "$@" --ssl-keyfile "$KEY_FILE" --ssl-certfile "$CERT_FILE"
fi

exec "$@"
