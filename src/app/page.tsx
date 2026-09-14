import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/modules/auth/session";
import { listPublicPlans, TRIAL_DAYS } from "@/modules/billing/service";

const price = (cents: number, currency: string) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency,
    minimumFractionDigits: 0
  }).format(cents / 100);

const intervalLabels: Record<string, string> = {
  CAMPAIGN: "per campagna elettorale",
  MONTH: "al mese",
  YEAR: "all'anno"
};

export default async function Home() {
  if (await getSession()) redirect("/dashboard");
  const plans = await listPublicPlans();

  return (
    <main className="min-h-screen bg-white">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <span className="text-lg font-semibold tracking-tight">Conforme</span>
        <div className="flex items-center gap-4 text-sm">
          <Link className="text-slate-700 hover:underline" href="/login">
            Accedi
          </Link>
          <Link
            className="rounded-md bg-blue-800 px-4 py-2 font-medium text-white"
            href="/registrati"
          >
            Prova gratis
          </Link>
        </div>
      </nav>

      <section className="mx-auto max-w-3xl px-6 pt-16 pb-14 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Il rendiconto elettorale si costruisce durante la campagna
        </h1>
        <p className="mt-6 text-lg text-slate-600">
          Non alla fine, ricostruendo scontrini e bonifici tre mesi dopo il voto. Registri spese e
          contributi mentre li fai, e la piattaforma tiene il conto degli obblighi al posto tuo.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link
            className="rounded-md bg-blue-800 px-6 py-3 font-medium text-white"
            href="/registrati"
          >
            Apri la tua campagna
          </Link>
          <Link className="rounded-md border px-6 py-3 font-medium" href="#piani">
            Vedi i piani
          </Link>
        </div>
        <p className="mt-4 text-sm text-slate-500">
          {TRIAL_DAYS} giorni di prova, senza carta di credito.
        </p>
      </section>

      <section className="border-y bg-slate-50">
        <div className="mx-auto grid max-w-5xl gap-8 px-6 py-14 sm:grid-cols-3">
          {[
            {
              title: "Sa quali regole ti si applicano",
              body: "Scegli il comune e rispondi a quattro domande: la piattaforma stabilisce se ti serve il mandatario elettorale e quali adempimenti ti riguardano."
            },
            {
              title: "Ti avvisa quando cambia qualcosa",
              body: "Hai dichiarato di autofinanziarti e incassi un contributo da un amico? La posizione viene rivalutata subito, non a fine campagna."
            },
            {
              title: "Lascia traccia di tutto",
              body: "Ogni valutazione registra quali regole sono state applicate e su quali dati. A distanza di mesi si puo' rifare il conto."
            }
          ].map((item) => (
            <article key={item.title}>
              <h2 className="font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16" id="piani">
        <h2 className="text-center text-3xl font-semibold">Piani</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-slate-600">
          Si paga la pratica elettorale, non la persona che accede: candidato, mandatario,
          commercialista e collaboratori lavorano sulla stessa campagna senza costi aggiuntivi.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {plans.map((plan) => (
            <article className="rounded-xl border p-7" key={plan.id}>
              <h3 className="text-xl font-semibold">{plan.name}</h3>
              <p className="mt-3 text-3xl font-semibold">
                {price(plan.priceCents, plan.currency)}
                <span className="ml-2 text-sm font-normal text-slate-500">
                  {intervalLabels[plan.interval] ?? ""}
                </span>
              </p>
              <p className="mt-4 text-sm text-slate-600">{plan.description}</p>
              <p className="mt-4 text-sm text-slate-500">
                {plan.campaignLimit === null
                  ? "Campagne illimitate"
                  : `${plan.campaignLimit} ${plan.campaignLimit === 1 ? "campagna" : "campagne"} attive`}
              </p>
              <Link
                className="mt-6 inline-block rounded-md border px-5 py-2 text-sm font-medium"
                href="/registrati"
              >
                Inizia la prova
              </Link>
            </article>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-slate-500">
          Prezzi indicativi in fase di definizione. L&apos;incasso non e&apos; ancora attivo: la
          registrazione apre un periodo di prova.
        </p>
      </section>

      <footer className="border-t">
        <div className="mx-auto max-w-5xl px-6 py-10 text-sm text-slate-500">
          <p>
            Conforme non sostituisce una valutazione legale. Le indicazioni normative sono prodotte
            da un motore di regole e restano soggette alla verifica di un professionista.
          </p>
        </div>
      </footer>
    </main>
  );
}
