import { describe, expect, it } from "vitest";
import { checkActivationReadiness } from "@/modules/administration/rulesets";

const verified = { title: "Legge X", verifiedAt: new Date("2027-01-01") };

const rule = (overrides: Partial<Parameters<typeof checkActivationReadiness>[0][number]> = {}) => ({
  ruleCode: "IT-TEST-001",
  conditionExpression: { field: "campaign.electionType", operator: "eq", value: "MUNICIPAL" },
  effectType: "REQUIREMENT",
  effectPayload: { title: "T", description: "D" },
  isActive: true,
  legalSource: verified,
  ...overrides
});

const check = (rules: Parameters<typeof checkActivationReadiness>[0], parameters: string[] = []) =>
  checkActivationReadiness(rules, new Set(parameters));

describe("una regola senza fonte verificata non si attiva", () => {
  it("accetta una regola completa e collegata a una fonte verificata", () => {
    const result = check([rule()]);
    expect(result.ready).toBe(true);
    expect(result.activeRuleCount).toBe(1);
  });

  it("blocca una regola senza fonte", () => {
    const result = check([rule({ legalSource: null })]);
    expect(result.ready).toBe(false);
    expect(result.blockers[0]).toMatchObject({ code: "MISSING_LEGAL_SOURCE" });
  });

  /**
   * La verifica e' l'atto con cui una persona si assume la responsabilita' di
   * aver controllato il testo sulla fonte ufficiale. Senza, la regola resta una
   * ricostruzione e non puo' diventare cio' che il prodotto dice a un candidato.
   */
  it("blocca una regola la cui fonte non e' stata verificata da nessuno", () => {
    const result = check([rule({ legalSource: { title: "Legge X", verifiedAt: null } })]);
    expect(result.ready).toBe(false);
    expect(result.blockers[0]).toMatchObject({ code: "UNVERIFIED_LEGAL_SOURCE" });
  });

  it("ignora le regole non attive", () => {
    const result = check([
      rule(),
      rule({ ruleCode: "SPENTA", isActive: false, legalSource: null })
    ]);
    expect(result.ready).toBe(true);
    expect(result.activeRuleCount).toBe(1);
  });

  it("un ruleset senza alcuna regola attiva non si attiva", () => {
    const result = check([rule({ isActive: false })]);
    expect(result.ready).toBe(false);
    expect(result.blockers[0]).toMatchObject({ code: "NO_ACTIVE_RULES" });
  });
});

describe("una regola non eseguibile non si attiva", () => {
  it("blocca una condizione malformata", () => {
    const result = check([rule({ conditionExpression: { field: "campaign.x" } })]);
    expect(result.blockers.some((blocker) => blocker.code === "INVALID_CONDITION")).toBe(true);
  });

  it("blocca un tipo di effetto sconosciuto", () => {
    const result = check([rule({ effectType: "INVENTATO" })]);
    expect(result.blockers[0]).toMatchObject({ code: "UNKNOWN_EFFECT_TYPE" });
  });

  it("blocca un effetto incompleto", () => {
    const result = check([rule({ effectPayload: { title: "solo titolo" } })]);
    expect(result.blockers[0]).toMatchObject({ code: "INVALID_EFFECT" });
  });

  it("blocca una scadenza con un termine non analizzabile", () => {
    const result = check([
      rule({
        effectType: "DEADLINE",
        effectPayload: {
          name: "Rendiconto",
          triggerEvent: "PROCLAMATION",
          triggerField: "campaign.proclamationDate",
          offsetDefinition: "tre mesi"
        }
      })
    ]);
    expect(result.blockers[0]).toMatchObject({ code: "INVALID_EFFECT" });
  });
});

describe("i calcoli citano solo parametri versionati", () => {
  const calculation = (constant: string) =>
    rule({
      ruleCode: "IT-LIMIT-001",
      effectType: "CALCULATION",
      effectPayload: {
        code: "SPENDING_LIMIT",
        label: "Limite",
        expression: {
          operation: "add",
          items: [{ constant }, { field: "demographics.registeredVoters" }]
        }
      }
    });

  it("accetta un calcolo i cui parametri esistono", () => {
    expect(check([calculation("fixedComponent")], ["fixedComponent"]).ready).toBe(true);
  });

  /**
   * Un parametro mancante non si vede finche' qualcuno non apre la propria
   * campagna: il limite di spesa risulterebbe non calcolabile a chi ne ha
   * bisogno. Va fermato qui.
   */
  it("blocca un calcolo che cita un parametro non versionato", () => {
    const result = check([calculation("fixedComponent")], ["altro"]);
    expect(result.ready).toBe(false);
    expect(result.blockers[0]).toMatchObject({
      code: "MISSING_PARAMETER",
      ruleCode: "IT-LIMIT-001"
    });
  });
});

describe("gli impedimenti si raccolgono tutti", () => {
  it("segnala ogni regola problematica, non solo la prima", () => {
    const result = check([
      rule({ ruleCode: "A", legalSource: null }),
      rule({ ruleCode: "B", effectType: "INVENTATO" }),
      rule({ ruleCode: "C" })
    ]);
    expect(result.ready).toBe(false);
    expect(result.blockers.map((blocker) => blocker.ruleCode)).toEqual(
      expect.arrayContaining(["A", "B"])
    );
    expect(result.blockers.some((blocker) => blocker.ruleCode === "C")).toBe(false);
  });
});
