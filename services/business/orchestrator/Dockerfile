FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
COPY services/business/orchestrator/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY services/business/orchestrator/src/ ./src
WORKDIR /app/src
EXPOSE 8002
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002"]
