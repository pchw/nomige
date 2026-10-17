import { Composition } from "remotion";
import { Framed } from "./Framed";
import { Promo } from "./Promo";
import { FPS, HEIGHT, WIDTH } from "./theme";
import { TOTAL } from "./timeline";

export function Root() {
  return (
    <>
      <Composition id="Promo" component={Promo} durationInFrames={TOTAL} fps={FPS} width={WIDTH} height={HEIGHT} />
      <Composition id="PromoSquare" component={Framed} durationInFrames={TOTAL} fps={FPS} width={1080} height={1080} />
      <Composition id="PromoWide" component={Framed} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} />
    </>
  );
}
