"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Source = {
  id: string;
  title: string;
  sourceType: string;
  officialUrl: string | null;
  verifiedAt: string | null;
};

type Rule = {
  id: string;
  ruleCode: string;
  name: string;
  description: string;
  category: string;
  severityDefault: string;
  effectType: string;
  isActive: boolean;
  source: Source | null;
};

type Blocker = { code: string; ruleCode?: string; message: string };

type Props = {
  rulesetId: string;
  status: string;
  rules: Rule[];
  parameters: { code: string; value: string; unit: string | null }[];
  readiness: { ready: boolean; activeRuleCount: number; blockers: Blocker[] };
};

async function call(body: unknown) {
  const response = await fetch("/api/v1/admin/legal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message ?? "Operazione non riuscita");
  return payload.data;
}

const sourceTypeLabels: Record<string, string> = {
  LAW: "Legge",
  DECREE: "Decreto",
  REGULATION: "Regolamento",
  COREGE_GUIDANCE: "Indicazione del Collegio",
  AGCOM_DECISION: "Delibera AGCOM",
  PRIVACY_AUTHORITY: "Garante privacy",
  MUNICIPAL_REGULATION: "Regolamento comunale",
  PRACTICE: "Prassi",
  SYSTEM_CONTROL: "Controllo di sistema",
  PRODUCT_BEST_PRACTICE: "Buona pratica di prodotto"
};

export function RulesetConsole({ rulesetId, status, rules, parameters, readiness }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState<Source | null>(null);
  const locked = status === "ACTIVE" || status === "SUPERSEDED" || status === "ARCHIVED";

  async function run(key: string, body: unknown) {
    setError("");
    setBusy(key);
    try {
      await call(body);
      router.refresh();
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!verifying) return;
    const form = new FormData(event.currentTarget);
    const officialUrl = String(form.get("officialUrl") ?? "").trim();
    await run(`source-${verifying.id}`, {
      action: "VERIFY_SOURCE",
      legalSourceId: verifying.id,
      officialUrl: officialUrl || undefined,
      notes: String(form.get("notes") ?? "").trim() || undefined
    });
    setVerifying(null);
  }

  async function activate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run("activate", {
      action: "ACTIVATE_RULESET",
      rulesetVersionId: rulesetId,
      reviewNote: String(form.get("reviewNote") ?? "")
    });
  }

  const sources = new Map<string, Source>();
  for (const rule of rules) if (rule.source) sources.set(rule.source.id, rule.source);

  return (
    <div className="space-y-8">
      {error && (
        <p
          className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      )}

      <section className="rounded-xl border bg-white p-6">
        <h2 className="text-lg font-semibold">Fonti normative</h2>
        <p className="mt-1 text-sm text-slate-600">
          Una regola puo&apos; essere attivata solo se la sua fonte e&apos; stata verificata. La
          verifica resta registrata con il tuo nome e la data.
        </p>
        <ul className="mt-5 divide-y">
          {[...sources.values()].map((source) => (
            <li className="flex flex-wrap items-center justify-between gap-3 py-3" key={source.id}>
              <div className="min-w-0">
                <p className="font-medium">{source.title}</p>
                <p className="text-sm text-slate-500">
                  {sourceTypeLabels[source.sourceType] ?? source.sourceType}
                  {source.officialUrl && (
                    <>
                      {" — "}
                      <a className="text-blue-800 underline" href={source.officialUrl}>
                        testo ufficiale
                      </a>
                    </>
                  )}
                </p>
              </div>
              {source.verifiedAt ? (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-900">
                  Verificata il {new Date(source.verifiedAt).toLocaleDateString("it-IT")}
                </span>
              ) : (
                <button
                  className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                  disabled={locked || busy !== ""}
                  onClick={() => setVerifying(source)}
                  type="button"
                >
                  Segna come verificata
                </button>
              )}
            </li>
          ))}
        </ul>

        {verifying && (
          <form className="mt-5 space-y-3 rounded-lg border bg-slate-50 p-5" onSubmit={verify}>
            <p className="font-medium">{verifying.title}</p>
            <p className="text-sm text-slate-600">
              Confermi di aver letto il testo sulla fonte ufficiale e che corrisponde a quanto usato
              dalle regole collegate.
            </p>
            <label className="block text-sm font-medium">
              Link al testo ufficiale
              <input
                className="mt-1 w-full rounded border p-2"
                defaultValue={verifying.officialUrl ?? ""}
                name="officialUrl"
                placeholder="https://www.normattiva.it/…"
                type="url"
              />
            </label>
            <label className="block text-sm font-medium">
              Nota di verifica
              <textarea className="mt-1 w-full rounded border p-2" name="notes" rows={2} />
            </label>
            <div className="flex gap-3">
              <button
                className="rounded bg-blue-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                disabled={busy !== ""}
                type="submit"
              >
                Conferma la verifica
              </button>
              <button
                className="rounded border px-4 py-2 text-sm"
                onClick={() => setVerifying(null)}
                type="button"
              >
                Annulla
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="rounded-xl border bg-white p-6">
        <h2 className="text-lg font-semibold">Regole ({rules.length})</h2>
        {locked && (
          <p className="mt-2 rounded border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700">
            Questo ruleset non e&apos; piu&apos; modificabile. Per cambiare una regola si crea una
            nuova versione: modificarlo sotto le campagne che lo stanno applicando renderebbe
            irripetibile ogni valutazione gia&apos; fatta.
          </p>
        )}
        <ul className="mt-5 divide-y">
          {rules.map((rule) => (
            <li className="py-4" key={rule.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-slate-500">{rule.ruleCode}</p>
                  <p className="font-medium">{rule.name}</p>
                  <p className="mt-1 text-sm text-slate-600">{rule.description}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {rule.effectType} · {rule.severityDefault} ·{" "}
                    {rule.source ? (
                      <>
                        {rule.source.title}
                        {!rule.source.verifiedAt && (
                          <span className="text-amber-800"> (non verificata)</span>
                        )}
                      </>
                    ) : (
                      <span className="text-red-700">nessuna fonte collegata</span>
                    )}
                  </p>
                </div>
                <button
                  className={`shrink-0 rounded border px-3 py-1 text-sm disabled:opacity-50 ${
                    rule.isActive ? "border-emerald-400 bg-emerald-50" : ""
                  }`}
                  disabled={locked || busy !== ""}
                  onClick={() =>
                    run(`rule-${rule.id}`, {
                      action: "SET_RULE_ACTIVE",
                      ruleId: rule.id,
                      isActive: !rule.isActive
                    })
                  }
                  type="button"
                >
                  {rule.isActive ? "Attiva" : "Non attiva"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border bg-white p-6">
        <h2 className="text-lg font-semibold">Parametri ({parameters.length})</h2>
        <table className="mt-4 w-full text-left text-sm">
          <tbody className="divide-y">
            {parameters.map((parameter) => (
              <tr key={parameter.code}>
                <td className="py-2 font-mono text-xs">{parameter.code}</td>
                <td className="py-2">{parameter.value}</td>
                <td className="py-2 text-slate-500">{parameter.unit ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {!locked && (
        <section className="rounded-xl border bg-white p-6">
          <h2 className="text-lg font-semibold">Attivazione</h2>
          {readiness.ready ? (
            <p className="mt-2 rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
              {readiness.activeRuleCount} regole attive, tutte collegate a fonti verificate ed
              eseguibili dal motore.
            </p>
          ) : (
            <div className="mt-2 rounded border border-amber-300 bg-amber-50 p-4 text-sm">
              <p className="font-medium text-amber-900">Non ancora attivabile:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-900">
                {readiness.blockers.map((blocker, index) => (
                  <li key={`${blocker.code}-${blocker.ruleCode ?? index}`}>
                    {blocker.ruleCode && <span className="font-mono">{blocker.ruleCode}: </span>}
                    {blocker.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <form className="mt-5 space-y-3" onSubmit={activate}>
            <label className="block text-sm font-medium">
              Cosa hai verificato
              <textarea
                className="mt-1 w-full rounded border p-2"
                minLength={20}
                name="reviewNote"
                placeholder="Verificati i limiti di spesa e la soglia demografica sul testo vigente pubblicato in Gazzetta…"
                required
                rows={3}
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">
                La nota resta agli atti insieme all&apos;attivazione, con il tuo nome e la data.
              </span>
            </label>
            <button
              className="rounded bg-slate-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
              disabled={!readiness.ready || busy !== ""}
              type="submit"
            >
              {busy === "activate" ? "Attivazione…" : "Attiva il ruleset"}
            </button>
          </form>

          <p className="mt-4 text-xs text-slate-500">
            Da questo momento le regole verranno applicate alle campagne reali. Una versione
            precedente per la stessa giurisdizione e tipo di elezione viene marcata come superata.
          </p>
        </section>
      )}
    </div>
  );
}
