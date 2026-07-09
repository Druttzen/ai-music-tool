/** Maestro chat uses a single-line `<input>`, not a `<textarea>`. */
export function maestroChatInput(maestroPanel) {
  return maestroPanel.getByRole("textbox").first();
}
