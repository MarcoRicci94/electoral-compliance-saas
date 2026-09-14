import { describe, expect, it } from "vitest";
import {
  LegalCalendarError,
  applyLegalOffset,
  computeDeadline,
  daysBetween,
  formatLegalDate,
  parseLegalOffset,
  toLegalDate
} from "@/modules/rules/legal-calendar";

const due = (trigger: string, offset: string) =>
  formatLegalDate(computeDeadline(trigger, offset).dueDate);

describe("P3M non e' P90D", () => {
  /**
   * La distinzione e' sostanziale: su un rendiconto dovuto entro tre mesi dalla
   * proclamazione, trattare il termine come novanta giorni sposta la scadenza e
   * puo' farla cadere prima del dovuto.
   */
  it("da una proclamazione in un trimestre lungo i due termini divergono", () => {
    expect(due("2026-05-31", "P3M")).toBe("2026-08-31");
    expect(due("2026-05-31", "P90D")).toBe("2026-08-29");
  });

  it("da una proclamazione in un trimestre corto i due termini divergono in senso opposto", () => {
    expect(due("2027-01-15", "P3M")).toBe("2027-04-15");
    expect(due("2027-01-15", "P90D")).toBe("2027-04-15");
    expect(due("2027-02-15", "P3M")).toBe("2027-05-15");
    expect(due("2027-02-15", "P90D")).toBe("2027-05-16");
  });

  it("coincidono solo per coincidenza aritmetica, mai per definizione", () => {
    const threeMonths = due("2026-06-15", "P3M");
    const ninetyDays = due("2026-06-15", "P90D");
    expect(threeMonths).toBe("2026-09-15");
    expect(ninetyDays).toBe("2026-09-13");
    expect(threeMonths).not.toBe(ninetyDays);
  });
});

describe("fine mese", () => {
  it("tronca all'ultimo giorno utile quando il mese di arrivo e' piu' corto", () => {
    expect(due("2026-11-30", "P3M")).toBe("2027-02-28");
    expect(due("2026-10-31", "P1M")).toBe("2026-11-30");
    expect(due("2026-01-31", "P1M")).toBe("2026-02-28");
  });

  it("gestisce il 29 febbraio degli anni bisestili", () => {
    expect(due("2027-11-30", "P3M")).toBe("2028-02-29");
    expect(due("2028-02-29", "P1Y")).toBe("2029-02-28");
    expect(due("2028-02-29", "P12M")).toBe("2029-02-28");
  });

  it("non recupera il giorno perso nei mesi successivi", () => {
    // 31 gennaio + 1 mese = 28 febbraio; + 1 mese ancora = 28 marzo, non 31.
    const first = computeDeadline("2026-01-31", "P1M").dueDate;
    expect(formatLegalDate(first)).toBe("2026-02-28");
    expect(formatLegalDate(applyLegalOffset(first, parseLegalOffset("P1M")))).toBe("2026-03-28");
  });
});

describe("termini che precedono l'evento", () => {
  it("calcola un adempimento dovuto entro un numero di giorni prima del voto", () => {
    expect(due("2027-05-16", "-P14D")).toBe("2027-05-02");
    expect(due("2027-05-16", "-P7D")).toBe("2027-05-09");
  });

  it("attraversa il cambio d'anno", () => {
    expect(due("2027-01-10", "-P30D")).toBe("2026-12-11");
    expect(due("2027-01-10", "-P3M")).toBe("2026-10-10");
  });

  it("conserva la direzione nel termine analizzato", () => {
    expect(parseLegalOffset("-P14D")).toMatchObject({
      unit: "DAY",
      amount: 14,
      direction: "BEFORE"
    });
    expect(parseLegalOffset("P3M")).toMatchObject({
      unit: "MONTH",
      amount: 3,
      direction: "AFTER"
    });
  });
});

describe("tracciabilita' del calcolo", () => {
  it("conserva evento di partenza e definizione del termine", () => {
    const computation = computeDeadline("2027-06-20T22:30:00+02:00", "P3M");
    expect(formatLegalDate(computation.triggerDate)).toBe("2027-06-20");
    expect(computation.offset.definition).toBe("P3M");
    expect(formatLegalDate(computation.dueDate)).toBe("2027-09-20");
  });

  it("scarta ora e fuso orario invece di spostare il giorno", () => {
    expect(formatLegalDate(toLegalDate("2027-06-20T23:59:59Z"))).toBe("2027-06-20");
    expect(formatLegalDate(toLegalDate(new Date(Date.UTC(2027, 5, 20, 22, 0, 0))))).toBe(
      "2027-06-20"
    );
  });

  it("accetta il termine nullo", () => {
    expect(due("2027-06-20", "P0D")).toBe("2027-06-20");
  });
});

describe("input non validi", () => {
  it("rifiuta una definizione di termine non riconosciuta", () => {
    for (const malformed of ["3M", "P3", "P3W", "PT90S", "", "P-3M"]) {
      expect(() => parseLegalOffset(malformed)).toThrowError(LegalCalendarError);
    }
  });

  it("rifiuta una data non valida invece di produrre una scadenza inventata", () => {
    expect(() => computeDeadline("non-una-data", "P3M")).toThrowError(LegalCalendarError);
    try {
      computeDeadline("non-una-data", "P3M");
    } catch (error) {
      expect((error as LegalCalendarError).code).toBe("LEGAL_DATE_INVALID");
    }
  });
});

describe("distanza fra date", () => {
  it("conta i giorni di calendario compresi i bisestili", () => {
    expect(daysBetween("2026-05-31", "2026-08-29")).toBe(90);
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2);
    expect(daysBetween("2027-02-28", "2027-03-01")).toBe(1);
    expect(daysBetween("2027-03-01", "2027-02-28")).toBe(-1);
  });

  it("non e' influenzata dall'ora legale", () => {
    // In Italia l'ora legale entra l'ultima domenica di marzo: il conteggio dei
    // giorni di calendario non deve perdere ne' guadagnare un'ora.
    expect(daysBetween("2027-03-27", "2027-03-29")).toBe(2);
    expect(daysBetween("2027-10-30", "2027-11-01")).toBe(2);
  });
});
