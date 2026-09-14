import { Decimal } from "@prisma/client/runtime/library";
import {
  ContributionStatus,
  ContributionType,
  ExpenseStatus,
  InKindContributionStatus,
  type Prisma
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { resolveDemographics, type Demographics } from "@/modules/rules/demographics";
import { formatLegalDate } from "@/modules/rules/legal-calendar";

/**
 * Contesto di valutazione.
 *
 * Le condizioni delle regole risolvono i loro percorsi contro questo oggetto e
 * soltanto contro questo: e' una superficie dichiarata, non una riga Prisma
 * passata cosi' com'e'. Aggiungere un campo qui e' una decisione, non un effetto
 * collaterale di una modifica allo schema.
 *
 * Gli importi sono stringhe decimali: il confronto avviene in `Decimal`, mai in
 * virgola mobile. Un dato assente resta assente e non diventa zero, perche' la
 * regola che lo interroga deve fallire in modo visibile.
 */
export type CampaignRuleContext = {
  today: string;
  campaign: {
    id: string;
    electionType: string;
    officeSought: string;
    status: string;
    region?: string;
    province?: string;
    municipality?: string;
    electionDate?: string;
    /**
     * Data di proclamazione: fa decorrere il termine per il rendiconto. Lo schema
     * non ha ancora la colonna corrispondente, quindi il campo e' dichiarato ma
     * sempre assente. Le regole che ne dipendono devono condizionarsi con
     * `exists`, cosi' restano inerti finche' il dato non c'e' invece di calcolare
     * una scadenza su un evento mai avvenuto.
     */
    proclamationDate?: string;
    hasCandidateProfile: boolean;
    isZeroCampaign: boolean;
  };
  election: {
    isLinked: boolean;
    type?: string;
    electionDate?: string;
    runoffDate?: string;
    callDate?: string;
    population?: number;
    registeredVoters?: number;
    hasVerifiedSource: boolean;
  };
  territory: {
    isLinked: boolean;
    type?: string;
    population?: number;
    registeredVoters?: number;
    hasVerifiedSource: boolean;
  };
  /**
   * Popolazione ed elettori iscritti gia' risolti fra elezione e territorio, con
   * l'indicazione della fonte di ciascun valore. Le regole devono leggere qui, non
   * da `election` o `territory`, cosi' la precedenza fra le fonti e' decisa in un
   * posto solo.
   */
  demographics: Demographics;
  mandatary: {
    exists: boolean;
    status?: string;
    appointmentDate?: string;
    hasIdentityDocument: boolean;
    hasAppointmentDocument: boolean;
    hasSubmissionReceipt: boolean;
  };
  finance: {
    hasAnyRecord: boolean;
    contributionsTotal: string;
    selfFinancingTotal: string;
    externalContributionsTotal: string;
    externalContributionCount: number;
    corporateContributionCount: number;
    corporateContributionsWithIncompleteDocumentation: number;
    inKindTotal: string;
    inKindWithoutSupportingDocument: number;
    expensesGrossTotal: string;
    expensesRelevantForLimitTotal: string;
    expensesPaidTotal: string;
    expensesOutstandingTotal: string;
  };
  donors: {
    maxAnnualAggregate: string;
    countOverThreeThousand: number;
  };
};

const ZERO = new Decimal(0);

function optionalDate(value: Date | null | undefined): string | undefined {
  return value ? formatLegalDate(value) : undefined;
}

function optionalText(value: string | null | undefined): string | undefined {
  return value ?? undefined;
}

function optionalNumber(value: number | null | undefined): number | undefined {
  return value === null || value === undefined ? undefined : value;
}

const campaignInclude = {
  election: true,
  territory: true,
  mandataryProfile: true,
  candidateProfile: { select: { id: true } }
} satisfies Prisma.CampaignInclude;

type CampaignWithContext = Prisma.CampaignGetPayload<{ include: typeof campaignInclude }>;

export class RuleContextError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "RuleContextError";
  }
}

/**
 * L'aggregato per finanziatore e' calcolato per anno solare, perche' gli obblighi
 * dichiarativi sono parametrati a quanto un soggetto eroga nell'anno e non alla
 * singola erogazione. Finche' non esiste la proiezione persistente prevista dalla
 * Milestone 4, viene ricalcolato qui a ogni valutazione.
 */
async function donorAggregates(campaignId: string) {
  const rows = await prisma.contribution.findMany({
    where: {
      campaignId,
      status: ContributionStatus.CONFIRMED,
      deletedAt: null,
      donorId: { not: null },
      type: { not: ContributionType.SELF_FINANCING }
    },
    select: { donorId: true, date: true, amount: true }
  });

  const totals = new Map<string, Decimal>();
  for (const row of rows) {
    const key = `${row.donorId}:${row.date.getUTCFullYear()}`;
    totals.set(key, (totals.get(key) ?? ZERO).plus(row.amount));
  }

  let max = ZERO;
  let countOverThreeThousand = 0;
  for (const total of totals.values()) {
    if (total.greaterThan(max)) max = total;
    if (total.greaterThan(3000)) countOverThreeThousand += 1;
  }
  return { maxAnnualAggregate: max.toFixed(2), countOverThreeThousand };
}

async function financeSnapshot(campaignId: string) {
  const [contributions, expenses, inKind, corporate, inKindUndocumented] = await Promise.all([
    prisma.contribution.groupBy({
      by: ["type"],
      where: { campaignId, status: ContributionStatus.CONFIRMED, deletedAt: null },
      _sum: { amount: true },
      _count: { _all: true }
    }),
    prisma.expense.aggregate({
      where: { campaignId, deletedAt: null, status: { not: ExpenseStatus.VOID } },
      _sum: {
        grossAmount: true,
        paidAmount: true,
        outstandingAmount: true,
        relevantAmountForLimit: true
      },
      _count: { _all: true }
    }),
    prisma.inKindContribution.aggregate({
      where: { campaignId, status: InKindContributionStatus.CONFIRMED },
      _sum: { estimatedValue: true },
      _count: { _all: true }
    }),
    prisma.contribution.findMany({
      where: {
        campaignId,
        status: ContributionStatus.CONFIRMED,
        deletedAt: null,
        donor: { type: "COMPANY" }
      },
      select: { corporateDetails: { select: { documentationStatus: true } } }
    }),
    prisma.inKindContribution.count({
      where: {
        campaignId,
        status: InKindContributionStatus.CONFIRMED,
        supportingDocumentId: null
      }
    })
  ]);

  let contributionsTotal = ZERO;
  let selfFinancingTotal = ZERO;
  let externalContributionsTotal = ZERO;
  let externalContributionCount = 0;
  for (const group of contributions) {
    const amount = group._sum.amount ?? ZERO;
    contributionsTotal = contributionsTotal.plus(amount);
    if (group.type === ContributionType.SELF_FINANCING) {
      selfFinancingTotal = selfFinancingTotal.plus(amount);
    } else {
      externalContributionsTotal = externalContributionsTotal.plus(amount);
      externalContributionCount += group._count._all;
    }
  }

  const corporateContributionsWithIncompleteDocumentation = corporate.filter(
    (row) => row.corporateDetails?.documentationStatus !== "COMPLETE"
  ).length;

  return {
    hasAnyRecord: contributions.length > 0 || expenses._count._all > 0 || inKind._count._all > 0,
    contributionsTotal: contributionsTotal.toFixed(2),
    selfFinancingTotal: selfFinancingTotal.toFixed(2),
    externalContributionsTotal: externalContributionsTotal.toFixed(2),
    externalContributionCount,
    corporateContributionCount: corporate.length,
    corporateContributionsWithIncompleteDocumentation,
    inKindTotal: (inKind._sum.estimatedValue ?? ZERO).toFixed(2),
    inKindWithoutSupportingDocument: inKindUndocumented,
    expensesGrossTotal: (expenses._sum.grossAmount ?? ZERO).toFixed(2),
    expensesRelevantForLimitTotal: (expenses._sum.relevantAmountForLimit ?? ZERO).toFixed(2),
    expensesPaidTotal: (expenses._sum.paidAmount ?? ZERO).toFixed(2),
    expensesOutstandingTotal: (expenses._sum.outstandingAmount ?? ZERO).toFixed(2)
  };
}

function assemble(
  campaign: CampaignWithContext,
  finance: Awaited<ReturnType<typeof financeSnapshot>>,
  donors: Awaited<ReturnType<typeof donorAggregates>>,
  evaluationDate: Date
): CampaignRuleContext {
  const election = campaign.election;
  const territory = campaign.territory;
  const mandatary = campaign.mandataryProfile;

  return {
    today: formatLegalDate(evaluationDate),
    campaign: {
      id: campaign.id,
      electionType: campaign.electionType,
      officeSought: campaign.officeSought,
      status: campaign.status,
      region: optionalText(campaign.region),
      province: optionalText(campaign.province),
      municipality: optionalText(campaign.municipality),
      electionDate: optionalDate(campaign.electionDate),
      proclamationDate: undefined,
      hasCandidateProfile: campaign.candidateProfile !== null,
      isZeroCampaign: !finance.hasAnyRecord
    },
    election: {
      isLinked: election !== null,
      type: election?.type,
      electionDate: optionalDate(election?.electionDate),
      runoffDate: optionalDate(election?.runoffDate),
      callDate: optionalDate(election?.callDate),
      population: optionalNumber(election?.population),
      registeredVoters: optionalNumber(election?.registeredVoters),
      hasVerifiedSource: Boolean(election?.sourceVerifiedAt)
    },
    territory: {
      isLinked: territory !== null,
      type: optionalText(territory?.type),
      population: optionalNumber(territory?.population),
      registeredVoters: optionalNumber(territory?.registeredVoters),
      hasVerifiedSource: Boolean(territory?.sourceVerifiedAt)
    },
    demographics: resolveDemographics(
      election
        ? {
            population: election.population,
            registeredVoters: election.registeredVoters,
            isVerified: Boolean(election.sourceVerifiedAt)
          }
        : null,
      territory
        ? {
            population: territory.population,
            registeredVoters: territory.registeredVoters,
            isVerified: Boolean(territory.sourceVerifiedAt)
          }
        : null
    ),
    mandatary: {
      exists: mandatary !== null,
      status: mandatary?.status,
      appointmentDate: optionalDate(mandatary?.appointmentDate),
      hasIdentityDocument: Boolean(mandatary?.identityDocumentId),
      hasAppointmentDocument: Boolean(mandatary?.appointmentDocumentId),
      hasSubmissionReceipt: Boolean(mandatary?.submissionReceiptId)
    },
    finance,
    donors
  };
}

export async function buildCampaignContext(
  campaignId: string,
  organizationId: string,
  evaluationDate = new Date()
): Promise<CampaignRuleContext> {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, organizationId },
    include: campaignInclude
  });
  if (!campaign)
    throw new RuleContextError("RULE_CONTEXT_CAMPAIGN_NOT_FOUND", "Campagna non trovata");

  const [finance, donors] = await Promise.all([
    financeSnapshot(campaignId),
    donorAggregates(campaignId)
  ]);
  return assemble(campaign, finance, donors, evaluationDate);
}

/** Riusabile dal rule tester: stesso assemblaggio, dati forniti dal chiamante. */
export const contextInternals = { assemble };
