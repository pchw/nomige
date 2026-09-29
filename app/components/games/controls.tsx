import type { PointerEvent } from "react";

/** スライダー＋微調整の −／＋（酔っていても細かく合わせられるように） */
export function FineSlider({
  label,
  value,
  min,
  max,
  step,
  format = (v) => `${v}`,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const set = (v: number) => {
    const snapped = Math.round(v / step) * step;
    onChange(Math.min(max, Math.max(min, Number(snapped.toFixed(4)))));
  };
  return (
    <div className="fine-slider">
      <span className="fine-slider-label">
        {label} <b>{format(value)}</b>
      </span>
      <button
        type="button"
        className="btn btn-sq btn-sm"
        onClick={() => set(value - step)}
        aria-label={`${label}を小さく`}
      >
        −
      </button>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => set(Number(e.target.value))}
        aria-label={label}
      />
      <button
        type="button"
        className="btn btn-sq btn-sm"
        onClick={() => set(value + step)}
        aria-label={`${label}を大きく`}
      >
        ＋
      </button>
    </div>
  );
}

/** SVG 上をタップした位置を viewBox の座標で返す */
export function svgPoint(e: PointerEvent<SVGSVGElement>): { x: number; y: number } | null {
  const svg = e.currentTarget;
  const m = svg.getScreenCTM();
  if (!m) return null;
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
  return { x: p.x, y: p.y };
}
