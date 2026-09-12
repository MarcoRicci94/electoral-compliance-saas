"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form))
    });
    if (!response.ok) {
      setError((await response.json()).error.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }
  return (
    <main className="mx-auto mt-20 max-w-md rounded-xl bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold">Accedi a Conforme</h1>
      <p className="mt-2 text-sm text-slate-600">Gestione della compliance elettorale.</p>
      <form className="mt-7 space-y-4" onSubmit={submit}>
        <label className="block text-sm font-medium">
          Email
          <input className="mt-1 w-full rounded border p-2" name="email" type="email" required />
        </label>
        <label className="block text-sm font-medium">
          Password
          <input
            className="mt-1 w-full rounded border p-2"
            name="password"
            type="password"
            required
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <button className="w-full rounded bg-blue-800 p-2 font-medium text-white">Accedi</button>
      </form>
    </main>
  );
}
