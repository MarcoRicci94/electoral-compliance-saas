/**
 * Risoluzione dei dati demografici usati dalle regole.
 *
 * Popolazione ed elettori iscritti possono arrivare da due posti: dall'elezione,
 * quando la consultazione porta con se' i propri dati ufficiali, oppure
 * dall'anagrafica territoriale. L'elezione prevale, perche' e' riferita alla
 * singola consultazione.
 *
 * La scelta non e' silenziosa: da quale fonte viene ciascun valore fa parte del
 * contesto, quindi finisce nell'impronta registrata insieme alla valutazione. Chi
 * rilegge un esito a distanza di mesi puo' sapere su quali numeri e' stato preso.
 *
 * Popolazione ed elettori iscritti non sono intercambiabili: la soglia
 * demografica dei comuni si misura sulla popolazione, i limiti di spesa sugli
 * elettori iscritti. Sono due campi distinti e nessuno dei due sostituisce
 * l'altro quando manca.
 */

export type DemographicSource = "ELECTION" | "TERRITORY" | "NONE";

export type DemographicInput = {
  population?: number | null;
  registeredVoters?: number | null;
  isVerified: boolean;
} | null;

export type Demographics = {
  population?: number;
  registeredVoters?: number;
  populationSource: DemographicSource;
  registeredVotersSource: DemographicSource;
  /** Vero solo se ogni valore effettivamente disponibile proviene da fonte verificata. */
  isVerified: boolean;
};

function usable(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function resolveDemographics(
  election: DemographicInput,
  territory: DemographicInput
): Demographics {
  const candidates: { source: DemographicSource; data: DemographicInput }[] = [
    { source: "ELECTION", data: election },
    { source: "TERRITORY", data: territory }
  ];

  let population: number | undefined;
  let populationSource: DemographicSource = "NONE";
  let registeredVoters: number | undefined;
  let registeredVotersSource: DemographicSource = "NONE";

  for (const candidate of candidates) {
    if (!candidate.data) continue;
    if (population === undefined && usable(candidate.data.population)) {
      population = candidate.data.population;
      populationSource = candidate.source;
    }
    if (registeredVoters === undefined && usable(candidate.data.registeredVoters)) {
      registeredVoters = candidate.data.registeredVoters;
      registeredVotersSource = candidate.source;
    }
  }

  const used = [
    { source: populationSource, present: population !== undefined },
    { source: registeredVotersSource, present: registeredVoters !== undefined }
  ].filter((entry) => entry.present);

  const isVerified =
    used.length > 0 &&
    used.every((entry) => {
      const origin = candidates.find((candidate) => candidate.source === entry.source);
      return origin?.data?.isVerified === true;
    });

  return { population, registeredVoters, populationSource, registeredVotersSource, isVerified };
}
