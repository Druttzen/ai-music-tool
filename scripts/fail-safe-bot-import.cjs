const path = require("path");
const { pathToFileURL } = require("url");

const failSafeBotUrl = pathToFileURL(
  path.join(__dirname, "..", "app/lib/fail-safe-bot.js"),
).href;

/** Dynamic import of ESM fail-safe-bot (Windows-safe file:// URL). */
function importFailSafeBot() {
  return import(failSafeBotUrl);
}

module.exports = { importFailSafeBot };
