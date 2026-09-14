import { randomUUID } from "node:crypto";
import { CampaignRole, MembershipStatus, OrganizationType } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { requireCampaignAccess, requireOrganizationMember } from "@/modules/access/service";

/**
 * Questo test interroga il database reale attraverso i servizi di accesso effettivi.
 * La versione precedente rimplementava la logica di autorizzazione dentro il test
 * stesso: verificava la copia, non il codice di produzione.
 *
 * Richiede un PostgreSQL con lo schema migrato. Senza `DATABASE_URL` fallisce in
 * modo esplicito: un test di isolamento fra tenant che si salta da solo e' peggio
 * di un test assente, perche' fa credere che la verifica sia stata fatta.
 */
const suffix = randomUUID().slice(0, 8);
const created = { userIds: [] as string[], organizationIds: [] as string[] };

beforeAll(async () => {
  if (!process.env.DATABASE_URL)
    throw new Error(
      "DATABASE_URL non configurata: i test di integrazione richiedono un PostgreSQL con lo schema migrato."
    );

  const [alice, mallory] = await Promise.all([
    prisma.user.create({
      data: {
        email: `alice-${suffix}@test.local`,
        passwordHash: "x",
        firstName: "Alice",
        lastName: "Test"
      }
    }),
    prisma.user.create({
      data: {
        email: `mallory-${suffix}@test.local`,
        passwordHash: "x",
        firstName: "Mallory",
        lastName: "Test"
      }
    })
  ]);
  created.userIds.push(alice.id, mallory.id);

  const organizationA = await prisma.organization.create({
    data: {
      name: `Org A ${suffix}`,
      type: OrganizationType.INDIVIDUAL,
      ownerUserId: alice.id,
      members: {
        create: { userId: alice.id, role: "OWNER", status: MembershipStatus.ACTIVE }
      },
      campaigns: {
        create: {
          name: `Campagna A ${suffix}`,
          electionType: "MUNICIPAL",
          officeSought: "MUNICIPAL_COUNCILLOR",
          members: {
            create: {
              userId: alice.id,
              role: CampaignRole.CANDIDATE,
              status: MembershipStatus.ACTIVE,
              joinedAt: new Date()
            }
          }
        }
      }
    },
    include: { campaigns: true }
  });

  const organizationB = await prisma.organization.create({
    data: {
      name: `Org B ${suffix}`,
      type: OrganizationType.INDIVIDUAL,
      ownerUserId: mallory.id,
      members: {
        create: { userId: mallory.id, role: "OWNER", status: MembershipStatus.ACTIVE }
      }
    }
  });
  created.organizationIds.push(organizationA.id, organizationB.id);

  Object.assign(globalThis, {
    __fixture: {
      aliceId: alice.id,
      malloryId: mallory.id,
      organizationA: organizationA.id,
      organizationB: organizationB.id,
      campaignA: organizationA.campaigns[0]!.id
    }
  });
});

afterAll(async () => {
  await prisma.campaign.deleteMany({ where: { organizationId: { in: created.organizationIds } } });
  await prisma.organization.deleteMany({ where: { id: { in: created.organizationIds } } });
  await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
  await prisma.$disconnect();
});

function fixture() {
  return (globalThis as unknown as { __fixture: Record<string, string> }).__fixture;
}

describe("isolamento fra tenant", () => {
  it("consente al proprietario l'accesso alla propria campagna", async () => {
    const { aliceId, organizationA, campaignA } = fixture();
    await expect(requireCampaignAccess(aliceId, organizationA, campaignA)).resolves.toMatchObject({
      role: CampaignRole.CANDIDATE
    });
  });

  it("nega l'accesso a un id di campagna valido appartenente a un'altra organizzazione", async () => {
    const { malloryId, organizationB, campaignA } = fixture();
    await expect(requireCampaignAccess(malloryId, organizationB, campaignA)).rejects.toMatchObject({
      code: "CAMPAIGN_ACCESS_DENIED"
    });
  });

  it("nega l'accesso quando l'id di campagna corretto viene abbinato a un'organizzazione altrui", async () => {
    const { malloryId, organizationA, campaignA } = fixture();
    await expect(requireCampaignAccess(malloryId, organizationA, campaignA)).rejects.toMatchObject({
      code: "ORGANIZATION_ACCESS_DENIED"
    });
  });

  it("nega l'appartenenza a un'organizzazione di cui l'utente non e' membro", async () => {
    const { aliceId, organizationB } = fixture();
    await expect(requireOrganizationMember(aliceId, organizationB)).rejects.toMatchObject({
      code: "ORGANIZATION_ACCESS_DENIED"
    });
  });

  it("nega l'accesso a un membro sospeso", async () => {
    const { aliceId, organizationA, campaignA } = fixture();
    await prisma.campaignMember.updateMany({
      where: { campaignId: campaignA, userId: aliceId },
      data: { status: MembershipStatus.SUSPENDED }
    });
    await expect(requireCampaignAccess(aliceId, organizationA, campaignA)).rejects.toMatchObject({
      code: "CAMPAIGN_ACCESS_DENIED"
    });
    await prisma.campaignMember.updateMany({
      where: { campaignId: campaignA, userId: aliceId },
      data: { status: MembershipStatus.ACTIVE }
    });
  });
});
