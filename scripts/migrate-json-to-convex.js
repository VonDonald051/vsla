const fs = require("fs");
const path = require("path");
const { ConvexHttpClient } = require("convex/browser");

function loadEnvFile(filename) {
  if (!fs.existsSync(filename)) return;
  for (const line of fs.readFileSync(filename, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)=(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

loadEnvFile(path.join(__dirname, "..", ".env.local"));
loadEnvFile(path.join(__dirname, "..", ".env"));

async function main() {
  if (!process.env.CONVEX_URL) {
    throw new Error("CONVEX_URL is missing. Add it to .env.local before migrating.");
  }
  const snapshot = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "data", "db.json"), "utf8"),
  );
  const client = new ConvexHttpClient(process.env.CONVEX_URL);
  const result = await client.mutation("migrations:importLegacySnapshot", { snapshot });
  console.log("Convex import complete:", result);
}

main().catch((error) => {
  console.error("Convex import failed:", error.message);
  process.exitCode = 1;
});
