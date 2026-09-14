import Link from "next/link";
import { redirect } from "next/navigation";
import { RulesetConsole } from "@/components/admin/ruleset-console";
import { HttpError } from "@/lib/http";
import { getRuleset } from "@/modules/administration/rulesets";
import { getSession } from "@/modules/auth/session";

export default async function RulesetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;

  let data: Awaited<ReturnType<typeof getRuleset>>;
  try {
    data = await getRuleset(session.userId, id);
  } catch (error) {
    if (error instanceof HttpError && error.status === 403)
      return (
        <main className="mx-auto mt-20 max-w-lg rounded-xl bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold">Console legale non accessibile</h1>
        </main>
      );
    throw error;
  }

  const { ruleset, readiness } = data;

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <header className="mb-8">
        <Link className="text-sm text-blue-800 underline" href="/admin/regole">
          ← Console legale
        </Link>
        <h1 className="mt-4 text-3xl font-semibold">{ruleset.name}</h1>
        <p className="mt-2 text-sm text-slate-600">
          {ruleset.jurisdiction} · {ruleset.electionType} · versione {ruleset.version} · stato{" "}
          {ruleset.status}
          {ruleset.reviewedAt && (
            <> · rivisto il {new Date(ruleset.reviewedAt).toLocaleDateString("it-IT")}</>
          )}
        </p>
      </header>

      <div className="max-w-4xl">
        <RulesetConsole
          parameters={ruleset.parameters.map((parameter) => ({
            id: parameter.id,
            code: parameter.code,
            value: JSON.stringify(parameter.value).replace(/^"|"$/g, ""),
            unit: parameter.unit,
            note: parameter.note,
            verifiedAt: parameter.verifiedAt?.toISOString() ?? null
          }))}
          readiness={readiness}
          rules={ruleset.rules.map((rule) => ({
            id: rule.id,
            ruleCode: rule.ruleCode,
            name: rule.name,
            description: rule.description,
            category: rule.category,
            severityDefault: rule.severityDefault,
            effectType: rule.effectType,
            isActive: rule.isActive,
            source: rule.legalSource
              ? {
                  id: rule.legalSource.id,
                  title: rule.legalSource.title,
                  sourceType: rule.legalSource.sourceType,
                  officialUrl: rule.legalSource.officialUrl,
                  verifiedAt: rule.legalSource.verifiedAt?.toISOString() ?? null
                }
              : null
          }))}
          rulesetId={ruleset.id}
          status={ruleset.status}
        />
      </div>
    </main>
  );
}
