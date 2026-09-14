import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { NewCampaignForm } from "@/components/wizard/new-campaign-form";
import { getSession } from "@/modules/auth/session";
import { listOrganizations } from "@/modules/organizations/service";

export default async function NewCampaignPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const organizations = await listOrganizations(session.userId);

  return (
    <DashboardShell>
      <header>
        <Link className="text-sm text-blue-800 underline" href="/dashboard">
          ← Le tue campagne
        </Link>
        <h1 className="mt-4 text-3xl font-semibold">Nuova campagna</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Pochi dati per cominciare. Il comune e le domande sul finanziamento arrivano subito dopo.
        </p>
      </header>
      <div className="mt-8">
        <NewCampaignForm
          organizations={organizations.map((organization) => ({
            id: organization.id,
            name: organization.name
          }))}
        />
      </div>
    </DashboardShell>
  );
}
