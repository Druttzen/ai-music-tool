#!/usr/bin/env node
/**
 * beforeSubmitPrompt: when the user pastes Sourcery review text, append auto-fix instructions.
 */
import { readFileSync } from "fs";

const input = JSON.parse(readFileSync(0, "utf8"));
const prompt = String(input.prompt || input.user_message || "");

const isSourcery =
  /sourcery-ai/i.test(prompt) ||
  /issue_to_address/i.test(prompt) ||
  /Prompt for AI Agents/i.test(prompt) ||
  /@sourcery-ai/i.test(prompt);

if (!isSourcery) {
  process.exit(0);
}

const injection = `

[AUTO sourcery-auto-fix hook]
This message contains Sourcery AI review feedback. Without asking for confirmation:
1. Parse and implement every actionable issue (skip engagement boilerplate).
2. Run npm run check:ci after edits.
3. Commit and push if git rules allow.
4. Summarize fixes vs skipped items.
`;

process.stdout.write(
  JSON.stringify({
    continue: true,
    prompt: prompt + injection,
    user_message: prompt + injection,
  }),
);
