import { describe, expect, it } from "vitest";
import { evaluateCalculation } from "@/modules/rules/calculation";
import { evaluateExpression } from "@/modules/rules/dsl";

describe("regressioni delle regole", () => {
  it("rispetta il confine comunale strettamente maggiore di 15.000", () => {
    const expression = { field: "election.population", operator: "gt" as const, value: 15000 };
    expect(evaluateExpression(expression, { election: { population: 15000 } })).toBe(false);
    expect(evaluateExpression(expression, { election: { population: 15001 } })).toBe(true);
  });

  it("calcola formule con precisione decimale", () => {
    const value = evaluateCalculation(
      {
        operation: "add",
        items: [
          { constant: "fixed" },
          {
            operation: "multiply",
            items: [{ field: "election.registeredVoters" }, { constant: "perVoter" }]
          }
        ]
      },
      { election: { registeredVoters: 100 } },
      { fixed: "10.10", perVoter: "0.23" }
    );
    expect(value.toString()).toBe("33.1");
  });
});
