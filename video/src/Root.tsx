import React from "react";
import { Composition } from "remotion";
import { MarketingEvolution } from "./MarketingEvolution";
import { DURATION_SEC, FPS, HEIGHT, WIDTH, sec } from "./theme";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="MarketingEvolution"
    component={MarketingEvolution}
    durationInFrames={sec(DURATION_SEC)}
    fps={FPS}
    width={WIDTH}
    height={HEIGHT}
  />
);
