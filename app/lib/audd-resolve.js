/**
 * Optional AudD music recognition — identify track from audio URL/file.
 * Set AIMC_AUDD_TOKEN in env or style-dna settings.
 */

/**
 * @param {{ apiToken: string, url?: string, file?: Blob }} opts
 */
export async function recognizeViaAudD(opts) {
  const token = String(opts.apiToken || "").trim();
  if (!token) throw new Error("AudD API token not configured");

  const form = new FormData();
  form.append("api_token", token);
  form.append("return", "spotify,apple_music,deezer");

  if (opts.url) {
    form.append("url", opts.url);
  } else if (opts.file) {
    form.append("file", opts.file, "audio.mp3");
  } else {
    throw new Error("Provide url or file for AudD recognition");
  }

  const res = await fetch("https://api.audd.io/", { method: "POST", body: form });
  const data = await res.json();
  if (data?.status !== "success" || !data?.result) {
    throw new Error(data?.error?.error_message || "AudD could not identify track");
  }

  const r = data.result;
  return {
    title: r.title || "",
    artist: r.artist || "",
    album: r.album || "",
    releaseDate: r.release_date || "",
    spotifyId: r.spotify?.id || "",
    spotifyUrl: r.spotify?.external_urls?.spotify || "",
    provider: "audd",
  };
}
