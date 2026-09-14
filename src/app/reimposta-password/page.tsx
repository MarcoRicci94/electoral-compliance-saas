"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("confirm") ?? "")) {
      setError("Le due password non coincidono.");
      return;
    }
    setBusy(true);
    const response = await fetch("/api/v1/auth/password-reset/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password })
    });
    if (!response.ok) {
      const payload = await response.json();
      setError(payload?.error?.message ?? "Reimpostazione non riuscita.");
      setBusy(false);
      return;
    }
    router.push("/login?reimpostata=1");
  }

  if (!token)
    return (
      <p className="mt-4 rounded border border-red-300 bg-red-50 p-4 text-sm text-red-800">
        Il link non contiene alcun codice. Richiedine uno nuovo dalla pagina di recupero.
      </p>
    );

  return (
    <form className="mt-7 space-y-4" onSubmit={submit}>
      <label className="block text-sm font-medium">
        Nuova password
        <input
          className="mt-1 w-full rounded border p-2"
          minLength={12}
          name="password"
          required
          type="password"
        />
        <span className="mt-1 block text-xs font-normal text-slate-500">Almeno 12 caratteri.</span>
      </label>
      <label className="block text-sm font-medium">
        Ripeti la password
        <input
          className="mt-1 w-full rounded border p-2"
          minLength={12}
          name="confirm"
          required
          type="password"
        />
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
        {busy ? "Salvataggio…" : "Imposta la nuova password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto mt-20 max-w-md rounded-xl border bg-white p-8">
      <h1 className="text-2xl font-semibold">Scegli una nuova password</h1>
      <Suspense fallback={<p className="mt-4 text-sm text-slate-600">Caricamento…</p>}>
        <ResetForm />
      </Suspense>
      <p className="mt-6 text-sm">
        <Link className="text-blue-800 underline" href="/login">
          Torna all&apos;accesso
        </Link>
      </p>
    </main>
  );
}
