import type { CSSProperties } from "react";
import { loadFont as loadDela } from "@remotion/google-fonts/DelaGothicOne";
import { loadFont as loadRounded } from "@remotion/google-fonts/MPLUSRounded1c";
import { loadFont as loadZen } from "@remotion/google-fonts/ZenKakuGothicNew";

// 見出しの英数字はアプリと同じ Dela Gothic One。
// Dela の漢字は画数が多いと潰れて読めない（会・負など）ので、Dela は英字だけ読み込み、
// 日本語は M PLUS Rounded 1c にフォールバックさせる。
const DELA = loadDela("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily;
const ROUNDED = loadRounded("normal", { weights: ["900"], ignoreTooManyRequestsWarning: true })
  .fontFamily;
const BODY = loadZen("normal", { weights: ["700"], ignoreTooManyRequestsWarning: true }).fontFamily;

/**
 * 動画のルートに付けるスタイル。app.css の --font-display を差し替えるので、
 * アプリの部品（トランプ・カードなど）にも同じフォントが効く。
 * 太さのないフォントを疑似ボールドにすると潰れるので font-synthesis は切る。
 */
export const ROOT_STYLE = {
  "--font-display": `"${DELA}", "${ROUNDED}", sans-serif`,
  "--font-body": `"${BODY}", sans-serif`,
  fontFamily: "var(--font-body)",
  fontWeight: 900,
  fontSynthesis: "none",
} as CSSProperties;

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

/** app.css の :root と同じ値（CSS 変数が使えない計算用） */
export const C = {
  ink: "#111111",
  paper: "#fff8e7",
  white: "#ffffff",
  yellow: "#ffe14d",
  pink: "#ff7eb6",
  blue: "#5ecbff",
  green: "#8cf28c",
  orange: "#ff9f43",
  purple: "#b69cff",
  red: "#ff4d4d",
  amber: "#ffc24a",
  teal: "#4fd1c5",
  coral: "#ff8a80",
  lime: "#c6f24a",
  sky: "#a8e6ff",
  mint: "#8ff0d0",
} as const;

/** ネオブルータリズムの太線とずらした影（動画サイズ用に太く） */
export const LINE = `8px solid ${C.ink}`;
export const shadow = (n = 14) => `${n}px ${n}px 0 ${C.ink}`;
