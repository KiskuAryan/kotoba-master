# -----------------------------------------------------------
# STAGE 1: Build React + Tailwind Frontend (Vite)
# -----------------------------------------------------------
FROM node:20-alpine AS frontend-builder

WORKDIR /build/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# -----------------------------------------------------------
# STAGE 2: Python FastAPI Production Runtime
# -----------------------------------------------------------
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app/backend

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY backend/requirements.txt /app/backend/
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy backend code
COPY backend /app/backend

# Copy built frontend dist from Stage 1
COPY --from=frontend-builder /build/frontend/dist /app/frontend/dist
COPY frontend/legacy /app/frontend/legacy

# Pre-seed SQLite database for out-of-the-box local usage
RUN python /app/backend/app/seed_themed.py

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
