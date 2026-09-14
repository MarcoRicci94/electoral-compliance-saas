import { createHash } from "node:crypto";
import {
  DeadlineStatus,
  type ElectionType,
  FindingStatus,
  RulesetStatus,
  TaskSourceType,
  TaskStatus,
  type Prisma
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireCampaignAccess } from "@/modules/access/service";
import { buildCampaignContext, type CampaignRuleContext } from "@/modules/rules/context";
import {
  EVALUATOR_VERSION,
  evaluateRules,
  type EvaluatableRule,
  type EvaluationResult
} from "@/modules/rules/evaluator";
import { toLegalDate } from "@/modules/rules/legal-calendar";

/**
 * Servizio di valutazione.
 *
 * Regole, parametri e contesto vengono letti dal database, valutati dal
 * valutatore puro e trasformati in rilievi, attivita' e scadenze. Ogni
 * esecuzione lascia in `AuditLog` la propria provenienza: ruleset, versione del
 * valutatore, impronta del contesto ed esito regola per regola. Senza quella
 * traccia, un esito normativo non e' verificabile a distanza di mesi.
 */

export type EvaluationProvenance = {
  rulesetVersionId: string;
  rulesetVersionLabel: string;
  evaluatorVersion: string;
  contextHash: string;
  evaluatedAt: Date;
  ruleCount: number;
};

export type CampaignEvaluation = EvaluationResult & {
  campaignId: string;
  provenance: EvaluationProvenance | null;
  /** Valorizzato quando non esiste un ruleset attivo applicabile alla campagna. */
  blockedReason?: string;
  context: CampaignRuleContext;
  persisted: { findings: number; tasks: number; deadlines: number; resolvedFindings: number };
};

const RESOLUTION_METHOD = "AUTOMATIC_REEVALUATION";

function hashContext(context: CampaignRuleContext): string {
  return createHash("sha256").update(JSON.stringify(context)).digest("hex").slice(0, 32);
}

function toParameterValue(value: Prisma.JsonValue): string | number | undefined {
  if (typeof value === "string" || typeof value === "number") return value;
  return undefined;
}

async function resolveRulesetVersion(
  campaign: { rulesetVersionId: string | null; electionType: ElectionType },
  evaluationDate: Date
) {
  if (campaign.rulesetVersionId)
    return prisma.rulesetVersion.findUnique({ where: { id: campaign.rulesetVersionId } });

  return prisma.rulesetVersion.findFirst({
    where: {
      electionType: campaign.electionType,
      status: RulesetStatus.ACTIVE,
      effectiveFrom: { lte: evaluationDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: evaluationDate } }]
    },
    orderBy: { effectiveFrom: "desc" }
  });
}

async function loadRules(
  rulesetVersionId: string,
  evaluationDate: Date
): Promise<EvaluatableRule[]> {
  const rows = await prisma.complianceRule.findMany({
    where: {
      rulesetVersionId,
      isActive: true,
      AND: [
        { OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: evaluationDate } }] },
        { OR: [{ effectiveTo: null }, { effectiveTo: { gte: evaluationDate } }] }
      ]
    },
    include: { legalSource: { select: { id: true, title: true } } },
    orderBy: { ruleCode: "asc" }
  });

  return rows.map((row) => ({
    id: row.id,
    ruleCode: row.ruleCode,
    name: row.name,
    description: row.description,
    category: row.category,
    severityDefault: row.severityDefault,
    conditionExpression: row.conditionExpression,
    effectType: row.effectType,
    effectPayload: row.effectPayload,
    legalSourceId: row.legalSource?.id ?? null,
    legalSourceTitle: row.legalSource?.title ?? null
  }));
}

async function loadParameters(rulesetVersionId: string) {
  const rows = await prisma.ruleParameter.findMany({ where: { rulesetVersionId } });
  const parameters: Record<string, string | number> = {};
  for (const row of rows) {
    const value = toParameterValue(row.value);
    if (value !== undefined) parameters[row.code] = value;
  }
  return parameters;
}

/**
 * I rilievi non vengono cancellati e ricreati a ogni esecuzione: sono fatti
 * storici. Un rilievo che non ricorre piu' viene chiuso come risolto dalla
 * rivalutazione, e uno gia' derogato non viene toccato, perche' la deroga
 * appartiene a chi l'ha assunta.
 */
async function persist(tx: Prisma.TransactionClient, campaignId: string, result: EvaluationResult) {
  const matchedRuleIds = new Set(
    result.outcomes
      .filter((outcome) => outcome.status === "MATCHED")
      .map((outcome) => outcome.ruleId)
  );

  const existingFindings = await tx.complianceFinding.findMany({
    where: { campaignId, status: { in: [FindingStatus.OPEN, FindingStatus.ACKNOWLEDGED] } },
    select: { id: true, ruleId: true, title: true }
  });
  const existingByKey = new Map(
    existingFindings.map((finding) => [`${finding.ruleId}::${finding.title}`, finding.id])
  );

  let createdFindings = 0;
  for (const outcome of result.outcomes) {
    if (outcome.status !== "MATCHED" || outcome.produced.kind !== "FINDING") continue;
    const key = `${outcome.ruleId}::${outcome.produced.title}`;
    if (existingByKey.has(key)) {
      existingByKey.delete(key);
      continue;
    }
    await tx.complianceFinding.create({
      data: {
        campaignId,
        ruleId: outcome.ruleId,
        severity: outcome.produced.severity,
        status: FindingStatus.OPEN,
        title: outcome.produced.title,
        description: outcome.produced.description,
        entityType: outcome.produced.entityType
      }
    });
    createdFindings += 1;
  }

  const staleFindingIds = [...existingByKey.values()];
  if (staleFindingIds.length)
    await tx.complianceFinding.updateMany({
      where: { id: { in: staleFindingIds } },
      data: {
        status: FindingStatus.RESOLVED,
        resolvedAt: new Date(),
        resolutionMethod: RESOLUTION_METHOD
      }
    });

  const openTasks = await tx.task.findMany({
    where: {
      campaignId,
      sourceType: TaskSourceType.RULE,
      status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS] }
    },
    select: { id: true, sourceId: true }
  });
  const openTaskBySource = new Map(openTasks.map((task) => [task.sourceId ?? "", task.id]));

  let createdTasks = 0;
  for (const outcome of result.outcomes) {
    if (outcome.status !== "MATCHED" || outcome.produced.kind !== "TASK") continue;
    if (openTaskBySource.has(outcome.ruleId)) {
      openTaskBySource.delete(outcome.ruleId);
      continue;
    }
    await tx.task.create({
      data: {
        campaignId,
        sourceType: TaskSourceType.RULE,
        sourceId: outcome.ruleId,
        title: outcome.produced.title,
        description: outcome.produced.description,
        priority: outcome.produced.priority
      }
    });
    createdTasks += 1;
  }

  const staleTaskIds = [...openTaskBySource.entries()]
    .filter(([sourceId]) => sourceId && !matchedRuleIds.has(sourceId))
    .map(([, id]) => id);
  if (staleTaskIds.length)
    await tx.task.updateMany({
      where: { id: { in: staleTaskIds } },
      data: { status: TaskStatus.CANCELED }
    });

  let upsertedDeadlines = 0;
  for (const outcome of result.outcomes) {
    if (outcome.status !== "MATCHED" || outcome.produced.kind !== "DEADLINE") continue;
    const deadline = outcome.produced;
    const existing = await tx.deadline.findFirst({
      where: { campaignId, ruleId: outcome.ruleId, name: deadline.name },
      select: { id: true, status: true }
    });
    const data = {
      triggerEvent: deadline.triggerEvent,
      triggerDate: toLegalDate(deadline.triggerDate),
      offsetDefinition: deadline.offsetDefinition,
      calculatedDueDate: toLegalDate(deadline.dueDate),
      source: outcome.legalSourceTitle ?? outcome.ruleCode
    };
    if (existing) {
      if (existing.status !== DeadlineStatus.COMPLETED)
        await tx.deadline.update({ where: { id: existing.id }, data });
    } else {
      await tx.deadline.create({
        data: { campaignId, ruleId: outcome.ruleId, name: deadline.name, ...data }
      });
    }
    upsertedDeadlines += 1;
  }

  return {
    findings: createdFindings,
    tasks: createdTasks,
    deadlines: upsertedDeadlines,
    resolvedFindings: staleFindingIds.length
  };
}

export async function evaluateCampaign(
  actorUserId: string,
  organizationId: string,
  campaignId: string,
  evaluationDate = new Date()
): Promise<CampaignEvaluation> {
  await requireCampaignAccess(actorUserId, organizationId, campaignId);

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, organizationId },
    select: { id: true, rulesetVersionId: true, electionType: true }
  });
  if (!campaign) throw new Error("RULE_EVALUATION_CAMPAIGN_NOT_FOUND");

  const context = await buildCampaignContext(campaignId, organizationId, evaluationDate);
  const ruleset = await resolveRulesetVersion(campaign, evaluationDate);

  if (!ruleset || ruleset.status !== RulesetStatus.ACTIVE) {
    /**
     * Nessun ruleset attivo significa che la normativa non e' ancora stata
     * verificata e attivata da un revisore. Lo stato resta esplicitamente
     * incompleto: non e' una campagna conforme, e' una campagna non valutata.
     */
    return {
      campaignId,
      evaluatorVersion: EVALUATOR_VERSION,
      outcomes: [],
      findings: [],
      tasks: [],
      deadlines: [],
      calculations: [],
      complianceState: "EVALUATION_INCOMPLETE",
      readyToFile: false,
      notEvaluable: 0,
      provenance: null,
      blockedReason: ruleset
        ? `Il ruleset ${ruleset.name} e' in stato ${ruleset.status}: nessuna regola attiva applicabile.`
        : "Nessun ruleset attivo per questo tipo di elezione: la normativa non e' ancora stata verificata e attivata.",
      context,
      persisted: { findings: 0, tasks: 0, deadlines: 0, resolvedFindings: 0 }
    };
  }

  const [rules, parameters] = await Promise.all([
    loadRules(ruleset.id, evaluationDate),
    loadParameters(ruleset.id)
  ]);

  if (rules.length === 0)
    return {
      campaignId,
      evaluatorVersion: EVALUATOR_VERSION,
      outcomes: [],
      findings: [],
      tasks: [],
      deadlines: [],
      calculations: [],
      complianceState: "EVALUATION_INCOMPLETE" as const,
      readyToFile: false,
      notEvaluable: 0,
      provenance: null,
      blockedReason: `Il ruleset ${ruleset.name} e' attivo ma non contiene regole attive alla data di valutazione.`,
      context,
      persisted: { findings: 0, tasks: 0, deadlines: 0, resolvedFindings: 0 }
    };

  const result = evaluateRules(rules, context as unknown as Record<string, unknown>, parameters);
  const provenance: EvaluationProvenance = {
    rulesetVersionId: ruleset.id,
    rulesetVersionLabel: `${ruleset.jurisdiction}/${ruleset.electionType}/${ruleset.version}`,
    evaluatorVersion: result.evaluatorVersion,
    contextHash: hashContext(context),
    evaluatedAt: evaluationDate,
    ruleCount: rules.length
  };

  const persisted = await prisma.$transaction(async (tx) => {
    const counts = await persist(tx, campaignId, result);
    await tx.auditLog.create({
      data: {
        organizationId,
        campaignId,
        userId: actorUserId,
        action: "RULES_EVALUATED",
        entityType: "Campaign",
        entityId: campaignId,
        afterJson: {
          provenance: { ...provenance, evaluatedAt: provenance.evaluatedAt.toISOString() },
          complianceState: result.complianceState,
          readyToFile: result.readyToFile,
          outcomes: result.outcomes.map((outcome) =>
            outcome.status === "NOT_EVALUABLE"
              ? {
                  ruleCode: outcome.ruleCode,
                  status: outcome.status,
                  errorCode: outcome.errorCode
                }
              : { ruleCode: outcome.ruleCode, status: outcome.status }
          ),
          persisted: counts
        } as unknown as Prisma.InputJsonValue
      }
    });
    return counts;
  });

  return { campaignId, ...result, provenance, context, persisted };
}

/**
 * Rule tester: valuta un ruleset contro un contesto fornito a mano, senza
 * scrivere nulla. Usa lo stesso valutatore del percorso di produzione, perche'
 * un secondo percorso di valutazione renderebbe il tester inutile.
 */
export async function testRuleset(
  rulesetVersionId: string,
  context: Record<string, unknown>,
  evaluationDate = new Date()
) {
  const [rules, parameters] = await Promise.all([
    loadRules(rulesetVersionId, evaluationDate),
    loadParameters(rulesetVersionId)
  ]);
  return { ruleCount: rules.length, result: evaluateRules(rules, context, parameters) };
}
