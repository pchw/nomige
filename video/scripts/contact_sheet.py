"""動画からフレームを等間隔に抜き出し、1枚のコンタクトシートにする（テンポの確認用）。

使い方: python3 scripts/contact_sheet.py <video> <out.png> [間隔フレーム=5] [列数=10]
各コマの左上に全体のフレーム番号を入れる。
"""

import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

FPS = 30


def main():
    video, out = sys.argv[1], Path(sys.argv[2])
    step = int(sys.argv[3]) if len(sys.argv) > 3 else 5
    cols = int(sys.argv[4]) if len(sys.argv) > 4 else 10
    thumb_w = 216
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(
            [
                "ffmpeg", "-loglevel", "error", "-i", video,
                "-vf", f"select='not(mod(n\\,{step}))',scale={thumb_w}:-2",
                "-vsync", "vfr", f"{tmp}/%04d.png",
            ],
            check=True,
        )
        frames = sorted(Path(tmp).glob("*.png"))
        thumbs = [Image.open(f).convert("RGB") for f in frames]
    w, h = thumbs[0].size
    rows = (len(thumbs) + cols - 1) // cols
    pad = 6
    sheet = Image.new("RGB", (cols * (w + pad) + pad, rows * (h + pad) + pad), "#111111")
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("DejaVuSans-Bold.ttf", 18)
    except OSError:
        font = ImageFont.load_default()
    for i, im in enumerate(thumbs):
        x = pad + (i % cols) * (w + pad)
        y = pad + (i // cols) * (h + pad)
        sheet.paste(im, (x, y))
        label = f"{i * step}f {i * step / FPS:.1f}s"
        draw.rectangle([x, y, x + 120, y + 24], fill="#111111")
        draw.text((x + 4, y + 2), label, fill="#ffe14d", font=font)
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out)
    print(f"wrote {out} ({len(thumbs)} frames)")


if __name__ == "__main__":
    main()
