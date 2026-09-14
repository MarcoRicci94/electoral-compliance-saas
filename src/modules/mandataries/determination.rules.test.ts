import { describe, expect, it } from "vitest";
import { determineMandatary } from "@/modules/mandataries/determination";
import { evaluateRules, type EvaluatableRule } from "@/modules/rules/evaluator";

function rule(
  ruleCode: string,
  determinesMandatary: string | undefined,
  overrides: Partial<EvaluatableRule> = {}
): EvaluatableRule {
  return {
    id: ruleCode,
    ruleCode,
    name: ruleCode,
    description: "regola di prova",
    category: "MANDATARY",
    severityDefault: "INFO",
    conditionExpression: { field: "campaign.electionType", operator: "eq", value: "MUNICIPAL" },
    effectType: "INFORMATION",
    effectPayload: { title: "T", description: "D", determinesMandatary },
    legalSourceId: null,
    legalSourceTitle: null,
    ...overrides
  };
}

const context = { campaign: { electionType: "MUNICIPAL" } };
const determine = (rules: EvaluatableRule[], ctx: Record<string, unknown> = context) =>
  determineMandatary(evaluateRules(rules, ctx));

describe("la determinazione viene dalle regole, non dal codice", () => {
  it("conclude che il mandatario e' necessario citando la regola che lo dice", () => {
    expect(determine([rule("IT-COM-MAND-REQ-001", "REQUIRED")])).toEqual({
      requirement: "REQUIRED",
      ruleCodes: ["IT-COM-MAND-REQ-001"]
    });
  });

  it("conclude che non e' necessario citando la regola di eccezione", () => {
    expect(determine([rule("IT-COM-MAND-EXC-001", "NOT_REQUIRED")])).toEqual({
      requirement: "NOT_REQUIRED",
      ruleCodes: ["IT-COM-MAND-EXC-001"]
    });
  });

  it("riconosce la campagna fuori dal perimetro dell'obbligo", () => {
    expect(determine([rule("IT-COM-SCOPE-003", "NOT_APPLICABLE")]).requirement).toBe(
      "NOT_APPLICABLE"
    );
  });

  it("ignora le regole che non si pronunciano sul mandatario", () => {
    const result = determine([
      rule("IT-COM-SCOPE-002", undefined),
      rule("IT-TRANS-CV-001", undefined),
      rule("IT-COM-MAND-REQ-001", "REQUIRED")
    ]);
    expect(result.requirement).toBe("REQUIRED");
    expect(result.ruleCodes).toEqual(["IT-COM-MAND-REQ-001"]);
  });

  it("piu' regole concordi restano una conclusione sola, con tutte le fonti", () => {
    const result = determine([
      rule("IT-COM-MAND-REQ-001", "REQUIRED"),
      rule("IT-COM-MAND-REQ-002", "REQUIRED")
    ]);
    expect(result.requirement).toBe("REQUIRED");
    expect(result.ruleCodes).toEqual(["IT-COM-MAND-REQ-001", "IT-COM-MAND-REQ-002"]);
  });
});

describe("i casi in cui rifiuta di concludere", () => {
  it("non sceglie fra due regole in conflitto", () => {
    const result = determine([
      rule("IT-COM-MAND-REQ-001", "REQUIRED"),
      rule("IT-COM-MAND-EXC-001", "NOT_REQUIRED")
    ]);
    expect(result.requirement).toBe("EVALUATION_INCOMPLETE");
    expect(result.reason).toMatch(/conflitto/);
    expect(result.ruleCodes).toHaveLength(2);
  });

  /**
   * Il caso piu' importante: una regola non valutabile altrove nel ruleset non
   * deve lasciar concludere "non serve il mandatario". Il quadro e' incompleto e
   * va detto.
   */
  it("non conclude se una qualsiasi regola non e' stata valutabile", () => {
    const result = determine([
      rule("IT-COM-MAND-EXC-001", "NOT_REQUIRED"),
      rule("IT-COM-LIMIT-001", undefined, {
        conditionExpression: { field: "demographics.population", operator: "gt", value: 15000 }
      })
    ]);
    expect(result.requirement).toBe("EVALUATION_INCOMPLETE");
    expect(result.ruleCodes).toContain("IT-COM-LIMIT-001");
  });

  it("distingue 'non lo so' da 'non serve'", () => {
    const result = determine([rule("IT-COM-SCOPE-002", undefined)]);
    expect(result.requirement).toBe("UNKNOWN");
    expect(result.requirement).not.toBe("NOT_REQUIRED");
    expect(result.reason).toMatch(/Nessuna regola/);
  });

  it("nessuna regola del tutto non e' una conclusione favorevole", () => {
    expect(determine([]).requirement).toBe("UNKNOWN");
  });

  it("una regola che non si applica non determina nulla", () => {
    const result = determine([rule("IT-COM-MAND-REQ-001", "REQUIRED")], {
      campaign: { electionType: "POLITICAL" }
    });
    expect(result.requirement).toBe("UNKNOWN");
  });
});
