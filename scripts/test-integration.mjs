import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const accessService = await readFile("src/modules/access/service.ts", "utf8");
const campaignService = await readFile("src/modules/campaigns/service.ts", "utf8");

assert.match(accessService, /campaign:\s*\{ organizationId \}/, "l'accesso campagna deve vincolare l'organizzazione");
assert.match(
  campaignService,
  /where:\s*\{\s*id: campaignId,\s*organizationId,/,
  "la lettura campagna deve vincolare il tenant"
);
assert.doesNotMatch(campaignService, /findUnique\(\{\s*where:\s*\{\s*id:/, "vietata lettura campagna per solo id");
console.log("Integration test superati: contratto di isolamento tenant.");
