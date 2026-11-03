import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { AudioLayer } from "./components/AudioLayer";
import { Subtitles } from "./components/Subtitles";
import { COLORS, SCENES, SceneKey, sec } from "./theme";
import { Scene0Hook } from "./scenes/Scene0Hook";
import { Scene1Product } from "./scenes/Scene1Product";
import { Scene2Customer } from "./scenes/Scene2Customer";
import { Scene3Values } from "./scenes/Scene3Values";
import { Scene4Digital } from "./scenes/Scene4Digital";
import { Scene5Cta } from "./scenes/Scene5Cta";

const SCENE_COMPONENTS: Record<SceneKey, React.FC> = {
  hook: Scene0Hook,
  m1: Scene1Product,
  m2: Scene2Customer,
  m3: Scene3Values,
  m4: Scene4Digital,
  cta: Scene5Cta,
};

export const MarketingEvolution: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
    {(Object.keys(SCENES) as SceneKey[]).map((key) => {
      const Scene = SCENE_COMPONENTS[key];
      return (
        <Sequence
          key={key}
          name={key}
          from={sec(SCENES[key].start)}
          durationInFrames={sec(SCENES[key].duration)}
        >
          <Scene />
        </Sequence>
      );
    })}
    <Subtitles />
    <AudioLayer />
  </AbsoluteFill>
);
