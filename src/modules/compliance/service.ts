import {
  DeadlineStatus,
  FindingStatus,
  TaskStatus,
  type FindingSeverity,
  type Prisma
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireCampaignAccess, requireCampaignPermission } from "@/modules/access/service";
import { daysBetween, formatLegalDate } from "@/modules/rules/legal-calendar";

/**
 * Lettura dello stato di conformita' di una campagna.
 *
 * Non ricalcola nulla: espone cio' che il servizio di valutazione ha gia'
 * scritto. Il momento in cui i dati sono stati prodotti e' parte della risposta,
 * perche' uno stato di conformita' senza data non dice nulla.
 */

const severityOrder: Record<FindingSeverity, number> = {
  BLOCKER: 0,
  CRITICAL: 1,
  ACTION_REQUIRED: 2,
  WARNING: 3,
  INFO: 4
};

export type ComplianceOverview = {
  campaignId: string;
  lastEvaluation: {
    at: string;
    rulesetVersionLabel: string;
    evaluatorVersion: string;
    complianceState: string;
    readyToFile: boolean;
    ruleCount: number;
  } | null;
  findings: {
    id: string;
    severity: FindingSeverity;
    status: FindingStatus;
    title: string;
    description: string;
    ruleCode: string;
    legalSourceTitle: string | null;
    isSystemControl: boolean;
    detectedAt: string;
  }[];
  tasks: { id: string; title: string; description: string; priority: FindingSeverity }[];
  deadlines: {
    id: string;
    name: string;
    triggerEvent: string;
    offsetDefinition: string;
    dueDate: string | null;
    daysRemaining: number | null;
    source: string;
  }[];
  counts: { blockers: number; open: number; tasks: number };
};

type StoredEvaluation = {
  provenance?: {
    rulesetVersionLabel?: string;
    evaluatorVersion?: string;
    ruleCount?: number;
    evaluatedAt?: string;
  };
  complianceState?: string;
  readyToFile?: boolean;
};

function readStoredEvaluation(value: Prisma.JsonValue | null): StoredEvaluation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as StoredEvaluation;
}

export async function getComplianceOverview(
  actorUserId: string,
  organizationId: string,
  campaignId: string,
  today = new Date()
): Promise<ComplianceOverview> {
  await requireCampaignAccess(actorUserId, organizationId, campaignId);

  const [findings, tasks, deadlines, lastAudit] = await Promise.all([
    prisma.complianceFinding.findMany({
      where: {
        campaignId,
        status: { in: [FindingStatus.OPEN, FindingStatus.ACKNOWLEDGED] }
      },
      include: {
        rule: {
          select: {
            ruleCode: true,
            legalSource: { select: { title: true, sourceType: true } }
          }
        }
      }
    }),
    prisma.task.findMany({
      where: { campaignId, status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS] } },
      orderBy: { createdAt: "asc" }
    }),
    prisma.deadline.findMany({
      where: { campaignId, status: { not: DeadlineStatus.CANCELED } },
      orderBy: { calculatedDueDate: "asc" }
    }),
    prisma.auditLog.findFirst({
      where: { campaignId, action: "RULES_EVALUATED" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, afterJson: true }
    })
  ]);

  const stored = readStoredEvaluation(lastAudit?.afterJson ?? null);

  return {
    campaignId,
    lastEvaluation:
      lastAudit && stored
        ? {
            at: lastAudit.createdAt.toISOString(),
            rulesetVersionLabel: stored.provenance?.rulesetVersionLabel ?? "sconosciuto",
            evaluatorVersion: stored.provenance?.evaluatorVersion ?? "sconosciuto",
            complianceState: stored.complianceState ?? "EVALUATION_INCOMPLETE",
            readyToFile: stored.readyToFile ?? false,
            ruleCount: stored.provenance?.ruleCount ?? 0
          }
        : null,
    findings: findings
      .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
      .map((finding) => ({
        id: finding.id,
        severity: finding.severity,
        status: finding.status,
        title: finding.title,
        description: finding.description,
        ruleCode: finding.rule.ruleCode,
        legalSourceTitle: finding.rule.legalSource?.title ?? null,
        /**
         * Un controllo di sistema non va mostrato come un obbligo di legge:
         * l'interfaccia deve poterli distinguere senza interpretare il testo.
         */
        isSystemControl:
          finding.rule.legalSource?.sourceType === "SYSTEM_CONTROL" ||
          finding.rule.legalSource?.sourceType === "PRODUCT_BEST_PRACTICE",
        detectedAt: finding.detectedAt.toISOString()
      })),
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority
    })),
    deadlines: deadlines.map((deadline) => ({
      id: deadline.id,
      name: deadline.name,
      triggerEvent: deadline.triggerEvent,
      offsetDefinition: deadline.offsetDefinition,
      dueDate: deadline.calculatedDueDate ? formatLegalDate(deadline.calculatedDueDate) : null,
      daysRemaining: deadline.calculatedDueDate
        ? daysBetween(today, deadline.calculatedDueDate)
        : null,
      source: deadline.source
    })),
    counts: {
      blockers: findings.filter((finding) => finding.severity === "BLOCKER").length,
      open: findings.length,
      tasks: tasks.length
    }
  };
}

/**
 * Deroga professionale. La regola, il rilievo, la motivazione, l'autore e la data
 * restano tutti sul record: una deroga senza autore non e' una deroga, e' una
 * cancellazione.
 */
export async function overrideFinding(
  actorUserId: string,
  organizationId: string,
  campaignId: string,
  findingId: string,
  reason: string
) {
  await requireCampaignPermission(actorUserId, organizationId, campaignId, "campaign:manage");
  return prisma.$transaction(async (tx) => {
    const finding = await tx.complianceFinding.findFirst({
      where: { id: findingId, campaignId },
      select: { id: true, severity: true, status: true, title: true }
    });
    if (!finding) throw new Error("COMPLIANCE_FINDING_NOT_FOUND");

    const updated = await tx.complianceFinding.update({
      where: { id: finding.id },
      data: {
        status: FindingStatus.OVERRIDDEN,
        overrideReason: reason,
        overriddenBy: actorUserId,
        resolvedAt: new Date(),
        resolutionMethod: "PROFESSIONAL_OVERRIDE"
      }
    });

    await tx.auditLog.create({
      data: {
        organizationId,
        campaignId,
        userId: actorUserId,
        action: "COMPLIANCE_FINDING_OVERRIDDEN",
        entityType: "ComplianceFinding",
        entityId: finding.id,
        beforeJson: { status: finding.status } as Prisma.InputJsonValue,
        afterJson: {
          status: updated.status,
          severity: updated.severity,
          title: updated.title,
          reason
        } as Prisma.InputJsonValue
      }
    });
    return updated;
  });
}
