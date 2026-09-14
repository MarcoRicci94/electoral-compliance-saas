import { CampaignStatus, SubscriptionStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { requireOrganizationMember } from "@/modules/access/service";
import {
  resolveEntitlements,
  type Entitlements,
  type SubscriptionState
} from "@/modules/billing/entitlements";

/**
 * Stato dell'abbonamento.
 *
 * Lo stato autorevole e' quello registrato qui, non quello che risponderebbe il
 * fornitore dei pagamenti interrogato al momento: un'indisponibilita' del
 * fornitore non deve tradursi in un utente che perde l'accesso alla propria
 * contabilita'. Il fornitore aggiorna questa tabella tramite eventi, e ogni
 * evento e' registrato.
 */

/** Durata della prova gratuita concessa all'apertura di un'organizzazione. */
export const TRIAL_DAYS = 30;

const CLOSED_CAMPAIGN_STATUSES: CampaignStatus[] = [CampaignStatus.CLOSED, CampaignStatus.ARCHIVED];

export type SubscriptionView = {
  planCode: string;
  planName: string;
  status: SubscriptionState;
  provider: string;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  activeCampaigns: number;
  campaignLimit: number | null;
  entitlements: Entitlements;
};

export async function listPublicPlans() {
  return prisma.plan.findMany({
    where: { isPublic: true, isActive: true },
    orderBy: { sortOrder: "asc" }
  });
}

async function countActiveCampaigns(organizationId: string) {
  return prisma.campaign.count({
    where: { organizationId, status: { notIn: CLOSED_CAMPAIGN_STATUSES }, archivedAt: null }
  });
}

/**
 * Legge l'abbonamento senza autorizzare: da usare solo internamente, dove il
 * chiamante ha gia' verificato l'accesso all'organizzazione.
 */
export async function getEntitlements(organizationId: string, now = new Date()) {
  const [subscription, activeCampaigns] = await Promise.all([
    prisma.subscription.findUnique({
      where: { organizationId },
      include: { plan: { select: { campaignLimit: true } } }
    }),
    countActiveCampaigns(organizationId)
  ]);

  return resolveEntitlements(
    subscription
      ? {
          status: subscription.status,
          trialEndsAt: subscription.trialEndsAt,
          currentPeriodEnd: subscription.currentPeriodEnd,
          campaignLimit: subscription.plan.campaignLimit,
          activeCampaigns
        }
      : null,
    now
  );
}

export async function getSubscription(
  actorUserId: string,
  organizationId: string,
  now = new Date()
): Promise<SubscriptionView | null> {
  await requireOrganizationMember(actorUserId, organizationId);
  const [subscription, activeCampaigns] = await Promise.all([
    prisma.subscription.findUnique({ where: { organizationId }, include: { plan: true } }),
    countActiveCampaigns(organizationId)
  ]);
  if (!subscription) return null;

  return {
    planCode: subscription.plan.code,
    planName: subscription.plan.name,
    status: subscription.status,
    provider: subscription.provider,
    trialEndsAt: subscription.trialEndsAt,
    currentPeriodEnd: subscription.currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    activeCampaigns,
    campaignLimit: subscription.plan.campaignLimit,
    entitlements: resolveEntitlements(
      {
        status: subscription.status,
        trialEndsAt: subscription.trialEndsAt,
        currentPeriodEnd: subscription.currentPeriodEnd,
        campaignLimit: subscription.plan.campaignLimit,
        activeCampaigns
      },
      now
    )
  };
}

/**
 * Apre la prova gratuita alla creazione dell'organizzazione. Idempotente: se un
 * abbonamento esiste gia' non viene toccato, perche' rigenerare una prova
 * sarebbe un modo per ottenerne una nuova a ogni tentativo.
 */
export async function startTrial(
  tx: Prisma.TransactionClient,
  organizationId: string,
  actorUserId: string,
  now = new Date()
) {
  const existing = await tx.subscription.findUnique({ where: { organizationId } });
  if (existing) return existing;

  const plan = await tx.plan.findFirst({
    where: { isActive: true, isPublic: true },
    orderBy: { sortOrder: "asc" }
  });
  if (!plan) return null;

  const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 86_400_000);
  const subscription = await tx.subscription.create({
    data: {
      organizationId,
      planId: plan.id,
      status: SubscriptionStatus.TRIALING,
      startedAt: now,
      trialEndsAt
    }
  });
  await tx.subscriptionEvent.create({
    data: { subscriptionId: subscription.id, type: "TRIAL_STARTED", occurredAt: now }
  });
  await tx.auditLog.create({
    data: {
      organizationId,
      userId: actorUserId,
      action: "SUBSCRIPTION_TRIAL_STARTED",
      entityType: "Subscription",
      entityId: subscription.id,
      afterJson: {
        planCode: plan.code,
        trialEndsAt: trialEndsAt.toISOString()
      } as Prisma.InputJsonValue
    }
  });
  return subscription;
}

export class EntitlementError extends HttpError {
  constructor(message: string) {
    super(402, "SUBSCRIPTION_REQUIRED", message);
  }
}

/**
 * Da chiamare prima di ogni scrittura di dati di campagna. La lettura non passa
 * mai di qui: non esiste uno stato dell'abbonamento che la impedisca.
 */
export async function requireWriteEntitlement(organizationId: string, now = new Date()) {
  const entitlements = await getEntitlements(organizationId, now);
  if (!entitlements.canWrite)
    throw new EntitlementError(
      entitlements.reason ?? "L'abbonamento non consente di registrare nuovi dati."
    );
  return entitlements;
}

export async function requireCampaignCreationEntitlement(organizationId: string, now = new Date()) {
  const entitlements = await getEntitlements(organizationId, now);
  if (!entitlements.canCreateCampaign)
    throw new EntitlementError(
      entitlements.reason ?? "L'abbonamento non consente di aprire altre campagne."
    );
  return entitlements;
}

/**
 * Applica un evento proveniente dal fornitore dei pagamenti.
 *
 * L'idempotenza e' garantita dall'identificativo dell'evento: i fornitori
 * rispediscono lo stesso webhook piu' volte, e applicarlo due volte
 * sposterebbe la scadenza o riaprirebbe un abbonamento chiuso.
 */
export async function applyProviderEvent(input: {
  providerEventId: string;
  provider: string;
  providerSubscriptionId: string;
  type: string;
  status: SubscriptionStatus;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
  occurredAt: Date;
  payload?: Prisma.InputJsonValue;
}) {
  const alreadyApplied = await prisma.subscriptionEvent.findUnique({
    where: { providerEventId: input.providerEventId },
    select: { id: true }
  });
  if (alreadyApplied) return { applied: false as const, reason: "EVENT_ALREADY_APPLIED" };

  const subscription = await prisma.subscription.findUnique({
    where: { providerSubscriptionId: input.providerSubscriptionId },
    select: { id: true, organizationId: true, status: true }
  });
  if (!subscription) return { applied: false as const, reason: "SUBSCRIPTION_NOT_FOUND" };

  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { id: subscription.id },
      data: {
        status: input.status,
        provider: input.provider,
        currentPeriodEnd: input.currentPeriodEnd ?? undefined,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? undefined,
        canceledAt: input.status === SubscriptionStatus.CANCELED ? input.occurredAt : undefined
      }
    });
    await tx.subscriptionEvent.create({
      data: {
        subscriptionId: subscription.id,
        type: input.type,
        providerEventId: input.providerEventId,
        payloadJson: input.payload,
        occurredAt: input.occurredAt
      }
    });
    await tx.auditLog.create({
      data: {
        organizationId: subscription.organizationId,
        action: "SUBSCRIPTION_STATUS_CHANGED",
        entityType: "Subscription",
        entityId: subscription.id,
        beforeJson: { status: subscription.status } as Prisma.InputJsonValue,
        afterJson: { status: input.status, type: input.type } as Prisma.InputJsonValue
      }
    });
  });

  return { applied: true as const };
}
