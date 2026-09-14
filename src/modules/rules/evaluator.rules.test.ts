import { describe, expect, it } from "vitest";
import { evaluateRules, type EvaluatableRule } from "@/modules/rules/evaluator";

function rule(overrides: Partial<EvaluatableRule> & Pick<EvaluatableRule, "ruleCode">) {
  return {
    id: `rule_${overrides.ruleCode}`,
    name: overrides.ruleCode,
    description: "regola di prova",
    category: "TEST",
    severityDefault: "ACTION_REQUIRED",
    conditionExpression: { field: "campaign.electionType", operator: "eq", value: "MUNICIPAL" },
    effectType: "REQUIREMENT",
    effectPayload: { title: "Adempimento", description: "Descrizione" },
    legalSourceId: null,
    legalSourceTitle: null,
    ...overrides
  } satisfies EvaluatableRule;
}

const municipalContext = {
  campaign: {
    electionType: "MUNICIPAL",
    officeSought: "MUNICIPAL_COUNCILLOR",
    proclamationDate: "2027-06-20"
  },
  election: { population: 380_000, registeredVoters: 250_000 },
  finance: { expensesRelevantForLimitTotal: "18420.37" }
};

describe("applicazione delle regole", () => {
  it("produce un rilievo quando la condizione e' soddisfatta", () => {
    const result = evaluateRules([rule({ ruleCode: "IT-COM-TEST-001" })], municipalContext);
    expect(result.outcomes[0]).toMatchObject({ status: "MATCHED", effectType: "REQUIREMENT" });
    expect(result.findings).toEqual([
      {
        kind: "FINDING",
        severity: "ACTION_REQUIRED",
        title: "Adempimento",
        description: "Descrizione",
        entityType: undefined
      }
    ]);
  });

  it("non produce nulla quando la condizione non e' soddisfatta", () => {
    const result = evaluateRules([rule({ ruleCode: "IT-POL-TEST-001" })], {
      ...municipalContext,
      campaign: { ...municipalContext.campaign, electionType: "POLITICAL" }
    });
    expect(result.outcomes[0]?.status).toBe("NOT_MATCHED");
    expect(result.findings).toHaveLength(0);
    expect(result.complianceState).toBe("COMPLETE");
  });

  it("lascia prevalere la gravita' dichiarata nell'effetto su quella di default", () => {
    const result = evaluateRules(
      [
        rule({
          ruleCode: "IT-COM-TEST-002",
          severityDefault: "INFO",
          effectPayload: { title: "T", description: "D", severity: "BLOCKER" }
        })
      ],
      municipalContext
    );
    expect(result.findings[0]?.severity).toBe("BLOCKER");
  });
});

describe("una regola non valutabile non viene trattata come non applicabile", () => {
  it("segnala la condizione malformata senza fermare le altre regole", () => {
    const result = evaluateRules(
      [
        rule({ ruleCode: "BUONA-001" }),
        rule({ ruleCode: "ROTTA-001", conditionExpression: { field: "campaign.x" } }),
        rule({ ruleCode: "BUONA-002" })
      ],
      municipalContext
    );
    expect(result.outcomes.map((outcome) => outcome.status)).toEqual([
      "MATCHED",
      "NOT_EVALUABLE",
      "MATCHED"
    ]);
    expect(result.findings).toHaveLength(2);
  });

  it("segnala il dato mancante invece di considerare la soglia non superata", () => {
    const result = evaluateRules(
      [
        rule({
          ruleCode: "IT-COM-SCOPE-001",
          conditionExpression: { field: "election.population", operator: "gt", value: 15000 }
        })
      ],
      { campaign: { electionType: "MUNICIPAL" }, election: {} }
    );
    expect(result.outcomes[0]).toMatchObject({
      status: "NOT_EVALUABLE",
      errorCode: "RULE_INPUT_MISSING"
    });
  });

  it("una sola regola non valutabile rende incompleta l'intera valutazione", () => {
    const result = evaluateRules(
      [
        rule({
          ruleCode: "OK-001",
          conditionExpression: { field: "campaign.assente", operator: "not_exists" }
        }),
        rule({ ruleCode: "KO-001", effectType: "INVENTATO" })
      ],
      municipalContext
    );
    expect(result.notEvaluable).toBe(1);
    expect(result.complianceState).toBe("EVALUATION_INCOMPLETE");
    expect(result.readyToFile).toBe(false);
  });

  it("rifiuta un effetto con payload incompleto", () => {
    const result = evaluateRules(
      [rule({ ruleCode: "KO-002", effectPayload: { title: "solo titolo" } })],
      municipalContext
    );
    expect(result.outcomes[0]).toMatchObject({
      status: "NOT_EVALUABLE",
      errorCode: "RULE_EFFECT_PAYLOAD_INVALID"
    });
  });
});

describe("scadenze", () => {
  const deadlineRule = rule({
    ruleCode: "IT-COM-REPORT-001",
    effectType: "DEADLINE",
    effectPayload: {
      name: "Rendiconto al Collegio regionale di garanzia elettorale",
      triggerEvent: "PROCLAMATION",
      triggerField: "campaign.proclamationDate",
      offsetDefinition: "P3M"
    }
  });

  it("calcola la scadenza a partire dall'evento indicato nel contesto", () => {
    const result = evaluateRules([deadlineRule], municipalContext);
    expect(result.deadlines).toEqual([
      {
        kind: "DEADLINE",
        name: "Rendiconto al Collegio regionale di garanzia elettorale",
        triggerEvent: "PROCLAMATION",
        triggerDate: "2027-06-20",
        offsetDefinition: "P3M",
        dueDate: "2027-09-20"
      }
    ]);
  });

  it("non inventa una scadenza quando manca la data dell'evento", () => {
    const result = evaluateRules([deadlineRule], {
      ...municipalContext,
      campaign: { electionType: "MUNICIPAL" }
    });
    expect(result.outcomes[0]).toMatchObject({
      status: "NOT_EVALUABLE",
      errorCode: "RULE_DEADLINE_TRIGGER_MISSING"
    });
    expect(result.deadlines).toHaveLength(0);
  });
});

describe("calcoli", () => {
  const limitRule = rule({
    ruleCode: "IT-COM-LIMIT-001",
    effectType: "CALCULATION",
    effectPayload: {
      code: "SPENDING_LIMIT",
      label: "Limite di spesa applicabile",
      unit: "EUR",
      expression: {
        operation: "add",
        items: [
          { constant: "fixedComponent" },
          {
            operation: "multiply",
            items: [{ field: "election.registeredVoters" }, { constant: "perVoterComponent" }]
          }
        ]
      }
    }
  });

  it("usa i parametri versionati del ruleset", () => {
    const result = evaluateRules([limitRule], municipalContext, {
      fixedComponent: "12500",
      perVoterComponent: "0.05"
    });
    expect(result.calculations).toEqual([
      {
        kind: "CALCULATION",
        code: "SPENDING_LIMIT",
        label: "Limite di spesa applicabile",
        value: "25000.00",
        unit: "EUR"
      }
    ]);
  });

  it("non calcola nulla se il parametro non e' stato versionato", () => {
    const result = evaluateRules([limitRule], municipalContext, { fixedComponent: "12500" });
    expect(result.outcomes[0]).toMatchObject({
      status: "NOT_EVALUABLE",
      errorCode: "CALCULATION_PARAMETER_MISSING"
    });
    expect(result.complianceState).toBe("EVALUATION_INCOMPLETE");
  });
});

describe("stato di conformita'", () => {
  const blocking = rule({
    ruleCode: "BLOCK-001",
    effectType: "BLOCKER",
    effectPayload: { title: "Blocco", description: "Non depositabile", severity: "BLOCKER" }
  });
  const warning = rule({
    ruleCode: "WARN-001",
    effectType: "WARNING",
    effectPayload: { title: "Attenzione", description: "Da verificare", severity: "WARNING" }
  });
  const info = rule({
    ruleCode: "INFO-001",
    effectType: "INFORMATION",
    effectPayload: { title: "Nota", description: "Informazione", severity: "INFO" }
  });

  it("un blocco impedisce il deposito", () => {
    const result = evaluateRules([blocking], municipalContext);
    expect(result.complianceState).toBe("CRITICAL");
    expect(result.readyToFile).toBe(false);
  });

  it("un avviso richiede attenzione ma non impedisce il deposito", () => {
    const result = evaluateRules([warning], municipalContext);
    expect(result.complianceState).toBe("ATTENTION_REQUIRED");
    expect(result.readyToFile).toBe(true);
  });

  it("una sola informazione non degrada lo stato", () => {
    const result = evaluateRules([info], municipalContext);
    expect(result.complianceState).toBe("COMPLETE");
    expect(result.readyToFile).toBe(true);
  });

  it("nessuna regola applicabile non significa nessuna regola valutata", () => {
    const result = evaluateRules([], municipalContext);
    expect(result.complianceState).toBe("COMPLETE");
    expect(result.outcomes).toHaveLength(0);
  });
});
