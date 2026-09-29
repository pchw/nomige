FROM node:22-bookworm-slim

# wrangler login の OAuth コールバック（localhost:8976）をコンテナ内から叩くために curl を入れる
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
