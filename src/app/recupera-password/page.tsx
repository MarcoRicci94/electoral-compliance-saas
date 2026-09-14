"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export default function RecoverPasswordPage() {
  const [message, setMessage] = useState("");
  const [devLink, setDevLink] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/v1/auth/password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email") })
    });
    const payload = await response.json();
    setMessage(
      response.ok
        ? (payload.data?.deliveryMessage ?? "Richiesta ricevuta.")
        : (payload?.error?.message ?? "Richiesta non riuscita.")
    );
    setDevLink(payload.data?.developmentLink ?? "");
    setBusy(false);
  }

  return (
    <main className="mx-auto mt-20 max-w-md rounded-xl border bg-white p-8">
      <h1 className="text-2xl font-semibold">Password dimenticata</h1>
      <p className="mt-2 text-sm text-slate-600">
        Inserisci il tuo indirizzo: se corrisponde a un account, ti mandiamo un link per scegliere
        una nuova password.
      </p>
      <form className="mt-7 space-y-4" onSubmit={submit}>
        <label className="block text-sm font-medium">
          Email
          <input className="mt-1 w-full rounded border p-2" name="email" required type="email" />
        </label>
        <button
          className="w-full rounded bg-blue-800 p-2 font-medium text-white disabled:opacity-50"
          disabled={busy}
          type="submit"
        >
          {busy ? "Invio…" : "Invia il link"}
        </button>
      </form>

      {message && (
        <p className="mt-5 rounded border bg-slate-50 p-4 text-sm text-slate-700">{message}</p>
      )}
      {devLink && (
        <p className="mt-3 rounded border border-amber-300 bg-amber-50 p-4 text-sm break-all">
          Ambiente di sviluppo, nessuna email spedita. Apri questo link:{" "}
          <a className="text-blue-800 underline" href={devLink}>
            {devLink}
          </a>
        </p>
      )}

      <p className="mt-6 text-sm">
        <Link className="text-blue-800 underline" href="/login">
          Torna all&apos;accesso
        </Link>
      </p>
    </main>
  );
}
