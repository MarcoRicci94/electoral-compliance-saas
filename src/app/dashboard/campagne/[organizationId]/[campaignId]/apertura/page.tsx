import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { SetupWizard } from "@/components/wizard/setup-wizard";
import { prisma } from "@/lib/db";
import { getSession } from "@/modules/auth/session";
import { getSetupStatus } from "@/modules/campaigns/setup";
import { getCampaign } from "@/modules/campaigns/service";
import { getMunicipality } from "@/modules/territories/service";

export default async function SetupPage({
  params
}: {
  params: Promise<{ organizationId: string; campaignId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { organizationId, campaignId } = await params;

  const campaign = await getCampaign(session.userId, organizationId, campaignId);
  if (!campaign) notFound();

  const [status, setup] = await Promise.all([
    getSetupStatus(session.userId, organizationId, campaignId),
    prisma.campaignSetup.findUnique({ where: { campaignId } })
  ]);
  const municipality = campaign.territoryId ? await getMunicipality(campaign.territoryId) : null;

  return (
    <DashboardShell>
      <header>
        <Link className="text-sm text-blue-800 underline" href="/dashboard">
          ← Le tue campagne
        </Link>
        <p className="mt-4 text-sm text-slate-500">Apertura della campagna</p>
        <h1 className="text-3xl font-semibold">{campaign.name}</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Tre passaggi. Al termine sai quali obblighi si applicano alla tua candidatura e se ti
          serve il mandatario elettorale.
        </p>
      </header>

      <div className="mt-8 max-w-3xl">
        <SetupWizard
          answers={
            setup
              ? {
                  expectsOwnSpending: setup.expectsOwnSpending,
                  plannedOwnSpending: setup.plannedOwnSpending?.toString() ?? null,
                  expectsThirdPartyContributions: setup.expectsThirdPartyContributions,
                  expectsPartyOrListSupport: setup.expectsPartyOrListSupport,
                  expectsInKindContributions: setup.expectsInKindContributions
                }
              : null
          }
          campaignId={campaignId}
          initialStatus={{
            steps: status.steps,
            complete: status.complete,
            mandatary: {
              requirement: status.mandatary.requirement,
              ruleCodes: status.mandatary.ruleCodes,
              evaluatedAt: status.mandatary.evaluatedAt?.toISOString() ?? null,
              profileExists: status.mandatary.profileExists
            }
          }}
          municipality={municipality}
          organizationId={organizationId}
        />
      </div>
    </DashboardShell>
  );
}
