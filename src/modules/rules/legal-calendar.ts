/**
 * Calendario legale.
 *
 * I termini normativi sono dati di calendario, non istanti: "tre mesi dalla
 * proclamazione" e "novanta giorni dalla proclamazione" sono termini diversi e
 * vanno modellati separatamente. Tutto qui lavora su date UTC a mezzanotte, senza
 * fuso orario e senza ora locale, perche' una scadenza non deve cambiare giorno a
 * seconda di dove si trova chi la guarda.
 */

export type LegalOffsetUnit = "DAY" | "MONTH" | "YEAR";
export type LegalOffsetDirection = "AFTER" | "BEFORE";

export type LegalOffset = {
  unit: LegalOffsetUnit;
  amount: number;
  direction: LegalOffsetDirection;
  /** La definizione originale, conservata per la tracciabilita' della scadenza. */
  definition: string;
};

export class LegalCalendarError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "LegalCalendarError";
  }
}

const offsetPattern = /^(-)?P(\d+)([DMY])$/;

/**
 * Accetta la forma ISO 8601 ridotta usata dalle regole: `P3M`, `P90D`, `P1Y`.
 * Il segno meno indica un termine che precede l'evento, per esempio `-P14D` per
 * un adempimento dovuto entro il quattordicesimo giorno precedente il voto.
 */
export function parseLegalOffset(definition: string): LegalOffset {
  const match = offsetPattern.exec(definition.trim());
  if (!match)
    throw new LegalCalendarError(
      "LEGAL_OFFSET_MALFORMED",
      `definizione di termine non riconosciuta: ${definition}`
    );
  const [, sign, rawAmount, rawUnit] = match;
  const unit: LegalOffsetUnit = rawUnit === "D" ? "DAY" : rawUnit === "M" ? "MONTH" : "YEAR";
  return {
    unit,
    amount: Number(rawAmount),
    direction: sign ? "BEFORE" : "AFTER",
    definition: definition.trim()
  };
}

/** Normalizza a mezzanotte UTC, scartando ora e fuso. */
export function toLegalDate(value: Date | string): Date {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime()))
    throw new LegalCalendarError("LEGAL_DATE_INVALID", `data non valida: ${String(value)}`);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0)
  );
}

function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Somma mesi mantenendo il giorno del mese e troncando all'ultimo giorno utile
 * quando il mese di arrivo e' piu' corto: dal 31 maggio, tre mesi dopo e' il
 * 31 agosto, ma dal 30 novembre sono il 28 o il 29 febbraio.
 */
function addMonths(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const monthIndex = date.getUTCMonth() + months;
  const day = date.getUTCDate();
  const targetYear = year + Math.floor(monthIndex / 12);
  const targetMonth = ((monthIndex % 12) + 12) % 12;
  const clampedDay = Math.min(day, lastDayOfMonth(targetYear, targetMonth));
  return new Date(Date.UTC(targetYear, targetMonth, clampedDay));
}

function addDays(date: Date, days: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

export function applyLegalOffset(trigger: Date | string, offset: LegalOffset): Date {
  const base = toLegalDate(trigger);
  const signedAmount = offset.direction === "BEFORE" ? -offset.amount : offset.amount;
  switch (offset.unit) {
    case "DAY":
      return addDays(base, signedAmount);
    case "MONTH":
      return addMonths(base, signedAmount);
    case "YEAR":
      return addMonths(base, signedAmount * 12);
  }
}

export type DeadlineComputation = {
  triggerDate: Date;
  offset: LegalOffset;
  dueDate: Date;
};

/**
 * Calcola una scadenza conservando l'evento di partenza e la definizione del
 * termine: la data da sola non e' verificabile, e una scadenza normativa deve
 * poter essere rifatta a mano da chi la contesta.
 */
export function computeDeadline(
  trigger: Date | string,
  offsetDefinition: string
): DeadlineComputation {
  const offset = parseLegalOffset(offsetDefinition);
  const triggerDate = toLegalDate(trigger);
  return { triggerDate, offset, dueDate: applyLegalOffset(triggerDate, offset) };
}

/** Giorni di calendario fra due date, positivi se `to` segue `from`. */
export function daysBetween(from: Date | string, to: Date | string): number {
  const start = toLegalDate(from).getTime();
  const end = toLegalDate(to).getTime();
  return Math.round((end - start) / 86_400_000);
}

export function formatLegalDate(date: Date): string {
  return toLegalDate(date).toISOString().slice(0, 10);
}
