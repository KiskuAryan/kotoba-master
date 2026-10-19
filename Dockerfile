# Multi-stage lightweight Dockerfile for KotobaMaster
FROM python:3.11-slim as builder

WORKDIR /build
COPY backend/requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Final Runtime Image
FROM python:3.11-slim

WORKDIR /app

# Copy installed python dependencies from builder
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH
ENV PYTHONPATH=/app/backend
ENV PYTHONUNBUFFERED=1

# Copy Application Code and Frontend Assets
COPY backend/ /app/backend/
COPY frontend/ /app/frontend/

# Expose standard web port
EXPOSE 8000

# Run Uvicorn ASGI Server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
