#!/bin/sh
# レンダリング後の仕上げ：音量を SNS の基準（-14 LUFS）に揃え、プレビュー用 GIF を作る
set -eu
cd "$(dirname "$0")/.."

for name in promo-9x16 promo-1x1 promo-16x9; do
  src="out/$name.mp4"
  [ -f "$src" ] || continue
  ffmpeg -y -loglevel error -i "$src" \
    -c:v copy -af loudnorm=I=-14:TP=-1.5:LRA=11 -ar 48000 -c:a aac -b:a 192k \
    -movflags +faststart "out/$name.final.mp4"
  echo "wrote out/$name.final.mp4"
done

# README や PR に貼る用の軽い GIF（縦 480px・15fps）
ffmpeg -y -loglevel error -i out/promo-9x16.mp4 \
  -vf "fps=15,scale=-2:480:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer" \
  out/promo-preview.gif
echo "wrote out/promo-preview.gif"
