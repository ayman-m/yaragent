FROM python:3.11-slim
WORKDIR /app
COPY services/platform/mcp-server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY services/platform/mcp-server/src/ ./src
WORKDIR /app/src
EXPOSE 8001
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
