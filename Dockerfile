# ┌─────────────────────────────────────────────────────────────────────────────┐
# │  ServerCraft Linux Edition — Docker Image                                   │
# │  Multi-stage: Node.js builds React frontend → Python runtime serves it     │
# │  Base: Ubuntu 22.04 LTS (compatible with 22.04 and 24.04 hosts)            │
# └─────────────────────────────────────────────────────────────────────────────┘

# ── Stage 1: Build React frontend ─────────────────────────────────────────────
FROM node:20-slim AS frontend-builder

WORKDIR /app

COPY frontend/package.json ./
RUN yarn install --silent

COPY frontend/ ./
ENV NODE_OPTIONS="--max-old-space-size=2048"
RUN yarn build

# ── Stage 2: Python runtime ───────────────────────────────────────────────────
FROM ubuntu:22.04

LABEL maintainer="TierOne Development"
LABEL description="ServerCraft Linux Edition — Game Server Management Panel"
LABEL version="2026.3.0-BETA"

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    SERVERCRAFT_PORT=8080

# System dependencies + Python 3.11
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3.11 \
        python3.11-venv \
        python3.11-dev \
        python3-pip \
        lib32gcc-s1 \
        libssl3 \
        ca-certificates \
        wget \
        curl \
        tar \
    && rm -rf /var/lib/apt/lists/*

# Create dedicated user
RUN useradd -r -s /bin/bash -d /opt/servercraft -m servercraft

# Create virtual environment (as root, then hand to user)
RUN python3.11 -m venv /opt/servercraft/venv

WORKDIR /opt/servercraft

# Install Python dependencies (cached layer — only rebuilds when requirements change)
COPY backend/requirements.txt ./requirements.txt
RUN /opt/servercraft/venv/bin/pip install --upgrade pip wheel setuptools --quiet \
    && /opt/servercraft/venv/bin/pip install -r requirements.txt --quiet \
    && rm requirements.txt

# Copy backend source
COPY backend/ ./backend/

# Inject built frontend into backend/static/ (FastAPI serves it from there)
COPY --from=frontend-builder /app/build ./backend/static/

# Create writable data directories
RUN mkdir -p \
        ./backend/data \
        ./servers \
        ./mods \
        ./logs \
        ./steamcmd \
    && chown -R servercraft:servercraft /opt/servercraft

USER servercraft
WORKDIR /opt/servercraft/backend

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
    CMD wget -qO- "http://localhost:${SERVERCRAFT_PORT}/api/health" || exit 1

ENTRYPOINT ["/opt/servercraft/venv/bin/uvicorn", \
            "server:app", \
            "--host", "0.0.0.0", \
            "--port", "8080", \
            "--log-level", "info"]
