import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { getSession } from "@/modules/auth/session";
import { listOrganizations } from "@/modules/organizations/service";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const organizations = await listOrganizations(session.userId);
  return (
    <DashboardShell>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Dashboard</p>
          <h1 className="text-3xl font-semibold">Le tue campagne</h1>
        </div>
        <button className="rounded-md bg-blue-800 px-4 py-2 text-sm font-semibold text-white">
          + Registra operazione
        </button>
      </header>
      <section className="mt-9 rounded-xl border border-dashed border-slate-300 bg-white p-6">
        <h2 className="font-semibold">Organizzazioni</h2>
        {organizations.length ? (
          <ul className="mt-3 space-y-2">
            {organizations.map((organization) => (
              <li key={organization.id} className="rounded bg-slate-50 p-3">
                {organization.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            Crea la tua organizzazione per avviare una campagna.
          </p>
        )}
      </section>
    </DashboardShell>
  );
}
