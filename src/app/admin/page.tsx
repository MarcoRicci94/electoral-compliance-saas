import { redirect } from "next/navigation";
import { HttpError } from "@/lib/http";
import { getSession } from "@/modules/auth/session";
import { getPlatformSummary, listSubscribers } from "@/modules/administration/service";

const statusLabels: Record<string, { text: string; tone: string }> = {
  TRIALING: { text: "In prova", tone: "bg-blue-100 text-blue-900" },
  ACTIVE: { text: "Attivo", tone: "bg-emerald-100 text-emerald-900" },
  PAST_DUE: { text: "Pagamento non riuscito", tone: "bg-amber-100 text-amber-900" },
  CANCELED: { text: "Disdetto", tone: "bg-slate-200 text-slate-700" },
  EXPIRED: { text: "Scaduto", tone: "bg-slate-200 text-slate-700" },
  NONE: { text: "Nessun abbonamento", tone: "bg-slate-100 text-slate-600" }
};

const dateFormat = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" });
const showDate = (value: Date | null) => (value ? dateFormat.format(value) : "—");

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let subscribers: Awaited<ReturnType<typeof listSubscribers>>;
  let summary: Awaited<ReturnType<typeof getPlatformSummary>>;
  try {
    [subscribers, summary] = await Promise.all([
      listSubscribers(session.userId),
      getPlatformSummary(session.userId)
    ]);
  } catch (error) {
    if (error instanceof HttpError && error.status === 403)
      return (
        <main className="mx-auto mt-20 max-w-lg rounded-xl bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold">Back-office non accessibile</h1>
          <p className="mt-2 text-sm text-slate-600">
            Questa area e&apos; riservata agli amministratori della piattaforma.
          </p>
        </main>
      );
    throw error;
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <header>
        <p className="text-sm text-slate-500">Back-office</p>
        <h1 className="text-3xl font-semibold">Abbonati</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Chi si e&apos; registrato e in che stato e&apos; il suo abbonamento. Da qui non si accede
          al contenuto delle campagne.
        </p>
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Organizzazioni", summary.organizations],
          ["Campagne", summary.campaigns],
          ["Utenti", summary.users],
          ["Prove in scadenza (7 giorni)", summary.expiringTrials]
        ].map(([label, value]) => (
          <article className="rounded-xl border bg-white p-5" key={String(label)}>
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </article>
        ))}
      </section>

      <section className="mt-8 overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b bg-slate-50 text-slate-600">
            <tr>
              <th className="p-3 font-medium">Organizzazione</th>
              <th className="p-3 font-medium">Titolare</th>
              <th className="p-3 font-medium">Piano</th>
              <th className="p-3 font-medium">Stato</th>
              <th className="p-3 font-medium">Scadenza</th>
              <th className="p-3 font-medium">Campagne</th>
              <th className="p-3 font-medium">Scrittura</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {subscribers.length === 0 && (
              <tr>
                <td className="p-6 text-center text-slate-500" colSpan={7}>
                  Nessuna organizzazione registrata.
                </td>
              </tr>
            )}
            {subscribers.map((row) => {
              const status = statusLabels[row.status ?? "NONE"] ?? statusLabels.NONE!;
              return (
                <tr key={row.organizationId}>
                  <td className="p-3 font-medium">{row.organizationName}</td>
                  <td className="p-3">
                    <span className="block">{row.ownerName}</span>
                    <span className="text-slate-500">{row.ownerEmail}</span>
                  </td>
                  <td className="p-3">{row.planName}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${status.tone}`}>
                      {status.text}
                    </span>
                  </td>
                  <td className="p-3">
                    {row.status === "TRIALING"
                      ? showDate(row.trialEndsAt)
                      : showDate(row.currentPeriodEnd)}
                  </td>
                  <td className="p-3">{row.activeCampaigns}</td>
                  <td className="p-3">
                    {row.canWrite ? (
                      <span className="text-emerald-700">consentita</span>
                    ) : (
                      <span className="text-slate-500">solo lettura</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <p className="mt-6 max-w-3xl text-xs text-slate-500">
        L&apos;incasso dei pagamenti non e&apos; ancora collegato: gli abbonamenti risultano in
        prova e la colonna del fornitore resta vuota finche&apos; non viene configurato.
      </p>
    </main>
  );
}
