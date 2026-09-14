import { describe, expect, it } from "vitest";
import { resolveDemographics } from "@/modules/rules/demographics";

describe("precedenza delle fonti", () => {
  it("l'elezione prevale sull'anagrafica territoriale", () => {
    const result = resolveDemographics(
      { population: 372_000, registeredVoters: 280_000, isVerified: true },
      { population: 368_419, registeredVoters: 250_000, isVerified: false }
    );
    expect(result).toMatchObject({
      population: 372_000,
      populationSource: "ELECTION",
      registeredVoters: 280_000,
      registeredVotersSource: "ELECTION"
    });
  });

  it("ricade sull'anagrafica territoriale quando l'elezione non porta il dato", () => {
    const result = resolveDemographics(null, {
      population: 368_419,
      registeredVoters: null,
      isVerified: false
    });
    expect(result).toMatchObject({
      population: 368_419,
      populationSource: "TERRITORY",
      registeredVoters: undefined,
      registeredVotersSource: "NONE"
    });
  });

  it("prende i due valori da fonti diverse e lo dichiara", () => {
    const result = resolveDemographics(
      { population: null, registeredVoters: 280_000, isVerified: true },
      { population: 368_419, registeredVoters: 250_000, isVerified: false }
    );
    expect(result.populationSource).toBe("TERRITORY");
    expect(result.registeredVotersSource).toBe("ELECTION");
  });

  it("non inventa nulla quando non c'e' nessuna fonte", () => {
    expect(resolveDemographics(null, null)).toEqual({
      population: undefined,
      registeredVoters: undefined,
      populationSource: "NONE",
      registeredVotersSource: "NONE",
      isVerified: false
    });
  });
});

describe("popolazione ed elettori iscritti non si sostituiscono", () => {
  /**
   * La soglia demografica dei comuni si misura sulla popolazione, i limiti di
   * spesa sugli elettori iscritti. Il caricamento dell'anagrafica comunale porta
   * la prima e non i secondi: il secondo campo deve restare vuoto, non essere
   * riempito con il primo.
   */
  it("la popolazione non riempie il campo degli elettori iscritti", () => {
    const result = resolveDemographics(null, {
      population: 368_419,
      registeredVoters: null,
      isVerified: false
    });
    expect(result.population).toBe(368_419);
    expect(result.registeredVoters).toBeUndefined();
  });

  it("gli elettori iscritti non riempiono il campo della popolazione", () => {
    const result = resolveDemographics(null, {
      population: null,
      registeredVoters: 250_000,
      isVerified: false
    });
    expect(result.population).toBeUndefined();
    expect(result.registeredVoters).toBe(250_000);
  });

  it("distingue lo zero dall'assenza del dato", () => {
    const result = resolveDemographics(null, {
      population: 0,
      registeredVoters: null,
      isVerified: true
    });
    expect(result.population).toBe(0);
    expect(result.populationSource).toBe("TERRITORY");
  });
});

describe("verifica della fonte", () => {
  it("e' verificato solo se ogni valore usato viene da fonte verificata", () => {
    expect(
      resolveDemographics({ population: 1000, registeredVoters: 800, isVerified: true }, null)
        .isVerified
    ).toBe(true);
    expect(
      resolveDemographics({ population: 1000, registeredVoters: 800, isVerified: false }, null)
        .isVerified
    ).toBe(false);
  });

  it("un solo valore da fonte non verificata basta a rendere non verificato l'insieme", () => {
    const result = resolveDemographics(
      { population: null, registeredVoters: 800, isVerified: true },
      { population: 1000, registeredVoters: null, isVerified: false }
    );
    expect(result.populationSource).toBe("TERRITORY");
    expect(result.isVerified).toBe(false);
  });

  it("l'assenza di dati non e' una verifica riuscita", () => {
    expect(resolveDemographics({ isVerified: true }, { isVerified: true }).isVerified).toBe(false);
  });
});
