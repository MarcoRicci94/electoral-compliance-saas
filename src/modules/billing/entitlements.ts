/**
 * Cosa puo' fare un'organizzazione in base al suo abbonamento.
 *
 * Due principi, entrambi deliberati.
 *
 * La lettura e l'esportazione non si tolgono mai. Questa piattaforma custodisce
 * la contabilita' elettorale di una campagna: un candidato che non rinnova deve
 * poter comunque rileggere ed esportare i propri dati, anche solo per
 * depositarli altrove. Sequestrarli per una fattura non pagata sarebbe
 * indifendibile, e su dati che servono a un adempimento di legge sarebbe anche
 * pericoloso.
 *
 * Un pagamento fallito non blocca subito la scrittura. Una carta scaduta durante
 * la campagna non deve impedire di registrare una spesa nel giorno in cui viene
 * sostenuta: la registrazione tardiva e' proprio il problema che il prodotto
 * esiste per evitare. Si avvisa, si concede un margine, e solo alla scadenza del
 * margine la scrittura si ferma.
 */

export type SubscriptionState = "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "EXPIRED";

export type SubscriptionSnapshot = {
  status: SubscriptionState;
  trialEndsAt?: Date | null;
  currentPeriodEnd?: Date | null;
  /** Numero massimo di campagne attive consentite dal piano; `null` = nessun limite. */
  campaignLimit?: number | null;
  activeCampaigns: number;
} | null;

export type Entitlements = {
  canRead: boolean;
  canExport: boolean;
  canWrite: boolean;
  canCreateCampaign: boolean;
  /** Motivo per cui la scrittura e' limitata, da mostrare all'utente. */
  reason?: string;
  /** Fino a quando la scrittura resta consentita nonostante il pagamento non riuscito. */
  writeGraceUntil?: Date;
};

/** Giorni di margine concessi dopo un pagamento non riuscito. */
export const PAST_DUE_GRACE_DAYS = 14;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export function resolveEntitlements(
  subscription: SubscriptionSnapshot,
  now = new Date()
): Entitlements {
  const base = { canRead: true, canExport: true };

  if (!subscription)
    return {
      ...base,
      canWrite: false,
      canCreateCampaign: false,
      reason: "Nessun abbonamento attivo per questa organizzazione."
    };

  const withinCampaignLimit =
    subscription.campaignLimit === null ||
    subscription.campaignLimit === undefined ||
    subscription.activeCampaigns < subscription.campaignLimit;

  const limitReason = withinCampaignLimit
    ? undefined
    : `Il piano consente ${subscription.campaignLimit} campagne attive e sono gia' tutte in uso.`;

  switch (subscription.status) {
    case "TRIALING": {
      const expired = subscription.trialEndsAt ? subscription.trialEndsAt <= now : false;
      if (expired)
        return {
          ...base,
          canWrite: false,
          canCreateCampaign: false,
          reason: "Il periodo di prova e' terminato. I dati restano leggibili ed esportabili."
        };
      return {
        ...base,
        canWrite: true,
        canCreateCampaign: withinCampaignLimit,
        reason: limitReason
      };
    }

    case "ACTIVE": {
      const expired = subscription.currentPeriodEnd ? subscription.currentPeriodEnd <= now : false;
      if (expired)
        return {
          ...base,
          canWrite: false,
          canCreateCampaign: false,
          reason: "L'abbonamento risulta scaduto. I dati restano leggibili ed esportabili."
        };
      return {
        ...base,
        canWrite: true,
        canCreateCampaign: withinCampaignLimit,
        reason: limitReason
      };
    }

    case "PAST_DUE": {
      const graceUntil = addDays(subscription.currentPeriodEnd ?? now, PAST_DUE_GRACE_DAYS);
      if (graceUntil <= now)
        return {
          ...base,
          canWrite: false,
          canCreateCampaign: false,
          reason:
            "Il pagamento non e' andato a buon fine e il periodo di tolleranza e' terminato. I dati restano leggibili ed esportabili."
        };
      return {
        ...base,
        canWrite: true,
        /** Durante la tolleranza si tiene in piedi l'esistente, non si aggiunge altro. */
        canCreateCampaign: false,
        reason: "Il pagamento non e' andato a buon fine: aggiorna il metodo di pagamento.",
        writeGraceUntil: graceUntil
      };
    }

    case "CANCELED":
    case "EXPIRED":
      return {
        ...base,
        canWrite: false,
        canCreateCampaign: false,
        reason: "L'abbonamento non e' piu' attivo. I dati restano leggibili ed esportabili."
      };
  }
}
