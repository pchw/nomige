"""BGM と効果音を合成して public/ に書き出す。

外部の音源を使わず numpy だけで作るので、ライセンスを気にせず使える。
120BPM（1拍 = 0.5秒 = 15フレーム）で、映像のカット割り（src/timeline.ts）と拍を合わせてある。
差し替えたい場合は public/bgm/bgm.wav を同じ長さ・120BPM のフリー素材で置き換える。
"""

import wave
from pathlib import Path

import numpy as np

SR = 44100
BPM = 120
BEAT = 60 / BPM
LENGTH = 15.0
ROOT = Path(__file__).resolve().parent.parent / "public"
rng = np.random.default_rng(7)


def t_axis(sec):
    return np.arange(int(SR * sec)) / SR


def env(n, attack=0.002, decay=0.2):
    t = np.arange(n) / SR
    a = np.clip(t / attack, 0, 1) if attack > 0 else 1
    return a * np.exp(-t / decay)


def lowpass(x, cutoff):
    """1次の IIR ローパス（numpy の累積で近似せず素直にループ）"""
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc = (1 - a) * v + a * acc
        y[i] = acc
    return y


def highpass(x, cutoff):
    return x - lowpass(x, cutoff)


def saw(freq, t, harmonics=10):
    """帯域制限したノコギリ波。freq は定数でも、ビブラート用の配列でもよい"""
    phase = 2 * np.pi * np.cumsum(freq) / SR if np.ndim(freq) else 2 * np.pi * freq * t
    top = np.max(freq)
    out = np.zeros_like(t)
    for k in range(1, harmonics + 1):
        if top * k > SR / 2:
            break
        out += np.sin(phase * k) / k
    return out * 0.6


def note(name):
    names = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}
    pitch, octave = name[:-1], int(name[-1])
    midi = 12 * (octave + 1) + names[pitch]
    return 440 * 2 ** ((midi - 69) / 12)


# ---------- 楽器 ----------


def kick(level=1.0):
    t = t_axis(0.35)
    freq = 45 + 110 * np.exp(-t / 0.03)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    click = rng.standard_normal(len(t)) * np.exp(-t / 0.003) * 0.3
    return (np.sin(phase) * env(len(t), 0.001, 0.12) + click) * level


def clap(level=0.6):
    t = t_axis(0.25)
    n = rng.standard_normal(len(t))
    bursts = sum(np.exp(-np.clip(t - d, 0, None) / 0.008) * (t >= d) for d in (0, 0.01, 0.02))
    tail = np.exp(-t / 0.08)
    return highpass(n * (bursts * 0.5 + tail), 900) * level


def snare(level=0.5, length=0.18):
    t = t_axis(length)
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.04)
    noise = highpass(rng.standard_normal(len(t)), 1500) * np.exp(-t / 0.06)
    return (body * 0.5 + noise) * level


def hat(level=0.18, open_=False):
    t = t_axis(0.25 if open_ else 0.06)
    n = highpass(rng.standard_normal(len(t)), 7000)
    return n * np.exp(-t / (0.08 if open_ else 0.015)) * level


def bass(freq, length, level=0.45):
    t = t_axis(length)
    tone = saw(freq, t, 6) + np.sin(2 * np.pi * freq / 2 * t) * 0.6
    return lowpass(tone, 900) * env(len(t), 0.003, length * 0.7) * level


def stab(freqs, length, level=0.16):
    t = t_axis(length)
    tone = sum(saw(f * d, t, 12) for f in freqs for d in (0.996, 1.004))
    return lowpass(tone, 3500) * env(len(t), 0.004, length * 0.5) * level


def pluck(freq, length=0.12, level=0.14):
    t = t_axis(length)
    tone = np.sign(np.sin(2 * np.pi * freq * t)) * 0.5 + saw(freq * 2, t, 6) * 0.5
    return lowpass(tone, 4000) * env(len(t), 0.001, 0.05) * level


def place(buf, sample, at, pan=0.0):
    i = int(at * SR)
    if i >= len(buf):
        return
    s = sample[: len(buf) - i]
    left = np.cos((pan + 1) * np.pi / 4)
    right = np.sin((pan + 1) * np.pi / 4)
    buf[i : i + len(s), 0] += s * left * 1.414
    buf[i : i + len(s), 1] += s * right * 1.414


# ---------- BGM ----------

# C - G - Am - F（1小節 = 2秒）
CHORDS = [
    ("C3", ["C4", "E4", "G4", "C5"]),
    ("G2", ["B3", "D4", "G4", "B4"]),
    ("A2", ["C4", "E4", "A4", "C5"]),
    ("F2", ["C4", "F4", "A4", "C5"]),
]
ARP = [0, 1, 2, 3, 2, 1, 2, 3]


def bgm():
    buf = np.zeros((int(SR * (LENGTH + 0.6)), 2))
    beats = int(LENGTH / BEAT)

    def section(beat):
        sec = beat * BEAT
        if sec < 2.0:
            return "hook"
        if 9.5 <= sec < 10.5:
            return "roll"
        if sec >= 13.5:
            return "end"
        return "full"

    for b in range(beats):
        at = b * BEAT
        sec = section(b)
        root, chord = CHORDS[(b // 4) % 4]
        if sec == "hook":
            # 「ドン・ドン・ドン・ドドン」で掴む
            place(buf, kick(1.0), at)
            place(buf, clap(0.5), at)
            if b == 3:
                place(buf, kick(0.9), at + BEAT / 2)
            continue
        if sec == "roll":
            continue
        if sec == "end":
            if b == 27:
                place(buf, kick(1.0), at)
                place(buf, clap(0.6), at)
                place(buf, stab([note(n) for n in chord] + [note(root) * 2], 1.6, 0.2), at)
                place(buf, bass(note(root), 1.4, 0.5), at)
            continue
        place(buf, kick(), at)
        if b % 2 == 1:
            place(buf, clap(), at)
        place(buf, hat(0.22, open_=True), at + BEAT / 2, 0.3)
        for k in (0.25, 0.75):
            place(buf, hat(), at + BEAT * k, -0.3)
        place(buf, bass(note(root), BEAT / 2 * 0.9), at + BEAT / 2)
        place(buf, bass(note(root) * 2, BEAT / 4 * 0.9, 0.3), at + BEAT * 0.75)
        place(buf, stab([note(n) for n in chord], BEAT / 2 * 0.8), at + BEAT / 2, 0.1)
        for k in range(4):
            idx = ARP[(b * 4 + k) % len(ARP)]
            place(buf, pluck(note(chord[idx]) * 2), at + BEAT * k / 4, (-0.4, 0.4)[k % 2])

    # 9.5〜10.5秒：だんだん速くなるドラムロール → 10.5秒で再ドロップ
    t = 9.5
    gap = 0.09
    while t < 10.45:
        place(buf, snare(0.5 + (t - 9.5) * 0.6, 0.1), t, rng.uniform(-0.3, 0.3))
        t += gap
        gap = max(0.03, gap * 0.9)
    # 盛り上げの白いノイズのライザー（1.5〜2.0 秒、9.0〜9.5 秒）
    for start in (1.5, 9.0):
        tt = t_axis(0.5)
        riser = highpass(rng.standard_normal(len(tt)), 2000) * (tt / 0.5) ** 2 * 0.25
        place(buf, riser, start)
    return buf


# ---------- 効果音 ----------


def se_boom():
    t = t_axis(0.8)
    freq = 35 + 140 * np.exp(-t / 0.05)
    tone = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t / 0.3)
    noise = lowpass(rng.standard_normal(len(t)), 400) * np.exp(-t / 0.15) * 2
    return tone + noise


def se_thud():
    t = t_axis(0.3)
    freq = 60 + 120 * np.exp(-t / 0.02)
    return np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t / 0.08)


def se_pop():
    t = t_axis(0.15)
    freq = 1400 * np.exp(-t / 0.03) + 300
    return np.sin(2 * np.pi * np.cumsum(freq) / SR) * env(len(t), 0.001, 0.04) * 0.8


def se_tick():
    t = t_axis(0.06)
    freq = 2400 + 400 * rng.uniform()
    return np.sin(2 * np.pi * freq * t) * env(len(t), 0.0005, 0.015) * 0.6


def se_whoosh():
    t = t_axis(0.25)
    n = rng.standard_normal(len(t))
    shape = np.sin(np.pi * t / 0.25) ** 2
    return highpass(lowpass(n, 5000), 800) * shape * 0.7


def se_flip():
    t = t_axis(0.12)
    n = highpass(rng.standard_normal(len(t)), 2500)
    return n * env(len(t), 0.002, 0.03) * 0.8


def se_clink():
    """ジョッキがぶつかる「カチーン」"""
    t = t_axis(1.0)
    out = np.zeros_like(t)
    for f, d in ((2350, 0.35), (3120, 0.25), (4870, 0.2), (6230, 0.12)):
        out += np.sin(2 * np.pi * f * t) * np.exp(-t / d)
    hit = clap(0.25)
    out[: len(hit)] += hit
    return out * 0.25


def se_explosion():
    t = t_axis(1.0)
    n = lowpass(rng.standard_normal(len(t)), 700) * np.exp(-t / 0.3) * 3
    boom = se_boom()
    n[: len(boom)] += boom * 0.6
    return n


def se_hit():
    """ルーレットが止まった「ジャン！」"""
    t = t_axis(0.9)
    chord = sum(saw(note(n), t, 10) for n in ("C4", "E4", "G4", "C5"))
    return lowpass(chord, 3000) * env(len(t), 0.003, 0.35) * 0.35 + np.pad(kick(0.9), (0, len(t) - len(kick())))


def se_cheer():
    """歓声の代わりに、クラップの連打＋パーティーホーン"""
    out = np.zeros(int(SR * 1.2))
    for k in range(18):
        s = clap(rng.uniform(0.2, 0.4))
        i = int(rng.uniform(0, 0.8) * SR)
        out[i : i + len(s)] += s[: len(out) - i]
    t = t_axis(0.6)
    horn = saw(note("A4") * (1 + 0.02 * np.sin(2 * np.pi * 7 * t)), t, 8)
    horn = lowpass(horn, 2500) * np.clip(t / 0.03, 0, 1) * np.clip((0.6 - t) / 0.1, 0, 1) * 0.35
    out[: len(horn)] += horn
    return out


def se_chime():
    out = np.zeros(int(SR * 1.4))
    for k, n in enumerate(("C5", "E5", "G5", "C6")):
        t = t_axis(1.0)
        s = (np.sin(2 * np.pi * note(n) * t) + 0.3 * np.sin(4 * np.pi * note(n) * t)) * env(len(t), 0.002, 0.35) * 0.35
        i = int(k * 0.08 * SR)
        out[i : i + len(s)] += s[: len(out) - i]
    return out


SES = {
    "boom": se_boom,
    "thud": se_thud,
    "pop": se_pop,
    "tick": se_tick,
    "whoosh": se_whoosh,
    "flip": se_flip,
    "clink": se_clink,
    "explosion": se_explosion,
    "hit": se_hit,
    "cheer": se_cheer,
    "chime": se_chime,
}


def write(path: Path, data: np.ndarray, peak=0.89):
    if data.ndim == 1:
        data = np.stack([data, data], axis=1)
    data = data / max(1e-9, np.max(np.abs(data))) * peak
    # 頭と最後のプチノイズを防ぐフェード
    fade = int(SR * 0.005)
    data[-fade:] *= np.linspace(1, 0, fade)[:, None]
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((data * 32767).astype("<i2").tobytes())
    print(f"wrote {path.relative_to(ROOT.parent)}")


if __name__ == "__main__":
    write(ROOT / "bgm" / "bgm.wav", bgm())
    for name, fn in SES.items():
        write(ROOT / "se" / f"{name}.wav", fn())
