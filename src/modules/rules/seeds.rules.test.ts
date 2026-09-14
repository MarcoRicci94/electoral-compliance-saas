import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { calculationExpressionSchema } from "@/modules/rules/calculation";
import { ruleExpressionSchema } from "@/modules/rules/dsl";
import {
  findingEffectTypes,
  isEffectType,
  parseCalculationEffect,
  parseDeadlineEffect,
  parseFindingEffect,
  parseTaskEffect
} from "@/modules/rules/effects";
import { evaluateRules, type EvaluatableRule } from "@/modules/rules/evaluator";
import { parseLegalOffset } from "@/modules/rules/legal-calendar";

type SeedRule = {
  ruleCode: string;
  name: string;
  description: string;
  category: string;
  severityDefault: EvaluatableRule["severityDefault"];
  legalSourceKey: string;
  conditionExpression: unknown;
  effectType: string;
  effectPayload: Record<string, unknown>;
};

type SeedRuleset = {
  name: string;
  jurisdiction: string;
  electionType: string;
  version: string;
  status: string;
  parameters: { code: string; value: string; legalSourceKey: string; note?: string }[];
  rules: SeedRule[];
};

const seed = JSON.parse(readFileSync("prisma/seeds/initial-ruleset-drafts.json", "utf8")) as {
  status: string;
  legalSources: { key: string; sourceType: string; title: string }[];
  rulesets: SeedRuleset[];
};

const allRules = seed.rulesets.flatMap((ruleset) =>
  ruleset.rules.map((rule) => ({ ruleset, rule }))
);

describe("le bozze non possono entrare in produzione di soppiatto", () => {
  it("il file e' dichiarato come materiale da rivedere", () => {
    expect(seed.status).toBe("LEGAL_REVIEW_REQUIRED");
  });

  it("nessun ruleset e' attivo", () => {
    for (const ruleset of seed.rulesets) expect(ruleset.status).toBe("DRAFT");
  });

  it("nessuna regola si dichiara attiva", () => {
    for (const { rule } of allRules)
      expect(rule as unknown as Record<string, unknown>).not.toHaveProperty("isActive", true);
  });

  it("ogni parametro numerico e' accompagnato dalla nota di mancata verifica", () => {
    for (const ruleset of seed.rulesets)
      for (const parameter of ruleset.parameters)
        expect(parameter.note ?? "").toMatch(/NON verificat/i);
  });
});

describe("ogni regola e' collegata a una fonte", () => {
  const declaredKeys = new Set(seed.legalSources.map((source) => source.key));

  it("la fonte citata esiste nel catalogo del file", () => {
    for (const { rule } of allRules) expect(declaredKeys).toContain(rule.legalSourceKey);
  });

  /**
   * Un controllo di prodotto o di sistema non deve essere presentato come un
   * obbligo di legge: la distinzione sta nel tipo di fonte, non nel testo.
   */
  it("i controlli di sistema sono dichiarati come tali", () => {
    const byKey = new Map(seed.legalSources.map((source) => [source.key, source]));
    for (const { rule } of allRules) {
      const source = byKey.get(rule.legalSourceKey);
      if (rule.ruleCode.startsWith("IT-SYS-")) expect(source?.sourceType).toBe("SYSTEM_CONTROL");
      else expect(source?.sourceType).not.toBe("SYSTEM_CONTROL");
    }
  });

  it("i codici regola sono univoci dentro ciascun ruleset", () => {
    for (const ruleset of seed.rulesets) {
      const codes = ruleset.rules.map((rule) => rule.ruleCode);
      expect(new Set(codes).size).toBe(codes.length);
    }
  });
});

describe("ogni regola e' sintatticamente valida per il motore che la eseguira'", () => {
  it("le condizioni superano lo schema della DSL", () => {
    for (const { rule } of allRules) {
      const parsed = ruleExpressionSchema.safeParse(rule.conditionExpression);
      expect(parsed.success, `${rule.ruleCode}: condizione non valida`).toBe(true);
    }
  });

  it("i tipi di effetto sono riconosciuti", () => {
    for (const { rule } of allRules)
      expect(isEffectType(rule.effectType), `${rule.ruleCode}: ${rule.effectType}`).toBe(true);
  });

  it("gli effetti superano lo schema del proprio tipo", () => {
    for (const { rule } of allRules) {
      if (!isEffectType(rule.effectType)) continue;
      if (findingEffectTypes.includes(rule.effectType))
        expect(() =>
          parseFindingEffect(rule.effectPayload, rule.effectType, rule.ruleCode)
        ).not.toThrow();
      else if (rule.effectType === "TASK")
        expect(() => parseTaskEffect(rule.effectPayload, rule.ruleCode)).not.toThrow();
      else if (rule.effectType === "DEADLINE")
        expect(() => parseDeadlineEffect(rule.effectPayload, rule.ruleCode)).not.toThrow();
      else expect(() => parseCalculationEffect(rule.effectPayload, rule.ruleCode)).not.toThrow();
    }
  });

  it("i termini delle scadenze sono analizzabili", () => {
    for (const { rule } of allRules) {
      if (rule.effectType !== "DEADLINE") continue;
      const effect = parseDeadlineEffect(rule.effectPayload, rule.ruleCode);
      expect(() => parseLegalOffset(effect.offsetDefinition)).not.toThrow();
    }
  });

  /**
   * Un calcolo che cita un parametro non versionato fallisce solo quando qualcuno
   * apre la propria campagna. Meglio scoprirlo qui.
   */
  it("ogni calcolo cita solo parametri versionati nel proprio ruleset", () => {
    for (const ruleset of seed.rulesets) {
      const available = new Set(ruleset.parameters.map((parameter) => parameter.code));
      for (const rule of ruleset.rules) {
        if (rule.effectType !== "CALCULATION") continue;
        const effect = parseCalculationEffect(rule.effectPayload, rule.ruleCode);
        const expression = calculationExpressionSchema.parse(effect.expression);
        const cited: string[] = [];
        const walk = (node: unknown) => {
          if (!node || typeof node !== "object") return;
          if ("constant" in node) cited.push((node as { constant: string }).constant);
          if ("items" in node) (node as { items: unknown[] }).items.forEach(walk);
        };
        walk(expression);
        for (const code of cited)
          expect(available, `${rule.ruleCode} cita ${code}`).toContain(code);
      }
    }
  });
});

describe("le bozze girano davvero sul valutatore", () => {
  const toEvaluatable = (rule: SeedRule): EvaluatableRule => ({
    id: rule.ruleCode,
    ruleCode: rule.ruleCode,
    name: rule.name,
    description: rule.description,
    category: rule.category,
    severityDefault: rule.severityDefault,
    conditionExpression: rule.conditionExpression,
    effectType: rule.effectType,
    effectPayload: rule.effectPayload,
    legalSourceId: null,
    legalSourceTitle: null
  });

  const municipal = seed.rulesets.find((ruleset) => ruleset.electionType === "MUNICIPAL")!;
  const parameters = Object.fromEntries(
    municipal.parameters.map((parameter) => [parameter.code, parameter.value])
  );

  const context = {
    today: "2027-06-01",
    campaign: {
      electionType: "MUNICIPAL",
      officeSought: "MUNICIPAL_COUNCILLOR",
      isZeroCampaign: false
    },
    demographics: {
      population: 380_000,
      registeredVoters: 250_000,
      populationSource: "TERRITORY",
      registeredVotersSource: "TERRITORY",
      isVerified: true
    },
    mandatary: { exists: true },
    finance: {
      externalContributionCount: 0,
      expensesGrossTotal: "18420.37",
      inKindTotal: "0.00",
      corporateContributionsWithIncompleteDocumentation: 0,
      inKindWithoutSupportingDocument: 0
    },
    donors: { countOverThreeThousand: 0 }
  };

  it("valuta l'intero ruleset comunale senza regole non valutabili", () => {
    const result = evaluateRules(municipal.rules.map(toEvaluatable), context, parameters);
    const broken = result.outcomes.filter((outcome) => outcome.status === "NOT_EVALUABLE");
    expect(broken).toEqual([]);
  });

  it("applica al consigliere la fascia demografica corretta e una sola", () => {
    const result = evaluateRules(municipal.rules.map(toEvaluatable), context, parameters);
    expect(result.calculations).toHaveLength(1);
    // 12.500 + 0,05 x 250.000 elettori
    expect(result.calculations[0]).toMatchObject({ code: "SPENDING_LIMIT", value: "25000.00" });
  });

  it("non produce la scadenza del rendiconto finche' manca la proclamazione", () => {
    const result = evaluateRules(municipal.rules.map(toEvaluatable), context, parameters);
    expect(result.deadlines).toHaveLength(0);

    const afterProclamation = evaluateRules(
      municipal.rules.map(toEvaluatable),
      { ...context, campaign: { ...context.campaign, proclamationDate: "2027-06-20" } },
      parameters
    );
    expect(afterProclamation.deadlines[0]).toMatchObject({
      offsetDefinition: "P3M",
      dueDate: "2027-09-20"
    });
  });

  it("blocca il deposito quando risultano contributi di terzi senza mandatario", () => {
    const result = evaluateRules(
      municipal.rules.map(toEvaluatable),
      {
        ...context,
        mandatary: { exists: false },
        finance: { ...context.finance, externalContributionCount: 3 }
      },
      parameters
    );
    expect(result.readyToFile).toBe(false);
    expect(result.findings.some((finding) => finding.severity === "BLOCKER")).toBe(true);
    expect(result.tasks.map((task) => task.title)).toContain(
      "Verificare la nomina del mandatario elettorale"
    );
  });

  it("avverte quando i dati elettorali non sono verificati su fonte ufficiale", () => {
    const result = evaluateRules(
      municipal.rules.map(toEvaluatable),
      { ...context, demographics: { ...context.demographics, isVerified: false } },
      parameters
    );
    expect(result.findings.map((finding) => finding.title)).toContain(
      "Dati dell'elezione non verificati su fonte ufficiale"
    );
  });
});

describe("il questionario iniziale determina un regime solo, per ogni combinazione", () => {
  const municipal = seed.rulesets.find((ruleset) => ruleset.electionType === "MUNICIPAL")!;
  const parameters = Object.fromEntries(
    municipal.parameters.map((parameter) => [parameter.code, parameter.value])
  );
  const rules = municipal.rules.map((rule): EvaluatableRule => ({
    id: rule.ruleCode,
    ruleCode: rule.ruleCode,
    name: rule.name,
    description: rule.description,
    category: rule.category,
    severityDefault: rule.severityDefault,
    conditionExpression: rule.conditionExpression,
    effectType: rule.effectType,
    effectPayload: rule.effectPayload,
    legalSourceId: null,
    legalSourceTitle: null
  }));

  type Answers = {
    expectsOwnSpending: boolean;
    plannedOwnSpending?: string;
    expectsThirdPartyContributions: boolean;
    expectsPartyOrListSupport: boolean;
    expectsInKindContributions: boolean;
  };

  type Facts = {
    externalContributionCount: number;
    expensesGrossTotal: string;
    inKindTotal: string;
  };
  const noFacts: Facts = {
    externalContributionCount: 0,
    expensesGrossTotal: "0.00",
    inKindTotal: "0.00"
  };

  const build = (answers: Answers, population = 380_000, facts: Facts = noFacts) => ({
    today: "2027-06-01",
    campaign: {
      electionType: "MUNICIPAL",
      officeSought: "MUNICIPAL_COUNCILLOR",
      isZeroCampaign: false
    },
    demographics: {
      population,
      registeredVoters: 250_000,
      populationSource: "TERRITORY",
      registeredVotersSource: "TERRITORY",
      isVerified: true
    },
    setup: { declared: true, ...answers },
    mandatary: { exists: true },
    finance: {
      ...facts,
      corporateContributionsWithIncompleteDocumentation: 0,
      inKindWithoutSupportingDocument: 0
    },
    donors: { countOverThreeThousand: 0 }
  });

  const booleans = [false, true];
  const ownSpending: { expectsOwnSpending: boolean; plannedOwnSpending?: string }[] = [
    { expectsOwnSpending: false },
    { expectsOwnSpending: true, plannedOwnSpending: "0.00" },
    { expectsOwnSpending: true, plannedOwnSpending: "2499.99" },
    { expectsOwnSpending: true, plannedOwnSpending: "2500.00" },
    { expectsOwnSpending: true, plannedOwnSpending: "9000.00" }
  ];

  const combinations: Answers[] = [];
  for (const third of booleans)
    for (const party of booleans)
      for (const inKind of booleans)
        for (const own of ownSpending)
          combinations.push({
            ...own,
            expectsThirdPartyContributions: third,
            expectsPartyOrListSupport: party,
            expectsInKindContributions: inKind
          });

  const expected = (answers: Answers) => {
    const external =
      answers.expectsThirdPartyContributions ||
      answers.expectsPartyOrListSupport ||
      answers.expectsInKindContributions;
    if (external) return "REQUIRED";
    if (!answers.expectsOwnSpending) return "NOT_REQUIRED";
    return Number(answers.plannedOwnSpending) >= 2500 ? "REQUIRED" : "NOT_REQUIRED";
  };

  it("copre tutte e 40 le combinazioni di risposte", () => {
    expect(combinations).toHaveLength(40);
  });

  /**
   * Il rischio vero non e' la regola sbagliata: e' la combinazione di risposte in
   * cui nessuna regola si pronuncia, oppure due si pronunciano in senso opposto.
   * Nel primo caso il candidato non riceve una risposta, nel secondo ne riceve una
   * scelta a caso.
   */
  it("per ogni combinazione esiste una determinazione e una sola", () => {
    for (const answers of combinations) {
      const result = evaluateRules(rules, build(answers), parameters);
      const broken = result.outcomes.filter((outcome) => outcome.status === "NOT_EVALUABLE");
      expect(broken, `regole non valutabili con ${JSON.stringify(answers)}`).toEqual([]);

      const determinations = result.findings
        .map((finding) => finding.determinesMandatary)
        .filter(Boolean);
      expect(determinations, `determinazioni con ${JSON.stringify(answers)}`).toHaveLength(1);
      expect(determinations[0], `esito con ${JSON.stringify(answers)}`).toBe(expected(answers));
    }
  });

  it("sotto la soglia demografica la disciplina non si applica, comunque si risponda", () => {
    for (const answers of combinations) {
      const result = evaluateRules(rules, build(answers, 9_000), parameters);
      const determinations = result.findings
        .map((finding) => finding.determinesMandatary)
        .filter(Boolean);
      expect(determinations).toEqual(["NOT_APPLICABLE"]);
    }
  });

  it("prima del questionario nessuna regola si pronuncia", () => {
    const context = build({
      expectsOwnSpending: false,
      expectsThirdPartyContributions: false,
      expectsPartyOrListSupport: false,
      expectsInKindContributions: false
    });
    const result = evaluateRules(
      rules,
      { ...context, setup: { ...context.setup, declared: false } },
      parameters
    );
    expect(result.findings.map((finding) => finding.determinesMandatary).filter(Boolean)).toEqual(
      []
    );
  });

  /**
   * Il test di integrazione ha mostrato che guardare le sole dichiarazioni non
   * basta: un contributo incassato da chi aveva dichiarato di autofinanziarsi
   * lasciava il regime su "non serve il mandatario". Ora le stesse regole leggono
   * anche i fatti registrati, e i fatti prevalgono.
   */
  const selfFinanced: Answers = {
    expectsOwnSpending: true,
    plannedOwnSpending: "1800.00",
    expectsThirdPartyContributions: false,
    expectsPartyOrListSupport: false,
    expectsInKindContributions: false
  };

  const determinationFor = (context: ReturnType<typeof build>) =>
    evaluateRules(rules, context, parameters)
      .findings.map((finding) => finding.determinesMandatary)
      .filter(Boolean);

  it("un contributo di terzi registrato ribalta una dichiarazione di autofinanziamento", () => {
    expect(determinationFor(build(selfFinanced))).toEqual(["NOT_REQUIRED"]);
    expect(
      determinationFor(build(selfFinanced, 380_000, { ...noFacts, externalContributionCount: 1 }))
    ).toEqual(["REQUIRED"]);
  });

  it("un bene o servizio ricevuto ha lo stesso effetto di un contributo in denaro", () => {
    expect(
      determinationFor(build(selfFinanced, 380_000, { ...noFacts, inKindTotal: "150.00" }))
    ).toEqual(["REQUIRED"]);
  });

  it("la spesa propria effettiva oltre la soglia ribalta la previsione che la teneva sotto", () => {
    expect(
      determinationFor(build(selfFinanced, 380_000, { ...noFacts, expensesGrossTotal: "2499.99" }))
    ).toEqual(["NOT_REQUIRED"]);
    expect(
      determinationFor(build(selfFinanced, 380_000, { ...noFacts, expensesGrossTotal: "2500.00" }))
    ).toEqual(["REQUIRED"]);
  });

  it("resta una determinazione sola anche quando fatti e dichiarazioni si sommano", () => {
    const answers: Answers = { ...selfFinanced, expectsThirdPartyContributions: true };
    expect(
      determinationFor(
        build(answers, 380_000, {
          externalContributionCount: 3,
          expensesGrossTotal: "9000.00",
          inKindTotal: "500.00"
        })
      )
    ).toEqual(["REQUIRED"]);
  });
});
