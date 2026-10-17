import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill } from "remotion";
import { Avatar } from "~/components/ui";
import type { CharacterId } from "~/games/characters";

/** 縦に並べて中央寄せ */
export function Column({
  children,
  gap = 60,
  style,
}: {
  children: ReactNode;
  gap?: number;
  style?: CSSProperties;
}) {
  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap,
        ...style,
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

/**
 * アプリの部品をそのまま拡大して使う。
 * transform: scale だとにじむので、レイアウトごと拡大される CSS zoom を使う。
 */
export function Zoom({
  z,
  children,
  style,
}: {
  z: number;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return <div style={{ zoom: z, display: "inline-flex", ...style }}>{children}</div>;
}

/** アプリのアバター（avatar-lg は 72px）を px 指定で描く */
export function Face({
  character,
  size = 220,
  style,
}: {
  character: CharacterId;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <Zoom z={size / 72} style={style}>
      <Avatar character={character} size="lg" />
    </Zoom>
  );
}

/** 絶対配置（左上基準ではなく中心基準） */
export function At({
  x,
  y,
  children,
  style,
}: {
  x: number;
  y: number;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: "translate(-50%, -50%)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
