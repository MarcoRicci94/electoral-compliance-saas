import { PlatformRole, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { resolveEntitlements } from "@/modules/billing/entitlements";

/**
 * Back-office di piattaforma.
 *
 * Il ruolo e' sull'utente ed e' separato dalle organizzazioni: non e' un
 * permesso che si ottiene essendo membro di qualcosa. Le funzioni qui dentro
 * attraversano i confini fra i tenant, quindi ciascuna comincia verificando il
 * ruolo e nessuna accetta un identificativo come prova di legittimazione.
 *
 * Cosa NON c'e', deliberatamente: l'accesso al contenuto delle campagne e
 * l'impersonificazione degli utenti. Qui si vede chi si e' abbonato e in che
 * stato e', non cosa ha speso o da chi ha ricevuto contributi. Una piattaforma
 * che custodisce la contabilita' di candidati avversari fra loro non puo'
 * avere un pannello da cui il gestore legge tutto senza lasciare traccia.
 * L'assistenza che richiede di vedere i dati di una campagna va costruita a
 * parte, con motivazione, durata limitata, traccia nel registro e visibilita'
 * all'utente interessato.
 */

export async function requirePlatformRole(
  userId: string,
  minimum: PlatformRole = PlatformRole.ADMIN
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { platformRole: true }
  });
  const ranking: Record<PlatformRole, number> = {
    [PlatformRole.NONE]: 0,
    [PlatformRole.SUPPORT]: 1,
    [PlatformRole.ADMIN]: 2
  };
  if (!user || ranking[user.platformRole] < ranking[minimum])
    throw new HttpError(403, "PLATFORM_ACCESS_DENIED", "Accesso al back-office negato");
  return user.platformRole;
}

export type SubscriberRow = {
  organizationId: string;
  organizationName: string;
  ownerEmail: string;
  ownerName: string;
  planName: string;
  /** `null` quando l'organizzazione non ha mai avuto un abbonamento: diverso da scaduto. */
  status: SubscriptionStatus | null;
  provider: string;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  activeCampaigns: number;
  canWrite: boolean;
  createdAt: Date;
};

export async function listSubscribers(
  actorUserId: string,
  now = new Date()
): Promise<SubscriberRow[]> {
  await requirePlatformRole(actorUserId, PlatformRole.SUPPORT);

  const organizations = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      createdAt: true,
      owner: { select: { email: true, firstName: true, lastName: true } },
      subscription: { include: { plan: true } },
      _count: { select: { campaigns: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 200
  });

  return organizations.map((organization) => {
    const subscription = organization.subscription;
    const entitlements = resolveEntitlements(
      subscription
        ? {
            status: subscription.status,
            trialEndsAt: subscription.trialEndsAt,
            currentPeriodEnd: subscription.currentPeriodEnd,
            campaignLimit: subscription.plan.campaignLimit,
            activeCampaigns: organization._count.campaigns
          }
        : null,
      now
    );

    return {
      organizationId: organization.id,
      organizationName: organization.name,
      ownerEmail: organization.owner.email,
      ownerName: `${organization.owner.firstName} ${organization.owner.lastName}`,
      planName: subscription?.plan.name ?? "—",
      status: subscription?.status ?? null,
      provider: subscription?.provider ?? "NONE",
      trialEndsAt: subscription?.trialEndsAt ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      activeCampaigns: organization._count.campaigns,
      canWrite: entitlements.canWrite,
      createdAt: organization.createdAt
    };
  });
}

export async function getPlatformSummary(actorUserId: string, now = new Date()) {
  await requirePlatformRole(actorUserId, PlatformRole.SUPPORT);
  const [organizations, campaigns, users, byStatus, expiringTrials] = await Promise.all([
    prisma.organization.count(),
    prisma.campaign.count(),
    prisma.user.count(),
    prisma.subscription.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.subscription.count({
      where: {
        status: SubscriptionStatus.TRIALING,
        trialEndsAt: { gte: now, lte: new Date(now.getTime() + 7 * 86_400_000) }
      }
    })
  ]);

  return {
    organizations,
    campaigns,
    users,
    expiringTrials,
    byStatus: Object.fromEntries(byStatus.map((row) => [row.status, row._count._all]))
  };
}
