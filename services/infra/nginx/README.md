# YARAgent Nginx Runtime

This service is runtime-only. It does not render templates or generate certs.

Nginx reads ready-to-use files from a shared volume populated by the one-shot
`init` service (`services/platform/bootstrap`).
