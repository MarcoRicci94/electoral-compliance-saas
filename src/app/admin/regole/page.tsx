import Link from "next/link";
import { redirect } from "next/navigation";
import { HttpError } from "@/lib/http";
import { listRulesets } from "@/modules/administration/rulesets";
import { getSession } from "@/modules/auth/session";

const statusLabels: Record<string, { text: string; tone: string }> = {
  DRAFT: { text: "Bozza", tone: "bg-slate-200 text-slate-700" },
  UNDER_REVIEW: { text: "In revisione", tone: "bg-blue-100 text-blue-900" },
  ACTIVE: { text: "Attivo", tone: "bg-emerald-100 text-emerald-900" },
  SUPERSEDED: { text: "Superato", tone: "bg-amber-100 text-amber-900" },
  ARCHIVED: { text: "Archiviato", tone: "bg-slate-200 text-slate-700" }
};

const electionLabels: Record<string, string> = {
  MUNICIPAL: "Comunali",
  POLITICAL: "Politiche",
  REGIONAL: "Regionali"
};

export default async function RulesetsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let rulesets: Awaited<ReturnType<typeof listRulesets>>;
  try {
    rulesets = await listRulesets(session.userId);
  } catch (error) {
    if (error instanceof HttpError && error.status === 403)
      return (
        <main className="mx-auto mt-20 max-w-lg rounded-xl bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold">Console legale non accessibile</h1>
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
        <Link className="text-sm text-blue-800 underline" href="/admin">
          ← Back-office
        </Link>
        <h1 className="mt-4 text-3xl font-semibold">Console legale</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Finche&apos; un ruleset resta in bozza, le campagne non ricevono alcuna indicazione
          normativa. L&apos;attivazione e&apos; un atto che resta registrato con il tuo nome.
        </p>
      </header>

      <ul className="mt-8 grid gap-4 lg:grid-cols-2">
        {rulesets.map((ruleset) => {
          const status = statusLabels[ruleset.status] ?? statusLabels.DRAFT!;
          const activeRules = ruleset.rules.filter((rule) => rule.isActive).length;
          return (
            <li className="rounded-xl border bg-white p-6" key={ruleset.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-semibold">{ruleset.name}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {electionLabels[ruleset.electionType] ?? ruleset.electionType} ·{" "}
                    {ruleset.jurisdiction} · versione {ruleset.version}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${status.tone}`}
                >
                  {status.text}
                </span>
              </div>
              <p className="mt-4 text-sm text-slate-600">
                {activeRules} di {ruleset._count.rules} regole attive · {ruleset._count.parameters}{" "}
                parametri · {ruleset._count.campaigns} campagne agganciate
              </p>
              <Link
                className="mt-5 inline-block rounded border px-4 py-2 text-sm font-medium"
                href={`/admin/regole/${ruleset.id}`}
              >
                Apri
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
