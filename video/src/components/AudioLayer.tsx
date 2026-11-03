import React from "react";
import { Audio, interpolate, Sequence, staticFile } from "remotion";
import { AUDIO } from "../config";
import { CONTENT } from "../content";
import { DURATION_SEC, SCENES, sec } from "../theme";
import { VO } from "../vo";

type Cue = { at: number; file: keyof typeof AUDIO.files; gain?: number };

/** Semua cue SFX dalam detik absolut. */
const SFX_CUES: Cue[] = [
  // whoosh menjelang tiap pergantian scene
  ...[SCENES.m1, SCENES.m2, SCENES.m3, SCENES.m4, SCENES.cta].map((s) => ({
    at: s.start - 0.35,
    file: "whoosh" as const,
  })),
  // tick saat node 5A muncul
  ...CONTENT.m4.pathTimes.map((t) => ({ at: SCENES.m4.start + t, file: "tick" as const, gain: 0.7 })),
  // tick saat recap terisi
  ...CONTENT.cta.recapTimes.map((t) => ({ at: SCENES.cta.start + t, file: "tick" as const, gain: 0.6 })),
  // naik halus saat logo muncul
  { at: SCENES.cta.start + 4.6, file: "rise", gain: 0.8 },
];

export const AudioLayer: React.FC = () => {
  const total = sec(DURATION_SEC);
  return (
    <>
      <Audio
        src={staticFile(AUDIO.files.music)}
        volume={(f) =>
          AUDIO.master *
          AUDIO.music *
          interpolate(
            f,
            [0, sec(AUDIO.musicFadeIn), total - sec(AUDIO.musicFadeOut), total],
            [0, 1, 1, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          )
        }
      />
      {SFX_CUES.map((c, i) => (
        <Sequence key={`sfx-${i}`} from={sec(c.at)} durationInFrames={sec(1.5)} layout="none">
          <Audio src={staticFile(AUDIO.files[c.file])} volume={AUDIO.master * AUDIO.sfx * (c.gain ?? 1)} />
        </Sequence>
      ))}
      {AUDIO.voEnabled &&
        VO.map((v) => (
          <Sequence key={`vo-${v.id}`} from={sec(v.fileStart)} layout="none">
            <Audio src={staticFile(v.file)} volume={AUDIO.master * AUDIO.vo} />
          </Sequence>
        ))}
    </>
  );
};
