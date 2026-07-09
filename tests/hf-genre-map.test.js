import { describe, it, expect } from "vitest";
import { mapHfGenrePredictionsToSuno, HF_DISTILHUBERT_GENRE_MODEL_ID } from "../app/lib/hf-genre-map.js";

describe("mapHfGenrePredictionsToSuno", () => {
  it("maps GTzan metal label to Suno catalog genres", () => {
    const result = mapHfGenrePredictionsToSuno([
      { label: "metal", score: 0.82 },
      { label: "rock", score: 0.11 },
    ]);
    expect(result.topGenre).toBe("metal");
    expect(result.suggestedGenres).toContain("Metal");
    expect(result.hfGenreLabels).toEqual(["metal", "rock"]);
  });

  it("maps DistilHuBERT electronic label to Suno catalog genres", () => {
    const result = mapHfGenrePredictionsToSuno(
      [{ label: "electronic", score: 0.77 }],
      { genreModel: HF_DISTILHUBERT_GENRE_MODEL_ID },
    );
    expect(result.suggestedGenres).toContain("Techno");
  });

  it("returns empty suggestions for missing predictions", () => {
    expect(mapHfGenrePredictionsToSuno(null).suggestedGenres).toEqual([]);
    expect(mapHfGenrePredictionsToSuno([]).suggestedGenres).toEqual([]);
  });
});
