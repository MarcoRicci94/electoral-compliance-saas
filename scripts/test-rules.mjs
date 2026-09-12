import assert from "node:assert/strict";
import { evaluateExpression } from "../src/modules/rules/dsl.ts";

const municipalThreshold = { field: "election.population", operator: "gt", value: 15000 };
assert.equal(evaluateExpression(municipalThreshold, { election: { population: 15000 } }), false);
assert.equal(evaluateExpression(municipalThreshold, { election: { population: 15001 } }), true);
console.log("Rules regression gate superato: soglia comunale 15.000 verificata.");
