import { CampaignRole, MembershipStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireCampaignAccess, requireOrganizationMember } from "@/modules/access/service";

export type CreateCampaignInput = {
  organizationId: string;
  name: string;
  electionType: "POLITICAL" | "MUNICIPAL" | "REGIONAL";
  officeSought:
    | "DEPUTY"
    | "SENATOR"
    | "MAYOR"
    | "MUNICIPAL_COUNCILLOR"
    | "REGIONAL_PRESIDENT"
    | "REGIONAL_COUNCILLOR";
  municipality?: string;
  electionDate?: Date;
  candidate: { firstName: string; lastName: string; email?: string; phone?: string };
};

export async function createCampaign(userId: string, input: CreateCampaignInput) {
  await requireOrganizationMember(userId, input.organizationId);
  return prisma.$transaction(async (tx) => {
    const campaign = await tx.campaign.create({
      data: {
        organizationId: input.organizationId,
        name: input.name,
        electionType: input.electionType,
        officeSought: input.officeSought,
        municipality: input.municipality,
        electionDate: input.electionDate
      }
    });
    await tx.campaignMember.create({
      data: {
        campaignId: campaign.id,
        userId,
        role: CampaignRole.CANDIDATE,
        status: MembershipStatus.ACTIVE,
        joinedAt: new Date()
      }
    });
    await tx.candidateProfile.create({
      data: { campaignId: campaign.id, userId, ...input.candidate }
    });
    await tx.auditLog.create({
      data: {
        organizationId: input.organizationId,
        campaignId: campaign.id,
        userId,
        action: "CAMPAIGN_CREATED",
        entityType: "Campaign",
        entityId: campaign.id,
        afterJson: {
          name: campaign.name,
          electionType: campaign.electionType,
          officeSought: campaign.officeSought
        } as Prisma.InputJsonValue
      }
    });
    return campaign;
  });
}

export async function getCampaign(userId: string, organizationId: string, campaignId: string) {
  await requireCampaignAccess(userId, organizationId, campaignId);
  return prisma.campaign.findFirst({
    where: {
      id: campaignId,
      organizationId,
      members: { some: { userId, status: MembershipStatus.ACTIVE } }
    },
    include: { candidateProfile: true, mandataryProfile: true }
  });
}

export async function listCampaigns(userId: string, organizationId: string) {
  await requireOrganizationMember(userId, organizationId);
  return prisma.campaign.findMany({
    where: { organizationId, members: { some: { userId, status: MembershipStatus.ACTIVE } } },
    include: { candidateProfile: { select: { firstName: true, lastName: true } } },
    orderBy: { updatedAt: "desc" }
  });
}

/**
 * Elenco delle campagne dell'utente, attraverso tutte le organizzazioni di cui
 * e' membro attivo. Serve alla pagina iniziale, che deve poter mostrare le
 * campagne senza chiedere prima di scegliere un'organizzazione: il candidato
 * singolo non sa di averne una.
 */
export async function listUserCampaigns(userId: string) {
  const campaigns = await prisma.campaign.findMany({
    where: { members: { some: { userId, status: MembershipStatus.ACTIVE } } },
    select: {
      id: true,
      organizationId: true,
      name: true,
      electionType: true,
      officeSought: true,
      municipality: true,
      province: true,
      status: true,
      territoryId: true,
      setupCompletedAt: true,
      mandataryRequirement: true,
      updatedAt: true,
      organization: { select: { name: true } },
      setup: { select: { campaignId: true } },
      candidateProfile: { select: { firstName: true, lastName: true } },
      mandataryProfile: { select: { id: true } }
    },
    orderBy: { updatedAt: "desc" }
  });

  return campaigns.map((campaign) => ({
    ...campaign,
    hasTerritory: campaign.territoryId !== null,
    hasSetup: campaign.setup !== null,
    hasMandatary: campaign.mandataryProfile !== null
  }));
}
