import type { MandataryDeterminationValue } from "@/modules/rules/effects";
import type { EvaluationResult, RuleOutcome } from "@/modules/rules/evaluator";

/**
 * Determinazione del regime del mandatario.
 *
 * La decisione non e' scritta qui: e' scritta nelle regole, che la dichiarano
 * con `determinesMandatary` e portano con se' la propria fonte normativa. Questa
 * funzione raccoglie cio' che le regole hanno detto e si limita a rifiutare di
 * concludere quando non c'e' una risposta univoca.
 *
 * Prima riceveva un booleano gia' deciso dal chiamante: la determinazione
 * avveniva quindi fuori dal Rules Engine, che e' esattamente cio' che
 * l'architettura vieta.
 *
 * Tre casi in cui non conclude, tutti deliberati:
 *
 * - se anche una sola regola non e' stata valutabile, il quadro e' incompleto e
 *   nessuna conclusione sul mandatario e' affidabile;
 * - se due regole dicono cose opposte, il conflitto va mostrato, non risolto
 *   scegliendo la piu' comoda;
 * - se nessuna regola si e' pronunciata, la risposta e' "non lo so", che e'
 *   diversa da "non serve".
 */

export type MandataryRequirement =
  "UNKNOWN" | "REQUIRED" | "NOT_REQUIRED" | "NOT_APPLICABLE" | "EVALUATION_INCOMPLETE";

export type MandataryDetermination = {
  requirement: MandataryRequirement;
  /** Le regole che si sono pronunciate, in chiaro, perche' la conclusione sia verificabile. */
  ruleCodes: string[];
  reason?: string;
};

type Determining = { ruleCode: string; value: MandataryDeterminationValue };

function collect(outcomes: RuleOutcome[]): Determining[] {
  const found: Determining[] = [];
  for (const outcome of outcomes) {
    if (outcome.status !== "MATCHED") continue;
    if (outcome.produced.kind !== "FINDING") continue;
    const value = outcome.produced.determinesMandatary;
    if (value) found.push({ ruleCode: outcome.ruleCode, value });
  }
  return found;
}

export function determineMandatary(result: EvaluationResult): MandataryDetermination {
  const notEvaluable = result.outcomes.filter((outcome) => outcome.status === "NOT_EVALUABLE");
  if (notEvaluable.length)
    return {
      requirement: "EVALUATION_INCOMPLETE",
      ruleCodes: notEvaluable.map((outcome) => outcome.ruleCode),
      reason:
        "Alcune regole non sono state valutabili: il regime del mandatario non puo' essere determinato."
    };

  const determinations = collect(result.outcomes);
  if (determinations.length === 0)
    return {
      requirement: "UNKNOWN",
      ruleCodes: [],
      reason: "Nessuna regola attiva si e' pronunciata sul regime del mandatario."
    };

  const distinct = [...new Set(determinations.map((item) => item.value))];
  if (distinct.length > 1)
    return {
      requirement: "EVALUATION_INCOMPLETE",
      ruleCodes: determinations.map((item) => item.ruleCode),
      reason: `Regole in conflitto sul regime del mandatario: ${distinct.join(", ")}.`
    };

  return {
    requirement: distinct[0] as MandataryRequirement,
    ruleCodes: determinations.map((item) => item.ruleCode)
  };
}
