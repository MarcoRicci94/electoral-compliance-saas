import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { getSession } from "@/modules/auth/session";
import { listUserCampaigns } from "@/modules/campaigns/service";

const electionLabels: Record<string, string> = {
  MUNICIPAL: "Comunali",
  POLITICAL: "Politiche",
  REGIONAL: "Regionali"
};

const officeLabels: Record<string, string> = {
  MAYOR: "Sindaco",
  MUNICIPAL_COUNCILLOR: "Consigliere comunale",
  DEPUTY: "Camera",
  SENATOR: "Senato",
  REGIONAL_PRESIDENT: "Presidente di Regione",
  REGIONAL_COUNCILLOR: "Consigliere regionale"
};

/**
 * Le quattro risposte sul mandatario restano distinte anche nell'elenco. In
 * particolare "non determinato" non deve somigliare a "non serve".
 */
const mandataryLabels: Record<string, { text: string; tone: string }> = {
  REQUIRED: { text: "Mandatario necessario", tone: "bg-amber-100 text-amber-900" },
  NOT_REQUIRED: { text: "Mandatario non necessario", tone: "bg-emerald-100 text-emerald-900" },
  NOT_APPLICABLE: { text: "Disciplina non applicabile", tone: "bg-slate-100 text-slate-700" },
  EVALUATION_INCOMPLETE: { text: "Regime non determinabile", tone: "bg-red-100 text-red-900" },
  UNKNOWN: { text: "Regime non ancora determinato", tone: "bg-slate-100 text-slate-700" }
};

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const campaigns = await listUserCampaigns(session.userId);

  return (
    <DashboardShell>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Dashboard</p>
          <h1 className="text-3xl font-semibold">Le tue campagne</h1>
        </div>
        <Link
          className="rounded-md bg-blue-800 px-4 py-2 text-sm font-semibold text-white"
          href="/dashboard/campagne/nuova"
        >
          + Nuova campagna
        </Link>
      </header>

      {campaigns.length === 0 ? (
        <section className="mt-9 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <h2 className="text-lg font-semibold">Non hai ancora una campagna</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
            Apri la tua candidatura: ti chiediamo il comune e poche domande sul finanziamento, e ti
            diciamo subito quali obblighi si applicano.
          </p>
          <Link
            className="mt-6 inline-block rounded-md bg-blue-800 px-5 py-2 text-sm font-semibold text-white"
            href="/dashboard/campagne/nuova"
          >
            Apri la tua campagna
          </Link>
        </section>
      ) : (
        <ul className="mt-9 grid gap-4 lg:grid-cols-2">
          {campaigns.map((campaign) => {
            const mandatary =
              mandataryLabels[campaign.mandataryRequirement] ?? mandataryLabels.UNKNOWN!;
            const steps = [
              { label: "Comune", done: campaign.hasTerritory },
              { label: "Questionario", done: campaign.hasSetup },
              {
                // Un regime non determinato non e' un passaggio concluso.
                label: "Mandatario",
                done:
                  campaign.mandataryRequirement === "NOT_REQUIRED" ||
                  campaign.mandataryRequirement === "NOT_APPLICABLE" ||
                  (campaign.mandataryRequirement === "REQUIRED" && campaign.hasMandatary)
              }
            ];
            const missing = steps.filter((item) => !item.done);

            return (
              <li className="rounded-xl border bg-white p-6" key={campaign.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold">{campaign.name}</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {electionLabels[campaign.electionType] ?? campaign.electionType} —{" "}
                      {officeLabels[campaign.officeSought] ?? campaign.officeSought}
                      {campaign.municipality && (
                        <>
                          {" "}
                          — {campaign.municipality}
                          {campaign.province && ` (${campaign.province})`}
                        </>
                      )}
                    </p>
                    {campaign.candidateProfile && (
                      <p className="mt-1 text-sm text-slate-500">
                        {campaign.candidateProfile.firstName} {campaign.candidateProfile.lastName}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${mandatary.tone}`}
                  >
                    {mandatary.text}
                  </span>
                </div>

                <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  {steps.map((step) => (
                    <li className="flex items-center gap-2" key={step.label}>
                      <span
                        aria-hidden
                        className={step.done ? "text-emerald-600" : "text-slate-400"}
                      >
                        {step.done ? "✓" : "○"}
                      </span>
                      <span className={step.done ? "text-slate-700" : "text-slate-500"}>
                        {step.label}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-5 flex flex-wrap items-center gap-4">
                  <Link
                    className="rounded border px-4 py-2 text-sm font-medium"
                    href={`/dashboard/campagne/${campaign.organizationId}/${campaign.id}/apertura`}
                  >
                    {campaign.setupCompletedAt ? "Rivedi l'apertura" : "Continua l'apertura"}
                  </Link>
                  {missing.length > 0 && (
                    <p className="text-sm text-slate-600">
                      Da completare: {missing.map((item) => item.label).join(", ")}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardShell>
  );
}
