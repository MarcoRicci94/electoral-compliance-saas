import { CampaignStatus, MandataryRequirement, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { requireCampaignAccess, requireCampaignPermission } from "@/modules/access/service";
import { determineMandatary } from "@/modules/mandataries/determination";
import { evaluateCampaign } from "@/modules/rules/service";

/**
 * Wizard di apertura della campagna.
 *
 * Il questionario raccoglie previsioni, non fatti: servono a determinare il
 * regime di partenza. Ogni risposta che cambia i presupposti fa ripartire la
 * valutazione delle regole, perche' un regime determinato una volta sola e mai
 * piu' toccato e' il modo tipico in cui un candidato scopre a fine campagna di
 * aver operato sotto il regime sbagliato.
 */

export type CampaignSetupAnswers = {
  expectsOwnSpending: boolean;
  plannedOwnSpending?: string;
  expectsThirdPartyContributions: boolean;
  expectsPartyOrListSupport: boolean;
  expectsInKindContributions: boolean;
  plannedTotalSpending?: string;
};

export type MandataryOutcome = {
  requirement: MandataryRequirement;
  ruleCodes: string[];
  reason?: string;
  evaluatedAt: Date;
};

function toRequirement(value: string): MandataryRequirement {
  return (Object.values(MandataryRequirement) as string[]).includes(value)
    ? (value as MandataryRequirement)
    : MandataryRequirement.UNKNOWN;
}

/**
 * Rivaluta le regole e aggiorna il regime del mandatario registrato sulla
 * campagna. Il regime memorizzato e' una comodita' di lettura: resta sempre
 * accompagnato dalle regole che lo hanno prodotto e dal momento in cui e' stato
 * determinato, cosi' si vede se e' vecchio.
 */
export async function refreshMandataryRequirement(
  actorUserId: string,
  organizationId: string,
  campaignId: string
): Promise<MandataryOutcome> {
  await requireCampaignAccess(actorUserId, organizationId, campaignId);
  const evaluation = await evaluateCampaign(actorUserId, organizationId, campaignId);
  const determination = determineMandatary(evaluation);
  const evaluatedAt = new Date();

  const previous = await prisma.campaign.findFirst({
    where: { id: campaignId, organizationId },
    select: { mandataryRequirement: true, mandataryRequirementRuleCode: true }
  });
  if (!previous) throw new HttpError(404, "CAMPAIGN_NOT_FOUND", "Campagna non trovata");

  const requirement = toRequirement(determination.requirement);
  const ruleCode = determination.ruleCodes.join(", ") || null;

  await prisma.$transaction(async (tx) => {
    await tx.campaign.update({
      where: { id: campaignId },
      data: {
        mandataryRequirement: requirement,
        mandataryRequirementRuleCode: ruleCode,
        mandataryRequirementEvaluatedAt: evaluatedAt
      }
    });

    if (previous.mandataryRequirement !== requirement)
      await tx.auditLog.create({
        data: {
          organizationId,
          campaignId,
          userId: actorUserId,
          action: "MANDATARY_REQUIREMENT_CHANGED",
          entityType: "Campaign",
          entityId: campaignId,
          beforeJson: {
            requirement: previous.mandataryRequirement,
            ruleCode: previous.mandataryRequirementRuleCode
          } as Prisma.InputJsonValue,
          afterJson: {
            requirement,
            ruleCodes: determination.ruleCodes,
            reason: determination.reason
          } as unknown as Prisma.InputJsonValue
        }
      });
  });

  return {
    requirement,
    ruleCodes: determination.ruleCodes,
    reason: determination.reason,
    evaluatedAt
  };
}

export async function saveCampaignSetup(
  actorUserId: string,
  organizationId: string,
  campaignId: string,
  answers: CampaignSetupAnswers
) {
  await requireCampaignPermission(actorUserId, organizationId, campaignId, "campaign:manage");

  /**
   * Se il candidato dichiara che spendera' denaro proprio, l'importo previsto
   * serve: senza, la soglia dell'eccezione non e' confrontabile e il regime
   * resterebbe indeterminato. Meglio chiederlo adesso che scoprirlo dopo.
   */
  if (answers.expectsOwnSpending && answers.plannedOwnSpending === undefined)
    throw new HttpError(
      422,
      "SETUP_PLANNED_OWN_SPENDING_REQUIRED",
      "Indica l'importo che prevedi di spendere con denaro proprio: serve a stabilire se ti occorre il mandatario."
    );

  const data = {
    expectsOwnSpending: answers.expectsOwnSpending,
    plannedOwnSpending: answers.expectsOwnSpending ? (answers.plannedOwnSpending ?? null) : null,
    expectsThirdPartyContributions: answers.expectsThirdPartyContributions,
    expectsPartyOrListSupport: answers.expectsPartyOrListSupport,
    expectsInKindContributions: answers.expectsInKindContributions,
    plannedTotalSpending: answers.plannedTotalSpending ?? null,
    declaredByUserId: actorUserId
  };

  await prisma.$transaction(async (tx) => {
    const before = await tx.campaignSetup.findUnique({ where: { campaignId } });
    const setup = await tx.campaignSetup.upsert({
      where: { campaignId },
      create: { campaignId, ...data },
      update: data
    });
    await tx.campaign.updateMany({
      where: { id: campaignId, organizationId, status: CampaignStatus.DRAFT },
      data: { status: CampaignStatus.SETUP }
    });
    await tx.auditLog.create({
      data: {
        organizationId,
        campaignId,
        userId: actorUserId,
        action: before ? "CAMPAIGN_SETUP_UPDATED" : "CAMPAIGN_SETUP_DECLARED",
        entityType: "CampaignSetup",
        entityId: setup.campaignId,
        beforeJson: before
          ? ({
              expectsOwnSpending: before.expectsOwnSpending,
              plannedOwnSpending: before.plannedOwnSpending?.toString() ?? null,
              expectsThirdPartyContributions: before.expectsThirdPartyContributions,
              expectsPartyOrListSupport: before.expectsPartyOrListSupport,
              expectsInKindContributions: before.expectsInKindContributions
            } as Prisma.InputJsonValue)
          : undefined,
        afterJson: {
          expectsOwnSpending: setup.expectsOwnSpending,
          plannedOwnSpending: setup.plannedOwnSpending?.toString() ?? null,
          expectsThirdPartyContributions: setup.expectsThirdPartyContributions,
          expectsPartyOrListSupport: setup.expectsPartyOrListSupport,
          expectsInKindContributions: setup.expectsInKindContributions
        } as Prisma.InputJsonValue
      }
    });
  });

  const mandatary = await refreshMandataryRequirement(actorUserId, organizationId, campaignId);
  return { mandatary };
}

export async function setProclamationDate(
  actorUserId: string,
  organizationId: string,
  campaignId: string,
  proclamationDate: Date
) {
  await requireCampaignPermission(actorUserId, organizationId, campaignId, "campaign:manage");
  const before = await prisma.campaign.findFirst({
    where: { id: campaignId, organizationId },
    select: { proclamationDate: true }
  });
  if (!before) throw new HttpError(404, "CAMPAIGN_NOT_FOUND", "Campagna non trovata");

  await prisma.$transaction(async (tx) => {
    await tx.campaign.update({
      where: { id: campaignId },
      data: { proclamationDate, status: CampaignStatus.POST_ELECTION }
    });
    await tx.auditLog.create({
      data: {
        organizationId,
        campaignId,
        userId: actorUserId,
        action: "CAMPAIGN_PROCLAMATION_DATE_SET",
        entityType: "Campaign",
        entityId: campaignId,
        beforeJson: {
          proclamationDate: before.proclamationDate?.toISOString() ?? null
        } as Prisma.InputJsonValue,
        afterJson: { proclamationDate: proclamationDate.toISOString() } as Prisma.InputJsonValue
      }
    });
  });

  /** E' l'evento che fa decorrere il termine del rendiconto: le scadenze vanno ricalcolate. */
  return evaluateCampaign(actorUserId, organizationId, campaignId);
}

export type SetupStatus = {
  campaignId: string;
  steps: { key: string; label: string; done: boolean; blocking: boolean }[];
  complete: boolean;
  mandatary: {
    requirement: MandataryRequirement;
    ruleCodes: string | null;
    evaluatedAt: Date | null;
    profileExists: boolean;
  };
};

export async function getSetupStatus(
  actorUserId: string,
  organizationId: string,
  campaignId: string
): Promise<SetupStatus> {
  await requireCampaignAccess(actorUserId, organizationId, campaignId);
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, organizationId },
    include: {
      setup: true,
      candidateProfile: { select: { id: true } },
      mandataryProfile: { select: { id: true } },
      territory: { select: { id: true } }
    }
  });
  if (!campaign) throw new HttpError(404, "CAMPAIGN_NOT_FOUND", "Campagna non trovata");

  const mandataryNeeded = campaign.mandataryRequirement === MandataryRequirement.REQUIRED;
  /**
   * Un passaggio e' concluso solo se il regime e' stato davvero determinato. Con
   * `UNKNOWN` o `EVALUATION_INCOMPLETE` non lo e': mostrare comunque una spunta
   * verde farebbe leggere "non ti serve il mandatario" a chi invece non ha
   * ricevuto nessuna risposta. E' il fraintendimento piu' costoso che questa
   * schermata possa produrre.
   */
  const mandataryDetermined =
    campaign.mandataryRequirement === MandataryRequirement.NOT_REQUIRED ||
    campaign.mandataryRequirement === MandataryRequirement.NOT_APPLICABLE;
  const steps = [
    {
      key: "CANDIDATE",
      label: "Anagrafica del candidato",
      done: campaign.candidateProfile !== null,
      blocking: true
    },
    {
      key: "TERRITORY",
      label: "Comune della candidatura",
      done: campaign.territoryId !== null,
      blocking: true
    },
    {
      key: "SETUP",
      label: "Questionario iniziale",
      done: campaign.setup !== null,
      blocking: true
    },
    {
      key: "MANDATARY",
      label: "Mandatario elettorale",
      done: mandataryDetermined || (mandataryNeeded && campaign.mandataryProfile !== null),
      blocking: mandataryNeeded
    }
  ];

  return {
    campaignId,
    steps,
    complete: steps.every((step) => step.done || !step.blocking),
    mandatary: {
      requirement: campaign.mandataryRequirement,
      ruleCodes: campaign.mandataryRequirementRuleCode,
      evaluatedAt: campaign.mandataryRequirementEvaluatedAt,
      profileExists: campaign.mandataryProfile !== null
    }
  };
}

export async function completeSetup(
  actorUserId: string,
  organizationId: string,
  campaignId: string
) {
  await requireCampaignPermission(actorUserId, organizationId, campaignId, "campaign:manage");
  const status = await getSetupStatus(actorUserId, organizationId, campaignId);
  if (!status.complete) {
    const missing = status.steps.filter((step) => step.blocking && !step.done).map((s) => s.label);
    throw new HttpError(
      422,
      "SETUP_INCOMPLETE",
      `Passaggi ancora da completare: ${missing.join(", ")}`
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.campaign.update({
      where: { id: campaignId },
      data: { setupCompletedAt: new Date(), status: CampaignStatus.ACTIVE }
    });
    await tx.auditLog.create({
      data: {
        organizationId,
        campaignId,
        userId: actorUserId,
        action: "CAMPAIGN_SETUP_COMPLETED",
        entityType: "Campaign",
        entityId: campaignId,
        afterJson: {
          mandataryRequirement: status.mandatary.requirement,
          ruleCodes: status.mandatary.ruleCodes
        } as Prisma.InputJsonValue
      }
    });
  });

  return getSetupStatus(actorUserId, organizationId, campaignId);
}
