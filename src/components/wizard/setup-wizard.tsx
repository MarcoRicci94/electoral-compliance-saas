"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Municipality = {
  id: string;
  istatCode: string | null;
  name: string;
  province: string | null;
  region: string | null;
  population: number | null;
  registeredVoters: number | null;
  isVerified: boolean;
};

type SetupStatus = {
  steps: { key: string; label: string; done: boolean; blocking: boolean }[];
  complete: boolean;
  mandatary: {
    requirement: string;
    ruleCodes: string | null;
    evaluatedAt: string | null;
    profileExists: boolean;
  };
};

type Props = {
  organizationId: string;
  campaignId: string;
  initialStatus: SetupStatus;
  municipality: Municipality | null;
  answers: {
    expectsOwnSpending: boolean;
    plannedOwnSpending: string | null;
    expectsThirdPartyContributions: boolean;
    expectsPartyOrListSupport: boolean;
    expectsInKindContributions: boolean;
  } | null;
};

const numberFormat = new Intl.NumberFormat("it-IT");

async function call(url: string, method: string, body: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message ?? "Operazione non riuscita");
  return payload.data;
}

function Section({
  step,
  title,
  description,
  done,
  children
}: {
  step: number;
  title: string;
  description: string;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-white p-6">
      <div className="flex items-start gap-4">
        <span
          aria-hidden
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
            done ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"
          }`}
        >
          {done ? "✓" : step}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </section>
  );
}

/**
 * Esito del regime del mandatario.
 *
 * Le quattro risposte non sono intercambiabili e l'interfaccia non deve
 * appiattirle: "non risulta necessario" e "non lo so" sono cose diverse, e un
 * candidato che legge la seconda come la prima e' esattamente il danno che
 * questo prodotto dovrebbe evitare.
 */
function MandataryOutcome({ status }: { status: SetupStatus["mandatary"] }) {
  const map: Record<string, { tone: string; title: string; body: string }> = {
    REQUIRED: {
      tone: "border-amber-300 bg-amber-50",
      title: "Ti serve il mandatario elettorale",
      body: "In base a quanto hai dichiarato e a quanto risulta registrato, la nomina del mandatario elettorale e' l'ipotesi ordinaria. Verifica la posizione con il tuo consulente prima di raccogliere fondi."
    },
    NOT_REQUIRED: {
      tone: "border-emerald-300 bg-emerald-50",
      title: "Al momento il mandatario non risulta necessario",
      body: "Resta fermo l'obbligo di presentare il rendiconto. Se ricevi un contributo, un bene o un servizio da altri, oppure superi la spesa prevista, la posizione viene rivalutata automaticamente e te lo segnaliamo."
    },
    NOT_APPLICABLE: {
      tone: "border-slate-300 bg-slate-50",
      title: "La disciplina non risulta applicabile a questa candidatura",
      body: "Il comune e' sotto la soglia demografica prevista. Restano gli altri adempimenti eventualmente applicabili."
    },
    EVALUATION_INCOMPLETE: {
      tone: "border-red-300 bg-red-50",
      title: "Non e' possibile determinare il regime",
      body: "Alcune regole non sono state valutabili, oppure danno esiti in conflitto. Non trarre conclusioni da questa schermata: mancano dati o serve una verifica."
    },
    UNKNOWN: {
      tone: "border-slate-300 bg-slate-50",
      title: "Regime non ancora determinato",
      body: "Nessuna regola attiva si e' pronunciata. Finche' il quadro normativo non e' stato verificato e attivato, questa schermata non da' una risposta."
    }
  };
  const outcome = map[status.requirement] ?? map.UNKNOWN!;

  return (
    <div className={`rounded-lg border p-5 ${outcome.tone}`}>
      <p className="font-semibold">{outcome.title}</p>
      <p className="mt-2 text-sm text-slate-700">{outcome.body}</p>
      {status.ruleCodes && (
        <p className="mt-3 text-xs text-slate-600">
          Regole applicate: <span className="font-mono">{status.ruleCodes}</span>
        </p>
      )}
      <p className="mt-3 text-xs text-slate-600">
        Questa indicazione e' prodotta da un motore di regole e non sostituisce una valutazione
        legale.
      </p>
    </div>
  );
}

export function SetupWizard({
  organizationId,
  campaignId,
  initialStatus,
  municipality,
  answers
}: Props) {
  const router = useRouter();
  const base = `/api/v1/organizations/${organizationId}/campaigns/${campaignId}`;
  const [status, setStatus] = useState(initialStatus);
  const [selected, setSelected] = useState<Municipality | null>(municipality);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Municipality[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const step = (key: string) => status.steps.find((item) => item.key === key);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/v1/territories?q=${encodeURIComponent(query.trim())}`);
        if (response.ok) setResults((await response.json()).data as Municipality[]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const refresh = useCallback(async () => {
    const response = await fetch(`${base}/setup`);
    if (response.ok) setStatus((await response.json()).data as SetupStatus);
    router.refresh();
  }, [base, router]);

  async function chooseMunicipality(candidate: Municipality) {
    setError("");
    setBusy(true);
    try {
      await call(`${base}/territory`, "PUT", { territoryId: candidate.id });
      setSelected(candidate);
      setQuery("");
      setResults([]);
      await refresh();
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitAnswers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const expectsOwnSpending = form.get("expectsOwnSpending") === "on";
    try {
      await call(`${base}/setup`, "POST", {
        action: "SAVE_ANSWERS",
        expectsOwnSpending,
        plannedOwnSpending: expectsOwnSpending
          ? String(form.get("plannedOwnSpending") ?? "").trim()
          : undefined,
        expectsThirdPartyContributions: form.get("expectsThirdPartyContributions") === "on",
        expectsPartyOrListSupport: form.get("expectsPartyOrListSupport") === "on",
        expectsInKindContributions: form.get("expectsInKindContributions") === "on"
      });
      await refresh();
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setError("");
    setBusy(true);
    try {
      await call(`${base}/setup`, "POST", { action: "COMPLETE" });
      router.push("/dashboard");
      router.refresh();
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const [ownSpending, setOwnSpending] = useState(answers?.expectsOwnSpending ?? false);

  return (
    <div className="space-y-5">
      {error && (
        <p
          className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      )}

      <Section
        step={1}
        title="Dove ti candidi"
        description="Il comune determina quali regole si applicano alla tua campagna, a partire dalla soglia demografica."
        done={Boolean(step("TERRITORY")?.done)}
      >
        {selected ? (
          <div className="rounded-lg border bg-slate-50 p-4">
            <p className="font-medium">
              {selected.name}{" "}
              <span className="text-slate-500">
                ({selected.province}, {selected.region})
              </span>
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Popolazione: {selected.population ? numberFormat.format(selected.population) : "—"}
              {selected.population !== null && (
                <> — {selected.population > 15000 ? "sopra" : "sotto"} la soglia dei 15.000</>
              )}
            </p>
            {!selected.isVerified && (
              <p className="mt-2 text-xs text-amber-800">
                Dato demografico non ancora verificato su fonte ufficiale.
              </p>
            )}
            {selected.registeredVoters === null && (
              <p className="mt-1 text-xs text-amber-800">
                Elettori iscritti non disponibili: il limite di spesa non puo' ancora essere
                calcolato.
              </p>
            )}
            <button
              className="mt-3 text-sm text-blue-800 underline"
              onClick={() => setSelected(null)}
              type="button"
            >
              Cambia comune
            </button>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium">
              Cerca il comune
              <input
                autoComplete="off"
                className="mt-1 w-full rounded border p-2"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Firenze"
                value={query}
              />
            </label>
            {searching && <p className="mt-2 text-sm text-slate-500">Ricerca in corso…</p>}
            {results.length > 0 && (
              <ul className="mt-3 max-h-64 divide-y overflow-auto rounded border">
                {results.map((item) => (
                  <li key={item.id}>
                    <button
                      className="flex w-full items-baseline justify-between gap-3 p-3 text-left hover:bg-slate-50"
                      disabled={busy}
                      onClick={() => chooseMunicipality(item)}
                      type="button"
                    >
                      <span>
                        {item.name}{" "}
                        <span className="text-slate-500">
                          ({item.province}, {item.region})
                        </span>
                      </span>
                      <span className="shrink-0 text-sm text-slate-500">
                        {item.population ? `${numberFormat.format(item.population)} ab.` : "—"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Section>

      <Section
        step={2}
        title="Come finanzi la campagna"
        description="Sono previsioni, non impegni. Servono a stabilire il regime di partenza: se poi i fatti cambiano, la posizione viene rivalutata da sola."
        done={Boolean(step("SETUP")?.done)}
      >
        <form className="space-y-4" onSubmit={submitAnswers}>
          <label className="flex items-start gap-3 text-sm">
            <input
              className="mt-1"
              defaultChecked={answers?.expectsOwnSpending}
              name="expectsOwnSpending"
              onChange={(event) => setOwnSpending(event.target.checked)}
              type="checkbox"
            />
            <span>Prevedo di sostenere spese con denaro mio</span>
          </label>
          {ownSpending && (
            <label className="ml-7 block text-sm font-medium">
              Quanto prevedi di spendere, indicativamente?
              <input
                className="mt-1 w-48 rounded border p-2"
                defaultValue={answers?.plannedOwnSpending ?? ""}
                inputMode="decimal"
                name="plannedOwnSpending"
                placeholder="1800.00"
                required
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">
                In euro. Serve a stabilire se rientri nell&apos;eccezione che consente di non
                nominare il mandatario.
              </span>
            </label>
          )}
          <label className="flex items-start gap-3 text-sm">
            <input
              className="mt-1"
              defaultChecked={answers?.expectsThirdPartyContributions}
              name="expectsThirdPartyContributions"
              type="checkbox"
            />
            <span>Prevedo di ricevere contributi in denaro da altre persone o societa&apos;</span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input
              className="mt-1"
              defaultChecked={answers?.expectsPartyOrListSupport}
              name="expectsPartyOrListSupport"
              type="checkbox"
            />
            <span>Il partito o la lista sosterranno spese per la mia campagna</span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input
              className="mt-1"
              defaultChecked={answers?.expectsInKindContributions}
              name="expectsInKindContributions"
              type="checkbox"
            />
            <span>
              Prevedo di ricevere beni o servizi gratuiti (sale, grafica, fotografo, stampe…)
            </span>
          </label>
          <button
            className="rounded bg-blue-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={busy}
            type="submit"
          >
            {step("SETUP")?.done ? "Aggiorna le risposte" : "Salva e verifica"}
          </button>
        </form>
      </Section>

      <Section
        step={3}
        title="Il tuo regime"
        description="Determinato dal motore delle regole sulla base del comune, delle tue risposte e di quanto risulta gia' registrato."
        done={Boolean(step("MANDATARY")?.done)}
      >
        <MandataryOutcome status={status.mandatary} />
        {status.mandatary.requirement === "REQUIRED" && !status.mandatary.profileExists && (
          <p className="mt-4 text-sm text-slate-700">
            Il passaggio successivo e&apos; la nomina del mandatario. La schermata dedicata arriva
            con il prossimo rilascio: nel frattempo la campagna resta aperta e puoi gia&apos;
            registrare spese e contributi.
          </p>
        )}
      </Section>

      <div className="flex flex-wrap items-center gap-4">
        <button
          className="rounded bg-slate-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={busy || !status.complete}
          onClick={finish}
          type="button"
        >
          Completa l&apos;apertura
        </button>
        {!status.complete && (
          <p className="text-sm text-slate-600">
            Mancano:{" "}
            {status.steps
              .filter((item) => item.blocking && !item.done)
              .map((item) => item.label)
              .join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}
