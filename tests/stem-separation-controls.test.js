/** @vitest-environment happy-dom */
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AudioTrackEditor } from "../app/components/audio-track-editor";

afterEach(cleanup);
const analysis = { fileName: "song.wav", duration: 30, chordProgression: [], instruments: [], genres: [], moods: [] };

it("recommends clean vocals once the backend is ready and preserves an explicit four-stem choice", () => {
  const separate = vi.fn();
  const props = { analysis, onSeparateStems: separate };
  const view = render(React.createElement(AudioTrackEditor, props));
  expect(screen.getByRole("combobox", { name: "Stem separation model" }).value).toBe("htdemucs");
  view.rerender(React.createElement(AudioTrackEditor, { ...props, sidecarStemsMelbandAvailable: true }));
  expect(screen.getByRole("combobox", { name: "Stem separation model" }).value).toBe("melband-clean");
  fireEvent.click(screen.getByRole("button", { name: "Separate clean vocals" }));
  expect(separate).toHaveBeenCalledWith("melband-clean");
  fireEvent.change(screen.getByRole("combobox", { name: "Stem separation model" }), { target: { value: "htdemucs" } });
  view.rerender(React.createElement(AudioTrackEditor, { ...props, sidecarStemsMelbandAvailable: false }));
  view.rerender(React.createElement(AudioTrackEditor, { ...props, sidecarStemsMelbandAvailable: true }));
  expect(screen.getByRole("combobox", { name: "Stem separation model" }).value).toBe("htdemucs");
  fireEvent.click(screen.getByRole("button", { name: "Separate stems (Demucs)" }));
  expect(separate).toHaveBeenLastCalledWith("htdemucs");
});
