FROM python:3.11-slim
WORKDIR /app/bootstrap
RUN pip install --no-cache-dir "psycopg[binary]==3.2.1"
COPY services/platform/bootstrap/scripts/ ./scripts/
COPY services/platform/bootstrap/nginx/templates/ ./nginx/templates/
COPY services/platform/bootstrap/observability/templates/ ./observability/templates/
COPY services/platform/bootstrap/keycloak/templates/ ./keycloak/templates/
CMD ["python", "/app/bootstrap/scripts/init_data.py"]
