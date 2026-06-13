"use client";

import { memo } from "react";
import { Panel, Slider } from "./ui-blocks";
import { useProjectWorkspace } from "../context/project-workspace-context";

const MOOD_SLIDERS = [
  ["Darkness", "bright", "dark", "darkness"],
  ["Energy", "calm", "extreme", "energy"],
  ["Aggression", "soft", "brutal", "aggression"],
  ["Emotion", "cold", "emotional", "emotion"],
  ["Complexity", "minimal", "complex", "complexity"],
  ["Space", "dry", "wide", "space"],
];

export const CenterMoodPanel = memo(function CenterMoodPanel() {
  const ws = useProjectWorkspace();

  return (
    <Panel title="Step 2 — Mood Sliders" hint="Shape the feeling without typing.">
      <div className="grid gap-3 md:grid-cols-3">
        {MOOD_SLIDERS.map(([label, left, right, key]) => (
          <Slider
            key={key}
            label={label}
            value={ws.mood[key]}
            left={left}
            right={right}
            setValue={(v) => ws.setMood({ ...ws.mood, [key]: v })}
          />
        ))}
      </div>
    </Panel>
  );
});
