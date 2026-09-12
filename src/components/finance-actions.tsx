"use client";

import { FormEvent, useEffect, useState } from "react";

const endpoint = "/api/v1/organizations/development-org/campaigns/development-campaign/finance";

type Overview = {
  confirmedContributions: string;
  expenses: string;
  outstandingExpenses: string;
  confirmedInKindContributions: string;
};

function money(value: string) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR"
  }).format(Number(value));
}

export function FinanceActions() {
  const [mode, setMode] = useState<"CONTRIBUTION" | "EXPENSE" | null>(null);
  const [message, setMessage] = useState("");
  const [overview, setOverview] = useState<Overview | null>(null);

  async function refreshOverview() {
    const response = await fetch(endpoint);
    if (response.ok) setOverview((await response.json()) as Overview);
  }

  useEffect(() => {
    void refreshOverview();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const payload =
      mode === "CONTRIBUTION"
        ? { kind: mode, type: "MONEY", date: values.date, amount: values.amount }
        : {
            kind: "EXPENSE",
            expenseDate: values.date,
            description: values.description,
            legalCategory: "ALTRO",
            grossAmount: values.amount,
            relevantAmountForLimit: values.amount
          };
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setMessage(
      response.ok ? "Operazione registrata nella campagna demo." : "Registrazione non riuscita."
    );
    if (response.ok) {
      setMode(null);
      await refreshOverview();
    }
  }
  return (
    <>
      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Entrate confermate", overview?.confirmedContributions],
          ["Spese elettorali", overview?.expenses],
          ["Da pagare", overview?.outstandingExpenses],
          ["Servizi ricevuti", overview?.confirmedInKindContributions]
        ].map(([label, value]) => (
          <article className="rounded-xl border bg-white p-5 shadow-sm" key={label}>
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold">
              {typeof value === "string" ? money(value) : "—"}
            </p>
          </article>
        ))}
      </section>
      <section className="mt-8 rounded-xl border bg-white p-6">
        <h2 className="text-lg font-semibold">Registra un’operazione</h2>
        <p className="mt-2 text-sm text-slate-600">
          Ambiente demo: i dati sono salvati nella campagna di sviluppo.
        </p>
        <div className="mt-5 flex gap-3">
          <button className="rounded border px-4 py-2 text-sm" onClick={() => setMode("EXPENSE")}>
            Nuova spesa
          </button>
          <button
            className="rounded border px-4 py-2 text-sm"
            onClick={() => setMode("CONTRIBUTION")}
          >
            Nuovo contributo
          </button>
        </div>
        {mode && (
          <form className="mt-5 grid max-w-md gap-3 border-t pt-5" onSubmit={submit}>
            <label className="text-sm">
              Data
              <input
                className="mt-1 block w-full rounded border p-2"
                name="date"
                type="date"
                required
              />
            </label>
            <label className="text-sm">
              Importo
              <input
                className="mt-1 block w-full rounded border p-2"
                name="amount"
                placeholder="0.00"
                required
              />
            </label>
            {mode === "EXPENSE" && (
              <label className="text-sm">
                Descrizione
                <input
                  className="mt-1 block w-full rounded border p-2"
                  name="description"
                  required
                />
              </label>
            )}
            <button className="rounded bg-blue-800 px-4 py-2 text-sm font-semibold text-white">
              Registra
            </button>
          </form>
        )}
        {message && (
          <p className="mt-4 text-sm" role="status">
            {message}
          </p>
        )}
      </section>
    </>
  );
}
