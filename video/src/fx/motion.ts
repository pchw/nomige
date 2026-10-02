import { Easing, interpolate, random, spring } from "remotion";
import { FPS } from "../theme";

/** 拡大から叩きつけるように着地する（0→1 を返す。1 を超えて少し跳ねる） */
export function pop(frame: number, delay = 0, damping = 10) {
  return spring({ frame: frame - delay, fps: FPS, config: { damping, stiffness: 220, mass: 0.6 } });
}

/** 0→1 を指定フレームで（範囲外はクランプ） */
export function ramp(frame: number, start: number, end: number, ease = Easing.out(Easing.cubic)) {
  return interpolate(frame, [start, end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
}

/** at フレームから len フレームだけ減衰しながら揺れる。毎回同じ揺れになるよう seed 固定 */
export function shakeOffset(frame: number, at: number, amp = 28, len = 8, seed = "s") {
  const t = frame - at;
  if (t < 0 || t >= len) return { x: 0, y: 0, r: 0 };
  const k = amp * (1 - t / len);
  return {
    x: (random(`${seed}x${t}`) - 0.5) * 2 * k,
    y: (random(`${seed}y${t}`) - 0.5) * 2 * k,
    r: (random(`${seed}r${t}`) - 0.5) * k * 0.08,
  };
}
