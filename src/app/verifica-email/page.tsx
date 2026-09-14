"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function Verifier() {
  const token = useSearchParams().get("token");
  const [state, setState] = useState<"WORKING" | "DONE" | "FAILED">("WORKING");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setState("FAILED");
      setMessage("Il link non contiene alcun codice di verifica.");
      return;
    }
    void (async () => {
      const response = await fetch("/api/v1/auth/email-verification/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      if (response.ok) {
        setState("DONE");
        return;
      }
      const payload = await response.json();
      setState("FAILED");
      setMessage(payload?.error?.message ?? "Verifica non riuscita.");
    })();
  }, [token]);

  if (state === "WORKING") return <p className="mt-4 text-sm text-slate-600">Verifica in corso…</p>;
  if (state === "DONE")
    return (
      <>
        <p className="mt-4 rounded border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
          Indirizzo confermato.
        </p>
        <Link className="mt-6 inline-block text-blue-800 underline" href="/dashboard">
          Vai alle tue campagne
        </Link>
      </>
    );
  return (
    <>
      <p
        className="mt-4 rounded border border-red-300 bg-red-50 p-4 text-sm text-red-800"
        role="alert"
      >
        {message}
      </p>
      <Link className="mt-6 inline-block text-blue-800 underline" href="/dashboard">
        Torna alle tue campagne
      </Link>
    </>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="mx-auto mt-20 max-w-md rounded-xl border bg-white p-8">
      <h1 className="text-2xl font-semibold">Verifica dell&apos;indirizzo email</h1>
      <Suspense fallback={<p className="mt-4 text-sm text-slate-600">Caricamento…</p>}>
        <Verifier />
      </Suspense>
    </main>
  );
}
