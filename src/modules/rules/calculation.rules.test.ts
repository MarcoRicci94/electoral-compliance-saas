import { describe, expect, it } from "vitest";
import {
  calculationExpressionSchema,
  evaluateCalculation,
  type CalculationExpression
} from "@/modules/rules/calculation";

/**
 * Formula a componente fissa piu' quota per elettore, nella forma usata dai limiti
 * di spesa. I valori numerici restano parametri: qui si verifica il motore, non la
 * correttezza giuridica dei parametri, che e' `LEGAL_REVIEW_REQUIRED`.
 */
const fixedPlusPerVoter: CalculationExpression = {
  operation: "add",
  items: [
    { constant: "fixedComponent" },
    {
      operation: "multiply",
      items: [{ field: "election.registeredVoters" }, { constant: "perVoterComponent" }]
    }
  ]
};

describe("aritmetica del denaro", () => {
  it("non introduce errore binario sulle somme", () => {
    const value = evaluateCalculation(
      { operation: "add", items: [{ constant: "a" }, { constant: "b" }] },
      {},
      { a: "0.1", b: "0.2" }
    );
    expect(value.toString()).toBe("0.3");
    expect(0.1 + 0.2).not.toBe(0.3);
  });

  it("mantiene i centesimi su una quota per elettore", () => {
    const value = evaluateCalculation(
      fixedPlusPerVoter,
      { election: { registeredVoters: 37_431 } },
      { fixedComponent: "5000", perVoterComponent: "0.05" }
    );
    expect(value.toString()).toBe("6871.55");
  });

  it("accetta importi gia' in forma di stringa decimale", () => {
    const value = evaluateCalculation(
      { operation: "subtract", items: [{ field: "limit" }, { field: "spent" }] },
      { limit: "25000.00", spent: "18420.37" },
      {}
    );
    expect(value.toString()).toBe("6579.63");
  });
});

describe("operazioni", () => {
  it("sottrae in sequenza a partire dal primo termine", () => {
    const value = evaluateCalculation(
      {
        operation: "subtract",
        items: [{ constant: "total" }, { constant: "a" }, { constant: "b" }]
      },
      {},
      { total: "1000", a: "250", b: "125.50" }
    );
    expect(value.toString()).toBe("624.5");
  });

  it("restituisce il termine stesso quando l'operazione ha un solo elemento", () => {
    expect(
      evaluateCalculation({ operation: "subtract", items: [{ constant: "a" }] }, {}, { a: "42" })
    ).toEqual(expect.objectContaining({}));
    expect(
      evaluateCalculation(
        { operation: "subtract", items: [{ constant: "a" }] },
        {},
        { a: "42" }
      ).toString()
    ).toBe("42");
    expect(
      evaluateCalculation(
        { operation: "divide", items: [{ constant: "a" }] },
        {},
        { a: "42" }
      ).toString()
    ).toBe("42");
  });

  it("seleziona il minimo e il massimo", () => {
    const items: CalculationExpression[] = [
      { constant: "a" },
      { constant: "b" },
      { constant: "c" }
    ];
    const constants = { a: "12500", b: "9800.40", c: "9800.50" };
    expect(evaluateCalculation({ operation: "min", items }, {}, constants).toString()).toBe(
      "9800.4"
    );
    expect(evaluateCalculation({ operation: "max", items }, {}, constants).toString()).toBe(
      "12500"
    );
  });
});

describe("errori espliciti invece di risultati inventati", () => {
  it("rifiuta la divisione per zero", () => {
    expect(() =>
      evaluateCalculation(
        { operation: "divide", items: [{ constant: "a" }, { constant: "b" }] },
        {},
        { a: "100", b: "0" }
      )
    ).toThrowError("CALCULATION_DIVIDE_BY_ZERO");
  });

  it("rifiuta un parametro non versionato", () => {
    expect(() => evaluateCalculation({ constant: "fixedComponent" }, {}, {})).toThrowError(
      "CALCULATION_PARAMETER_MISSING:fixedComponent"
    );
  });

  it("rifiuta un input di contesto mancante invece di trattarlo come zero", () => {
    expect(() =>
      evaluateCalculation(
        fixedPlusPerVoter,
        { election: {} },
        { fixedComponent: "5000", perVoterComponent: "0.05" }
      )
    ).toThrowError("CALCULATION_INPUT_MISSING:election.registeredVoters");
  });
});

describe("validazione delle formule", () => {
  it("accetta la formula a componente fissa piu' quota", () => {
    expect(calculationExpressionSchema.safeParse(fixedPlusPerVoter).success).toBe(true);
  });

  it("rifiuta un'operazione sconosciuta e una lista vuota", () => {
    expect(
      calculationExpressionSchema.safeParse({ operation: "power", items: [{ constant: "a" }] })
        .success
    ).toBe(false);
    expect(calculationExpressionSchema.safeParse({ operation: "add", items: [] }).success).toBe(
      false
    );
  });
});
