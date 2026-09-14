import { Decimal } from "@prisma/client/runtime/library";
import { describe, expect, it } from "vitest";
import {
  RuleEvaluationError,
  evaluateExpression,
  ruleExpressionSchema,
  type RuleExpression
} from "@/modules/rules/dsl";

describe("confini delle soglie", () => {
  const population = (value: number) => ({ election: { population: value } });

  it("distingue gt da gte sulla soglia dei 15.000 abitanti", () => {
    const strict: RuleExpression = {
      field: "election.population",
      operator: "gt",
      value: 15000
    };
    const inclusive: RuleExpression = {
      field: "election.population",
      operator: "gte",
      value: 15000
    };
    expect(evaluateExpression(strict, population(14999))).toBe(false);
    expect(evaluateExpression(strict, population(15000))).toBe(false);
    expect(evaluateExpression(strict, population(15001))).toBe(true);
    expect(evaluateExpression(inclusive, population(14999))).toBe(false);
    expect(evaluateExpression(inclusive, population(15000))).toBe(true);
  });

  it("distingue lt da lte sulla stessa soglia", () => {
    const strict: RuleExpression = { field: "election.population", operator: "lt", value: 15000 };
    const inclusive: RuleExpression = {
      field: "election.population",
      operator: "lte",
      value: 15000
    };
    expect(evaluateExpression(strict, population(15000))).toBe(false);
    expect(evaluateExpression(strict, population(14999))).toBe(true);
    expect(evaluateExpression(inclusive, population(15000))).toBe(true);
    expect(evaluateExpression(inclusive, population(15001))).toBe(false);
  });

  it("applica i confini delle fasce demografiche comunali senza sovrapposizioni", () => {
    const middleBand: RuleExpression = {
      all: [
        { field: "election.population", operator: "gt", value: 100000 },
        { field: "election.population", operator: "lte", value: 500000 }
      ]
    };
    expect(evaluateExpression(middleBand, population(100000))).toBe(false);
    expect(evaluateExpression(middleBand, population(100001))).toBe(true);
    expect(evaluateExpression(middleBand, population(500000))).toBe(true);
    expect(evaluateExpression(middleBand, population(500001))).toBe(false);
  });

  it("confronta la soglia dei 2.500 euro dell'eccezione del mandatario in Decimal", () => {
    const expression: RuleExpression = {
      field: "campaign.plannedOwnSpending",
      operator: "lt",
      value: 2500
    };
    expect(
      evaluateExpression(expression, { campaign: { plannedOwnSpending: new Decimal("2499.99") } })
    ).toBe(true);
    expect(
      evaluateExpression(expression, { campaign: { plannedOwnSpending: new Decimal("2500.00") } })
    ).toBe(false);
  });
});

describe("importi autorevoli", () => {
  it("confronta gli importi trasportati come stringa senza passare dai float", () => {
    const expression: RuleExpression = {
      field: "donor.annualAggregate",
      operator: "gt",
      value: 3000
    };
    // 3000.01 in aritmetica binaria non e' rappresentabile esattamente: il confronto
    // deve restare in Decimal.
    expect(evaluateExpression(expression, { donor: { annualAggregate: "3000.01" } })).toBe(true);
    expect(evaluateExpression(expression, { donor: { annualAggregate: "3000.00" } })).toBe(false);
  });

  it("considera uguali un numero e la sua rappresentazione testuale", () => {
    const expression: RuleExpression = {
      field: "election.population",
      operator: "eq",
      value: 15000
    };
    expect(evaluateExpression(expression, { election: { population: "15000" } })).toBe(true);
    expect(evaluateExpression(expression, { election: { population: "15000.00" } })).toBe(true);
  });

  it("mantiene stretta l'uguaglianza sui valori non numerici", () => {
    const expression: RuleExpression = {
      field: "campaign.electionType",
      operator: "eq",
      value: "MUNICIPAL"
    };
    expect(evaluateExpression(expression, { campaign: { electionType: "MUNICIPAL" } })).toBe(true);
    expect(evaluateExpression(expression, { campaign: { electionType: "POLITICAL" } })).toBe(false);
  });
});

describe("date", () => {
  it("confronta le date senza trattarle come stringhe", () => {
    const expression: RuleExpression = {
      field: "campaign.proclamationDate",
      operator: "gte",
      value: "2026-09-15"
    };
    expect(
      evaluateExpression(expression, { campaign: { proclamationDate: new Date("2026-09-15") } })
    ).toBe(true);
    expect(
      evaluateExpression(expression, { campaign: { proclamationDate: new Date("2026-09-14") } })
    ).toBe(false);
    expect(evaluateExpression(expression, { campaign: { proclamationDate: "2026-12-01" } })).toBe(
      true
    );
  });
});

describe("una condizione non valutabile non e' una condizione falsa", () => {
  it("solleva un errore quando il campo della soglia e' assente", () => {
    const expression: RuleExpression = {
      field: "election.population",
      operator: "gt",
      value: 15000
    };
    expect(() => evaluateExpression(expression, { election: {} })).toThrowError(
      RuleEvaluationError
    );
    try {
      evaluateExpression(expression, { election: {} });
    } catch (error) {
      expect((error as RuleEvaluationError).code).toBe("RULE_INPUT_MISSING");
    }
  });

  it("solleva un errore quando i due termini non sono confrontabili", () => {
    const expression: RuleExpression = {
      field: "campaign.name",
      operator: "gt",
      value: 15000
    };
    expect(() =>
      evaluateExpression(expression, { campaign: { name: "Comunali Firenze" } })
    ).toThrowError(/non e' confrontabile/);
  });

  it("non confonde l'assenza del dato con il valore zero", () => {
    const atLeast: RuleExpression = {
      field: "campaign.plannedOwnSpending",
      operator: "lt",
      value: 2500
    };
    expect(evaluateExpression(atLeast, { campaign: { plannedOwnSpending: 0 } })).toBe(true);
    expect(() => evaluateExpression(atLeast, { campaign: {} })).toThrowError(RuleEvaluationError);
  });
});

describe("presenza del dato", () => {
  it("distingue exists da not_exists compreso il valore falso", () => {
    const exists: RuleExpression = { field: "mandatary.appointedAt", operator: "exists" };
    const missing: RuleExpression = { field: "mandatary.appointedAt", operator: "not_exists" };
    expect(evaluateExpression(exists, { mandatary: { appointedAt: new Date() } })).toBe(true);
    expect(evaluateExpression(exists, { mandatary: { appointedAt: null } })).toBe(false);
    expect(evaluateExpression(missing, { mandatary: {} })).toBe(true);
    expect(
      evaluateExpression(
        { field: "campaign.zeroCampaign", operator: "exists" },
        {
          campaign: { zeroCampaign: false }
        }
      )
    ).toBe(true);
  });
});

describe("composizione logica", () => {
  const expression: RuleExpression = {
    all: [
      { field: "campaign.electionType", operator: "eq", value: "MUNICIPAL" },
      { field: "election.population", operator: "gt", value: 15000 },
      {
        any: [
          { field: "campaign.officeSought", operator: "eq", value: "MAYOR" },
          { field: "campaign.officeSought", operator: "eq", value: "MUNICIPAL_COUNCILLOR" }
        ]
      },
      { not: { field: "campaign.withdrawn", operator: "eq", value: true } }
    ]
  };

  it("applica la regola al candidato consigliere di un comune sopra soglia", () => {
    expect(
      evaluateExpression(expression, {
        campaign: {
          electionType: "MUNICIPAL",
          officeSought: "MUNICIPAL_COUNCILLOR",
          withdrawn: false
        },
        election: { population: 380000 }
      })
    ).toBe(true);
  });

  it("non applica la regola a una candidatura ritirata", () => {
    expect(
      evaluateExpression(expression, {
        campaign: { electionType: "MUNICIPAL", officeSought: "MAYOR", withdrawn: true },
        election: { population: 380000 }
      })
    ).toBe(false);
  });

  it("gestisce in e not_in sulle cariche", () => {
    const included: RuleExpression = {
      field: "campaign.officeSought",
      operator: "in",
      value: ["DEPUTY", "SENATOR"]
    };
    expect(evaluateExpression(included, { campaign: { officeSought: "SENATOR" } })).toBe(true);
    expect(evaluateExpression(included, { campaign: { officeSought: "MAYOR" } })).toBe(false);
    expect(
      evaluateExpression(
        { field: "campaign.officeSought", operator: "not_in", value: ["DEPUTY", "SENATOR"] },
        { campaign: { officeSought: "MAYOR" } }
      )
    ).toBe(true);
  });
});

describe("validazione della DSL", () => {
  it("accetta un'espressione annidata valida", () => {
    expect(
      ruleExpressionSchema.safeParse({
        all: [{ field: "campaign.electionType", operator: "eq", value: "POLITICAL" }]
      }).success
    ).toBe(true);
  });

  it("rifiuta un operatore di confronto senza valore", () => {
    expect(
      ruleExpressionSchema.safeParse({ field: "election.population", operator: "gt" }).success
    ).toBe(false);
  });

  it("rifiuta in senza array e un confronto con array", () => {
    expect(
      ruleExpressionSchema.safeParse({
        field: "campaign.officeSought",
        operator: "in",
        value: "MAYOR"
      }).success
    ).toBe(false);
    expect(
      ruleExpressionSchema.safeParse({
        field: "election.population",
        operator: "gt",
        value: [1, 2]
      }).success
    ).toBe(false);
  });

  it("rifiuta i percorsi che attraversano il prototipo", () => {
    expect(
      ruleExpressionSchema.safeParse({
        field: "campaign.constructor",
        operator: "exists"
      }).success
    ).toBe(false);
  });

  it("non risolve proprieta' ereditate", () => {
    expect(
      evaluateExpression({ field: "campaign.toString", operator: "exists" }, { campaign: {} })
    ).toBe(false);
  });
});
