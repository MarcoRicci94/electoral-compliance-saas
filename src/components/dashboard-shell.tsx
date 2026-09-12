import Link from "next/link";

const navigation = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Cose da fare", href: "/dashboard/tasks" },
  { label: "Campagna", href: "/dashboard/campaign" },
  { label: "Finanze", href: "/dashboard/finance" },
  { label: "Conto corrente", href: "/dashboard/banking" },
  { label: "Documenti", href: "/dashboard/documents" },
  { label: "Compliance", href: "/dashboard/compliance" },
  { label: "Rendiconto", href: "/dashboard/reporting" },
  { label: "Assistente", href: "/dashboard/assistant" }
];

export function DashboardShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-slate-50 md:grid md:grid-cols-[248px_1fr]">
      <aside className="bg-slate-950 px-5 py-6 text-slate-100">
        <Link className="mb-9 block text-xl font-semibold tracking-tight" href="/dashboard">
          Conforme
        </Link>
        <nav aria-label="Navigazione principale" className="space-y-1">
          {navigation.map((item) => (
            <Link
              className="block rounded-md px-3 py-2 text-sm hover:bg-slate-800"
              href={item.href}
              key={item.label}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <nav
          aria-label="Navigazione secondaria"
          className="mt-8 border-t border-slate-700 pt-5 text-sm"
        >
          <a className="block px-3 py-2 hover:text-white" href="#">
            Impostazioni
          </a>
          <a className="block px-3 py-2 hover:text-white" href="#">
            Utenti
          </a>
          <a className="block px-3 py-2 hover:text-white" href="#">
            Assistenza
          </a>
        </nav>
      </aside>
      <main className="p-5 md:p-10">{children}</main>
    </div>
  );
}
