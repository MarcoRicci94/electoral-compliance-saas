import { PrismaClient, CampaignRole, MembershipStatus, OrganizationType } from "@prisma/client";

const prisma = new PrismaClient();
const userId = "development-user";
const organizationId = "development-org";
const campaignId = "development-campaign";

await prisma.user.upsert({ where: { id: userId }, update: {}, create: { id: userId, email: "sviluppo@localhost", passwordHash: "development-only", firstName: "Utente", lastName: "Sviluppo" } });
await prisma.organization.upsert({ where: { id: organizationId }, update: {}, create: { id: organizationId, name: "Campagna di sviluppo", type: OrganizationType.INDIVIDUAL, ownerUserId: userId } });
await prisma.organizationMember.upsert({ where: { organizationId_userId: { organizationId, userId } }, update: { status: MembershipStatus.ACTIVE }, create: { organizationId, userId, role: "OWNER", status: MembershipStatus.ACTIVE, acceptedAt: new Date() } });
await prisma.campaign.upsert({ where: { id: campaignId }, update: {}, create: { id: campaignId, organizationId, name: "Elezioni comunali demo", electionType: "MUNICIPAL", officeSought: "MUNICIPAL_COUNCILLOR", municipality: "Firenze" } });
await prisma.campaignMember.upsert({ where: { campaignId_userId: { campaignId, userId } }, update: { status: MembershipStatus.ACTIVE, role: CampaignRole.CANDIDATE }, create: { campaignId, userId, role: CampaignRole.CANDIDATE, status: MembershipStatus.ACTIVE, joinedAt: new Date() } });
await prisma.candidateProfile.upsert({ where: { campaignId }, update: {}, create: { campaignId, userId, firstName: "Utente", lastName: "Sviluppo" } });

console.log("Fixture di sviluppo pronta.");
await prisma.$disconnect();
