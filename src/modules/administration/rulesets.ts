import { PlatformRole, RulesetStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { requirePlatformRole } from "@/modules/administration/service";
import { calculationExpressionSchema } from "@/modules/rules/calculation";
import { ruleExpressionSchema } from "@/modules/rules/dsl";
import {
  findingEffectTypes,
  isEffectType,
  parseCalculationEffect,
  parseDeadlineEffect,
  parseFindingEffect,
  parseTaskEffect
} from "@/modules/rules/effects";
import { parseLegalOffset } from "@/modules/rules/legal-calendar";

/**
 * Console legale: verifica delle fonti e attivazione dei ruleset.
 *
 * L'attivazione e' l'unico momento in cui una ricostruzione normativa diventa
 * qualcosa che il prodotto dice a un candidato. Per questo non e' un
 * interruttore: e' un atto che richiede di aver collegato ogni regola a una
 * fonte ufficiale verificata, e che resta registrato con il nome di chi lo ha
 * compiuto.
 *
 * I controlli qui sotto non stabiliscono se una regola sia giuridicamente
 * corretta - quello puo' farlo solo chi la rivede. Stabiliscono che sia
 * eseguibile e tracciabile: che la condizione sia valida per il motore, che
 * l'effetto sia completo, che i parametri citati esistano e che la fonte ci sia
 * e sia stata verificata da una persona.
 */

export type ActivationBlocker = {
  code: string;
  ruleCode?: string;
  message: string;
};

export type ActivationReadiness = {
  ready: boolean;
  activeRuleCount: number;
  blockers: ActivationBlocker[];
};

type RuleForCheck = {
  ruleCode: string;
  conditionExpression: Prisma.JsonValue;
  effectType: string;
  effectPayload: Prisma.JsonValue;
  isActive: boolean;
  legalSource: { title: string; verifiedAt: Date | null } | null;
};

function citedParameters(expression: unknown): string[] {
  const cited: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if ("constant" in node) cited.push((node as { constant: string }).constant);
    if ("items" in node) (node as { items: unknown[] }).items.forEach(walk);
  };
  walk(expression);
  return cited;
}

export type ParameterForCheck = {
  code: string;
  value: Prisma.JsonValue;
  verifiedAt: Date | null;
};

const numericValue = /^-?\d+(\.\d+)?$/;

/** Un parametro e' utilizzabile solo se il motore di calcolo sa leggerlo. */
function parameterIsNumeric(value: Prisma.JsonValue): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  return typeof value === "string" && numericValue.test(value.trim());
}

export function checkActivationReadiness(
  rules: RuleForCheck[],
  parameters: ParameterForCheck[]
): ActivationReadiness {
  const blockers: ActivationBlocker[] = [];
  const active = rules.filter((rule) => rule.isActive);
  const byCode = new Map(parameters.map((parameter) => [parameter.code, parameter]));

  if (active.length === 0)
    blockers.push({
      code: "NO_ACTIVE_RULES",
      message: "Nessuna regola e' stata marcata come attiva: il ruleset non produrrebbe nulla."
    });

  for (const rule of active) {
    if (!rule.legalSource) {
      blockers.push({
        code: "MISSING_LEGAL_SOURCE",
        ruleCode: rule.ruleCode,
        message: "La regola non e' collegata ad alcuna fonte."
      });
    } else if (!rule.legalSource.verifiedAt) {
      blockers.push({
        code: "UNVERIFIED_LEGAL_SOURCE",
        ruleCode: rule.ruleCode,
        message: `La fonte "${rule.legalSource.title}" non risulta verificata.`
      });
    }

    const condition = ruleExpressionSchema.safeParse(rule.conditionExpression);
    if (!condition.success)
      blockers.push({
        code: "INVALID_CONDITION",
        ruleCode: rule.ruleCode,
        message: `Condizione non valida: ${condition.error.issues.map((issue) => issue.message).join("; ")}`
      });

    if (!isEffectType(rule.effectType)) {
      blockers.push({
        code: "UNKNOWN_EFFECT_TYPE",
        ruleCode: rule.ruleCode,
        message: `Tipo di effetto non riconosciuto: ${rule.effectType}.`
      });
      continue;
    }

    try {
      if (findingEffectTypes.includes(rule.effectType)) {
        parseFindingEffect(rule.effectPayload, rule.effectType, rule.ruleCode);
      } else if (rule.effectType === "TASK") {
        parseTaskEffect(rule.effectPayload, rule.ruleCode);
      } else if (rule.effectType === "DEADLINE") {
        const effect = parseDeadlineEffect(rule.effectPayload, rule.ruleCode);
        parseLegalOffset(effect.offsetDefinition);
      } else {
        const effect = parseCalculationEffect(rule.effectPayload, rule.ruleCode);
        const expression = calculationExpressionSchema.parse(effect.expression);
        for (const code of citedParameters(expression)) {
          const parameter = byCode.get(code);
          if (!parameter) {
            blockers.push({
              code: "MISSING_PARAMETER",
              ruleCode: rule.ruleCode,
              message: `Il calcolo cita il parametro "${code}", che non e' versionato in questo ruleset.`
            });
            continue;
          }
          /**
           * Un valore che il motore non sa leggere non si manifesta all'attivazione:
           * si manifesta quando un candidato apre la propria campagna e il limite
           * di spesa risulta non calcolabile.
           */
          if (!parameterIsNumeric(parameter.value))
            blockers.push({
              code: "PARAMETER_NOT_NUMERIC",
              ruleCode: rule.ruleCode,
              message: `Il parametro "${code}" non contiene un numero: ${JSON.stringify(parameter.value)}.`
            });
          /**
           * E' il numero da cui esce il limite di spesa di una persona reale:
           * nessuno deve poterlo attivare senza che qualcuno lo abbia
           * controllato sulla fonte.
           */
          if (!parameter.verifiedAt)
            blockers.push({
              code: "UNVERIFIED_PARAMETER",
              ruleCode: rule.ruleCode,
              message: `Il parametro "${code}" non risulta verificato da nessuno.`
            });
        }
      }
    } catch (error) {
      blockers.push({
        code: "INVALID_EFFECT",
        ruleCode: rule.ruleCode,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return { ready: blockers.length === 0, activeRuleCount: active.length, blockers };
}

export async function listRulesets(actorUserId: string) {
  await requirePlatformRole(actorUserId, PlatformRole.SUPPORT);
  return prisma.rulesetVersion.findMany({
    orderBy: [{ electionType: "asc" }, { effectiveFrom: "desc" }],
    include: {
      _count: { select: { rules: true, parameters: true, campaigns: true } },
      rules: { select: { isActive: true } }
    }
  });
}

export async function getRuleset(actorUserId: string, rulesetVersionId: string) {
  await requirePlatformRole(actorUserId, PlatformRole.SUPPORT);
  const ruleset = await prisma.rulesetVersion.findUnique({
    where: { id: rulesetVersionId },
    include: {
      parameters: { orderBy: { code: "asc" } },
      rules: {
        orderBy: { ruleCode: "asc" },
        include: { legalSource: true }
      }
    }
  });
  if (!ruleset) throw new HttpError(404, "RULESET_NOT_FOUND", "Ruleset non trovato");

  const readiness = checkActivationReadiness(ruleset.rules, ruleset.parameters);
  return { ruleset, readiness };
}

async function recordPlatformAudit(
  tx: Prisma.TransactionClient,
  actorUserId: string,
  action: string,
  entityType: string,
  entityId: string,
  before: Prisma.InputJsonValue | undefined,
  after: Prisma.InputJsonValue
) {
  await tx.auditLog.create({
    data: {
      organizationId: null,
      userId: actorUserId,
      action,
      entityType,
      entityId,
      beforeJson: before,
      afterJson: after
    }
  });
}

/**
 * Marca una fonte come verificata. E' l'atto con cui una persona si assume la
 * responsabilita' di aver controllato il testo sulla fonte ufficiale: resta
 * registrato chi e quando, e senza di esso nessuna regola collegata puo' essere
 * attivata.
 */
export async function verifyLegalSource(
  actorUserId: string,
  legalSourceId: string,
  input: { officialUrl?: string; notes?: string }
) {
  await requirePlatformRole(actorUserId, PlatformRole.ADMIN);
  const source = await prisma.legalSource.findUnique({ where: { id: legalSourceId } });
  if (!source) throw new HttpError(404, "LEGAL_SOURCE_NOT_FOUND", "Fonte non trovata");

  const verifiedAt = new Date();
  return prisma.$transaction(async (tx) => {
    const updated = await tx.legalSource.update({
      where: { id: legalSourceId },
      data: {
        verifiedAt,
        verifiedBy: actorUserId,
        officialUrl: input.officialUrl ?? source.officialUrl,
        textExcerpt: input.notes ?? source.textExcerpt
      }
    });
    await recordPlatformAudit(
      tx,
      actorUserId,
      "LEGAL_SOURCE_VERIFIED",
      "LegalSource",
      legalSourceId,
      { verifiedAt: source.verifiedAt?.toISOString() ?? null } as Prisma.InputJsonValue,
      {
        title: updated.title,
        verifiedAt: verifiedAt.toISOString(),
        officialUrl: updated.officialUrl
      } as Prisma.InputJsonValue
    );
    return updated;
  });
}

export async function setRuleActive(actorUserId: string, ruleId: string, isActive: boolean) {
  await requirePlatformRole(actorUserId, PlatformRole.ADMIN);
  const rule = await prisma.complianceRule.findUnique({
    where: { id: ruleId },
    include: { rulesetVersion: { select: { status: true, name: true } } }
  });
  if (!rule) throw new HttpError(404, "RULE_NOT_FOUND", "Regola non trovata");

  /**
   * Un ruleset gia' attivo non si modifica: si crea una nuova versione. Cambiare
   * una regola sotto i piedi delle campagne che la stanno applicando renderebbe
   * irripetibile ogni valutazione gia' fatta.
   */
  if (rule.rulesetVersion.status === RulesetStatus.ACTIVE)
    throw new HttpError(
      409,
      "RULESET_ALREADY_ACTIVE",
      `Il ruleset "${rule.rulesetVersion.name}" e' attivo: per modificarlo crea una nuova versione.`
    );

  return prisma.$transaction(async (tx) => {
    const updated = await tx.complianceRule.update({
      where: { id: ruleId },
      data: { isActive }
    });
    await recordPlatformAudit(
      tx,
      actorUserId,
      isActive ? "COMPLIANCE_RULE_ENABLED" : "COMPLIANCE_RULE_DISABLED",
      "ComplianceRule",
      ruleId,
      { isActive: rule.isActive } as Prisma.InputJsonValue,
      { ruleCode: rule.ruleCode, isActive } as Prisma.InputJsonValue
    );
    return updated;
  });
}

export async function activateRuleset(
  actorUserId: string,
  rulesetVersionId: string,
  reviewNote: string
) {
  await requirePlatformRole(actorUserId, PlatformRole.ADMIN);
  if (reviewNote.trim().length < 20)
    throw new HttpError(
      422,
      "REVIEW_NOTE_REQUIRED",
      "Scrivi cosa hai verificato e su quale fonte: la nota resta agli atti insieme all'attivazione."
    );

  const { ruleset, readiness } = await getRuleset(actorUserId, rulesetVersionId);

  if (ruleset.status === RulesetStatus.ACTIVE)
    throw new HttpError(409, "RULESET_ALREADY_ACTIVE", "Il ruleset e' gia' attivo.");
  if (ruleset.status === RulesetStatus.SUPERSEDED || ruleset.status === RulesetStatus.ARCHIVED)
    throw new HttpError(
      409,
      "RULESET_NOT_ACTIVATABLE",
      "Un ruleset superato o archiviato non puo' essere riattivato."
    );
  if (!readiness.ready)
    throw new HttpError(
      422,
      "RULESET_NOT_READY",
      `Non attivabile: ${readiness.blockers.map((blocker) => `${blocker.ruleCode ? `${blocker.ruleCode}: ` : ""}${blocker.message}`).join(" ")}`
    );

  const reviewedAt = new Date();
  return prisma.$transaction(async (tx) => {
    /** La versione precedente per la stessa giurisdizione ed elezione viene superata. */
    const superseded = await tx.rulesetVersion.updateMany({
      where: {
        jurisdiction: ruleset.jurisdiction,
        electionType: ruleset.electionType,
        status: RulesetStatus.ACTIVE,
        id: { not: ruleset.id }
      },
      data: { status: RulesetStatus.SUPERSEDED }
    });

    const activated = await tx.rulesetVersion.update({
      where: { id: ruleset.id },
      data: { status: RulesetStatus.ACTIVE, reviewedBy: actorUserId, reviewedAt }
    });

    await recordPlatformAudit(
      tx,
      actorUserId,
      "RULESET_ACTIVATED",
      "RulesetVersion",
      ruleset.id,
      { status: ruleset.status } as Prisma.InputJsonValue,
      {
        name: ruleset.name,
        jurisdiction: ruleset.jurisdiction,
        electionType: ruleset.electionType,
        version: ruleset.version,
        activeRuleCount: readiness.activeRuleCount,
        supersededVersions: superseded.count,
        reviewNote: reviewNote.trim(),
        reviewedAt: reviewedAt.toISOString()
      } as Prisma.InputJsonValue
    );

    return { activated, supersededCount: superseded.count };
  });
}

async function loadEditableParameter(parameterId: string) {
  const parameter = await prisma.ruleParameter.findUnique({
    where: { id: parameterId },
    include: { rulesetVersion: { select: { id: true, name: true, status: true } } }
  });
  if (!parameter) throw new HttpError(404, "PARAMETER_NOT_FOUND", "Parametro non trovato");
  if (parameter.rulesetVersion.status === RulesetStatus.ACTIVE)
    throw new HttpError(
      409,
      "RULESET_ALREADY_ACTIVE",
      `Il ruleset "${parameter.rulesetVersion.name}" e' attivo: per cambiare un parametro crea una nuova versione.`
    );
  return parameter;
}

/**
 * Corregge il valore di un parametro.
 *
 * Il cambiamento azzera la verifica: il numero controllato non e' piu' quello
 * scritto, quindi la responsabilita' che qualcuno si era assunto non copre il
 * valore nuovo. Va verificato di nuovo, e questo e' voluto.
 */
export async function updateRuleParameter(
  actorUserId: string,
  parameterId: string,
  input: { value: string; unit?: string; note?: string }
) {
  await requirePlatformRole(actorUserId, PlatformRole.ADMIN);
  const parameter = await loadEditableParameter(parameterId);

  const value = input.value.trim();
  if (!/^-?\d+(\.\d+)?$/.test(value))
    throw new HttpError(
      422,
      "PARAMETER_NOT_NUMERIC",
      "Il valore deve essere un numero, con il punto come separatore decimale. Esempio: 25000 oppure 0.05"
    );

  const valueChanged = value !== String(parameter.value);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.ruleParameter.update({
      where: { id: parameterId },
      data: {
        value,
        unit: input.unit?.trim() || parameter.unit,
        note: input.note?.trim() || parameter.note,
        ...(valueChanged ? { verifiedAt: null, verifiedBy: null } : {})
      }
    });
    await recordPlatformAudit(
      tx,
      actorUserId,
      "RULE_PARAMETER_UPDATED",
      "RuleParameter",
      parameterId,
      {
        code: parameter.code,
        value: parameter.value,
        verifiedAt: parameter.verifiedAt?.toISOString() ?? null
      } as Prisma.InputJsonValue,
      {
        code: updated.code,
        value: updated.value,
        unit: updated.unit,
        note: updated.note,
        verificationCleared: valueChanged
      } as Prisma.InputJsonValue
    );
    return updated;
  });
}

/**
 * Marca un parametro come verificato. E' l'atto con cui una persona dichiara di
 * aver letto quel numero sulla fonte ufficiale: senza, nessuna regola di calcolo
 * che lo cita puo' essere attivata.
 */
export async function verifyRuleParameter(actorUserId: string, parameterId: string, note?: string) {
  await requirePlatformRole(actorUserId, PlatformRole.ADMIN);
  const parameter = await loadEditableParameter(parameterId);
  const verifiedAt = new Date();

  return prisma.$transaction(async (tx) => {
    const updated = await tx.ruleParameter.update({
      where: { id: parameterId },
      data: { verifiedAt, verifiedBy: actorUserId, note: note?.trim() || parameter.note }
    });
    await recordPlatformAudit(
      tx,
      actorUserId,
      "RULE_PARAMETER_VERIFIED",
      "RuleParameter",
      parameterId,
      { verifiedAt: parameter.verifiedAt?.toISOString() ?? null } as Prisma.InputJsonValue,
      {
        code: updated.code,
        value: updated.value,
        verifiedAt: verifiedAt.toISOString(),
        note: updated.note
      } as Prisma.InputJsonValue
    );
    return updated;
  });
}
