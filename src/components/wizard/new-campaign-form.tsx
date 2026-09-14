"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Organization = { id: string; name: string };

const offices = {
  MUNICIPAL: [
    { value: "MAYOR", label: "Candidato sindaco" },
    { value: "MUNICIPAL_COUNCILLOR", label: "Candidato consigliere comunale" }
  ],
  POLITICAL: [
    { value: "DEPUTY", label: "Camera dei deputati" },
    { value: "SENATOR", label: "Senato della Repubblica" }
  ],
  REGIONAL: [
    { value: "REGIONAL_PRESIDENT", label: "Candidato presidente di Regione" },
    { value: "REGIONAL_COUNCILLOR", label: "Candidato consigliere regionale" }
  ]
} as const;

type ElectionType = keyof typeof offices;

async function call(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message ?? "Operazione non riuscita");
  return payload.data;
}

export function NewCampaignForm({ organizations }: { organizations: Organization[] }) {
  const router = useRouter();
  const [electionType, setElectionType] = useState<ElectionType>("MUNICIPAL");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const firstName = String(form.get("firstName") ?? "").trim();
    const lastName = String(form.get("lastName") ?? "").trim();

    try {
      /**
       * Il candidato singolo non sa di avere un'organizzazione: e' il contenitore
       * che tiene insieme campagna, mandatario e collaboratori. Se non ne ha una,
       * gliela creiamo con il suo nome senza chiedergliene conto.
       */
      const organizationId =
        String(form.get("organizationId") ?? "") ||
        (
          await call("/api/v1/organizations", {
            name: `${firstName} ${lastName}`.trim() || "La mia candidatura",
            type: "INDIVIDUAL"
          })
        ).id;

      const campaign = await call(`/api/v1/organizations/${organizationId}/campaigns`, {
        name: String(form.get("name") ?? "").trim(),
        electionType,
        officeSought: String(form.get("officeSought") ?? ""),
        electionDate: String(form.get("electionDate") ?? "") || undefined,
        candidate: { firstName, lastName }
      });

      router.push(`/dashboard/campagne/${organizationId}/${campaign.id}/apertura`);
      router.refresh();
    } catch (problem) {
      setError((problem as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="max-w-xl space-y-5" onSubmit={submit}>
      {error && (
        <p
          className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      )}

      <label className="block text-sm font-medium">
        Nome della campagna
        <input
          className="mt-1 w-full rounded border p-2"
          name="name"
          placeholder="Comunali Firenze 2027"
          required
        />
      </label>

      <fieldset>
        <legend className="text-sm font-medium">Tipo di elezione</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              ["MUNICIPAL", "Comunali"],
              ["POLITICAL", "Politiche"],
              ["REGIONAL", "Regionali"]
            ] as const
          ).map(([value, label]) => (
            <button
              className={`rounded-full border px-4 py-2 text-sm ${
                electionType === value ? "border-blue-800 bg-blue-50 font-medium" : "bg-white"
              }`}
              key={value}
              onClick={() => setElectionType(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
        {electionType === "REGIONAL" && (
          <p className="mt-2 text-sm text-amber-800">
            Il modulo Regionali non ha ancora un proprio insieme di regole: puoi aprire la campagna,
            ma non riceverai indicazioni normative finche&apos; non sara&apos; disponibile.
          </p>
        )}
      </fieldset>

      <label className="block text-sm font-medium">
        Per quale carica
        <select className="mt-1 w-full rounded border bg-white p-2" name="officeSought" required>
          {offices[electionType].map((office) => (
            <option key={office.value} value={office.value}>
              {office.label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Nome del candidato
          <input className="mt-1 w-full rounded border p-2" name="firstName" required />
        </label>
        <label className="block text-sm font-medium">
          Cognome del candidato
          <input className="mt-1 w-full rounded border p-2" name="lastName" required />
        </label>
      </div>

      <label className="block text-sm font-medium">
        Data delle elezioni <span className="font-normal text-slate-500">(se gia&apos; nota)</span>
        <input className="mt-1 w-full rounded border p-2" name="electionDate" type="date" />
      </label>

      {organizations.length > 0 && (
        <label className="block text-sm font-medium">
          Organizzazione
          <select
            className="mt-1 w-full rounded border bg-white p-2"
            defaultValue={organizations[0]!.id}
            name="organizationId"
          >
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <button
        className="rounded bg-blue-800 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
        disabled={busy}
        type="submit"
      >
        {busy ? "Creazione…" : "Crea e prosegui"}
      </button>
    </form>
  );
}
