FROM node:22-bookworm-slim

# Remotion が使う Chrome Headless Shell の依存ライブラリ
# + 絵文字・日本語のフォールバックフォント、後処理用の ffmpeg、音源生成・コンタクトシート用の Python
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev libasound2 libxrandr2 libxkbcommon-dev \
    libxfixes3 libxcomposite1 libxdamage1 libatk-bridge2.0-0 libpango-1.0-0 libcairo2 libcups2 \
    fonts-noto-color-emoji fonts-noto-cjk \
    ffmpeg python3 python3-numpy python3-pil \
  && rm -rf /var/lib/apt/lists/*
