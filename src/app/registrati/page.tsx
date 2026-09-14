"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
        firstName: form.get("firstName"),
        lastName: form.get("lastName")
      })
    });
    if (!response.ok) {
      const payload = await response.json();
      setError(payload?.error?.message ?? "Registrazione non riuscita");
      setBusy(false);
      return;
    }
    router.push("/dashboard/campagne/nuova");
    router.refresh();
  }

  return (
    <main className="mx-auto mt-16 mb-16 max-w-md rounded-xl border bg-white p-8">
      <h1 className="text-2xl font-semibold">Crea il tuo account</h1>
      <p className="mt-2 text-sm text-slate-600">
        Nessuna carta di credito: la registrazione apre un periodo di prova.
      </p>

      <form className="mt-7 space-y-4" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Nome
            <input className="mt-1 w-full rounded border p-2" name="firstName" required />
          </label>
          <label className="block text-sm font-medium">
            Cognome
            <input className="mt-1 w-full rounded border p-2" name="lastName" required />
          </label>
        </div>
        <label className="block text-sm font-medium">
          Email
          <input className="mt-1 w-full rounded border p-2" name="email" required type="email" />
        </label>
        <label className="block text-sm font-medium">
          Password
          <input
            className="mt-1 w-full rounded border p-2"
            minLength={12}
            name="password"
            required
            type="password"
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">
            Almeno 12 caratteri.
          </span>
        </label>

        {error && (
          <p
            className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800"
            role="alert"
          >
            {error}
          </p>
        )}

        <button
          className="w-full rounded bg-blue-800 p-2 font-medium text-white disabled:opacity-50"
          disabled={busy}
          type="submit"
        >
          {busy ? "Creazione…" : "Crea l'account"}
        </button>
      </form>

      <p className="mt-6 text-sm text-slate-600">
        Hai gia&apos; un account?{" "}
        <Link className="text-blue-800 underline" href="/login">
          Accedi
        </Link>
      </p>
      <p className="mt-4 text-xs text-slate-500">
        La verifica dell&apos;indirizzo email e l&apos;autenticazione a due fattori non sono ancora
        attive: arrivano prima dell&apos;apertura al pubblico.
      </p>
    </main>
  );
}
