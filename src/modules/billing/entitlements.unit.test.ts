import { describe, expect, it } from "vitest";
import {
  PAST_DUE_GRACE_DAYS,
  resolveEntitlements,
  type SubscriptionSnapshot
} from "@/modules/billing/entitlements";

const now = new Date("2027-05-10T12:00:00Z");
const days = (count: number) => new Date(now.getTime() + count * 86_400_000);

const snapshot = (overrides: Partial<NonNullable<SubscriptionSnapshot>>) =>
  ({
    status: "ACTIVE",
    currentPeriodEnd: days(20),
    campaignLimit: 1,
    activeCampaigns: 0,
    ...overrides
  }) satisfies NonNullable<SubscriptionSnapshot>;

describe("i dati non si sequestrano mai", () => {
  /**
   * Vale per ogni stato possibile, compresi quelli in cui non si e' pagato: la
   * piattaforma custodisce la contabilita' di una campagna elettorale, che serve
   * a un adempimento di legge.
   */
  const states = ["TRIALING", "ACTIVE", "PAST_DUE", "CANCELED", "EXPIRED"] as const;

  it("lettura ed esportazione restano consentite in ogni stato", () => {
    for (const status of states) {
      const result = resolveEntitlements(
        snapshot({ status, currentPeriodEnd: days(-400), trialEndsAt: days(-400) }),
        now
      );
      expect(result.canRead, status).toBe(true);
      expect(result.canExport, status).toBe(true);
    }
  });

  it("restano consentite anche senza alcun abbonamento", () => {
    const result = resolveEntitlements(null, now);
    expect(result.canRead).toBe(true);
    expect(result.canExport).toBe(true);
    expect(result.canWrite).toBe(false);
  });
});

describe("prova gratuita", () => {
  it("consente la scrittura finche' non scade", () => {
    const result = resolveEntitlements(snapshot({ status: "TRIALING", trialEndsAt: days(3) }), now);
    expect(result.canWrite).toBe(true);
    expect(result.canCreateCampaign).toBe(true);
  });

  it("blocca la scrittura quando e' scaduta", () => {
    const result = resolveEntitlements(
      snapshot({ status: "TRIALING", trialEndsAt: days(-1) }),
      now
    );
    expect(result.canWrite).toBe(false);
    expect(result.reason).toMatch(/prova/);
  });

  it("il confine e' il momento esatto della scadenza", () => {
    expect(
      resolveEntitlements(snapshot({ status: "TRIALING", trialEndsAt: now }), now).canWrite
    ).toBe(false);
    expect(
      resolveEntitlements(
        snapshot({ status: "TRIALING", trialEndsAt: new Date(now.getTime() + 1) }),
        now
      ).canWrite
    ).toBe(true);
  });
});

describe("pagamento non riuscito", () => {
  /**
   * Bloccare subito la scrittura significherebbe impedire di registrare una
   * spesa nel giorno in cui viene sostenuta, cioe' causare esattamente il
   * problema che il prodotto esiste per evitare.
   */
  it("durante la tolleranza si continua a registrare, con l'avviso", () => {
    const result = resolveEntitlements(
      snapshot({ status: "PAST_DUE", currentPeriodEnd: days(-2) }),
      now
    );
    expect(result.canWrite).toBe(true);
    expect(result.reason).toMatch(/pagamento/i);
    expect(result.writeGraceUntil?.toISOString()).toBe(
      days(-2 + PAST_DUE_GRACE_DAYS).toISOString()
    );
  });

  it("durante la tolleranza non si aprono nuove campagne", () => {
    const result = resolveEntitlements(
      snapshot({ status: "PAST_DUE", currentPeriodEnd: days(-2), campaignLimit: null }),
      now
    );
    expect(result.canWrite).toBe(true);
    expect(result.canCreateCampaign).toBe(false);
  });

  it("alla scadenza della tolleranza la scrittura si ferma", () => {
    const result = resolveEntitlements(
      snapshot({ status: "PAST_DUE", currentPeriodEnd: days(-PAST_DUE_GRACE_DAYS - 1) }),
      now
    );
    expect(result.canWrite).toBe(false);
    expect(result.canRead).toBe(true);
  });
});

describe("abbonamento chiuso o scaduto", () => {
  it("non consente la scrittura", () => {
    for (const status of ["CANCELED", "EXPIRED"] as const) {
      const result = resolveEntitlements(snapshot({ status }), now);
      expect(result.canWrite, status).toBe(false);
      expect(result.canCreateCampaign, status).toBe(false);
    }
  });

  it("un periodo gia' concluso vale come scaduto anche in stato attivo", () => {
    const result = resolveEntitlements(
      snapshot({ status: "ACTIVE", currentPeriodEnd: days(-1) }),
      now
    );
    expect(result.canWrite).toBe(false);
  });

  it("un abbonamento attivo senza scadenza non scade da solo", () => {
    const result = resolveEntitlements(snapshot({ status: "ACTIVE", currentPeriodEnd: null }), now);
    expect(result.canWrite).toBe(true);
  });
});

describe("limite di campagne", () => {
  it("consente di aprirne una finche' il piano lo permette", () => {
    expect(
      resolveEntitlements(snapshot({ campaignLimit: 2, activeCampaigns: 1 }), now).canCreateCampaign
    ).toBe(true);
  });

  it("blocca l'apertura quando il piano e' saturo, senza bloccare la scrittura", () => {
    const result = resolveEntitlements(snapshot({ campaignLimit: 2, activeCampaigns: 2 }), now);
    expect(result.canCreateCampaign).toBe(false);
    expect(result.canWrite).toBe(true);
    expect(result.reason).toMatch(/2 campagne/);
  });

  it("un piano senza limite non si satura", () => {
    expect(
      resolveEntitlements(snapshot({ campaignLimit: null, activeCampaigns: 99 }), now)
        .canCreateCampaign
    ).toBe(true);
  });
});
