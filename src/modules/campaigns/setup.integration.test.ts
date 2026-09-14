import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { CampaignRole, MembershipStatus, OrganizationType } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { getSetupStatus, saveCampaignSetup, setProclamationDate } from "@/modules/campaigns/setup";
import { createContribution } from "@/modules/finance/service";
import { linkCampaignToMunicipality } from "@/modules/territories/service";

/**
 * Percorso completo di apertura di una campagna, sul database reale.
 *
 * Il ruleset usato qui e' creato dal test e portato in stato ACTIVE: le bozze
 * caricate in produzione restano inattive per scelta, e attivarle per far
 * passare un test sarebbe esattamente il genere di scorciatoia che la policy
 * legale vieta. Le regole sono pero' quelle vere, lette dal file dei seed.
 */
const suffix = randomUUID().slice(0, 8);
const ids = {
  userId: "",
  organizationId: "",
  campaignId: "",
  territoryId: "",
  rulesetVersionId: "",
  donorId: "",
  planId: ""
};

type SeedRule = {
  ruleCode: string;
  name: string;
  description: string;
  category: string;
  severityDefault: "INFO" | "ACTION_REQUIRED" | "WARNING" | "CRITICAL" | "BLOCKER";
  conditionExpression: unknown;
  effectType: string;
  effectPayload: unknown;
};

beforeAll(async () => {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL non configurata: questo test richiede il database.");

  const seed = JSON.parse(readFileSync("prisma/seeds/initial-ruleset-drafts.json", "utf8")) as {
    rulesets: {
      electionType: string;
      parameters: { code: string; value: string; unit?: string }[];
      rules: SeedRule[];
    }[];
  };
  const municipal = seed.rulesets.find((ruleset) => ruleset.electionType === "MUNICIPAL")!;

  const ruleset = await prisma.rulesetVersion.create({
    data: {
      name: `Ruleset di prova ${suffix}`,
      jurisdiction: `TEST-${suffix}`,
      electionType: "MUNICIPAL",
      version: "test",
      effectiveFrom: new Date("2026-01-01"),
      status: "ACTIVE",
      parameters: {
        create: municipal.parameters.map((parameter) => ({
          code: parameter.code,
          value: parameter.value,
          unit: parameter.unit ?? null
        }))
      },
      rules: {
        create: municipal.rules.map((rule) => ({
          ruleCode: rule.ruleCode,
          name: rule.name,
          description: rule.description,
          category: rule.category,
          severityDefault: rule.severityDefault,
          conditionExpression: rule.conditionExpression as object,
          effectType: rule.effectType,
          effectPayload: rule.effectPayload as object,
          isActive: true
        }))
      }
    }
  });
  ids.rulesetVersionId = ruleset.id;

  const region = await prisma.territory.create({
    data: { type: "REGION", name: `Regione di prova ${suffix}` }
  });
  const province = await prisma.territory.create({
    data: { type: "PROVINCE", name: `PR${suffix.slice(0, 2)}`, parentId: region.id }
  });
  const municipality = await prisma.territory.create({
    data: {
      type: "MUNICIPALITY",
      name: `Comune di prova ${suffix}`,
      istatCode: `T${suffix}`,
      parentId: province.id,
      population: 380_000,
      registeredVoters: 250_000,
      source: "fixture di test",
      sourceVerifiedAt: new Date()
    }
  });
  ids.territoryId = municipality.id;

  const user = await prisma.user.create({
    data: {
      email: `candidato-${suffix}@test.local`,
      passwordHash: "x",
      firstName: "Candidato",
      lastName: "Prova"
    }
  });
  ids.userId = user.id;

  const organization = await prisma.organization.create({
    data: {
      name: `Org ${suffix}`,
      type: OrganizationType.INDIVIDUAL,
      ownerUserId: user.id,
      members: { create: { userId: user.id, role: "OWNER", status: MembershipStatus.ACTIVE } },
      campaigns: {
        create: {
          name: `Comunali di prova ${suffix}`,
          electionType: "MUNICIPAL",
          officeSought: "MUNICIPAL_COUNCILLOR",
          rulesetVersionId: ruleset.id,
          members: {
            create: {
              userId: user.id,
              role: CampaignRole.CANDIDATE,
              status: MembershipStatus.ACTIVE,
              joinedAt: new Date()
            }
          },
          candidateProfile: {
            create: { userId: user.id, firstName: "Candidato", lastName: "Prova" }
          }
        }
      }
    },
    include: { campaigns: true }
  });
  ids.organizationId = organization.id;
  ids.campaignId = organization.campaigns[0]!.id;

  /**
   * L'organizzazione viene creata direttamente, quindi non passa dal servizio che
   * apre la prova gratuita: senza abbonamento le scritture sarebbero rifiutate.
   * Il fixture rappresenta un'organizzazione in prova, come quella di un utente
   * appena registrato.
   */
  const plan = await prisma.plan.create({
    data: {
      code: `TEST-${suffix}`,
      name: "Piano di prova",
      description: "Piano usato dai test di integrazione.",
      priceCents: 0,
      interval: "CAMPAIGN",
      campaignLimit: null,
      isPublic: false,
      sortOrder: 999
    }
  });
  ids.planId = plan.id;
  await prisma.subscription.create({
    data: {
      organizationId: organization.id,
      planId: plan.id,
      status: "TRIALING",
      trialEndsAt: new Date(Date.now() + 30 * 86_400_000)
    }
  });

  const donor = await prisma.donor.create({
    data: { type: "INDIVIDUAL", firstName: "Amico", lastName: "Generoso" }
  });
  ids.donorId = donor.id;
});

afterAll(async () => {
  const { campaignId, organizationId, userId, rulesetVersionId, territoryId, donorId, planId } =
    ids;
  if (campaignId) {
    await prisma.auditLog.deleteMany({ where: { campaignId } });
    await prisma.deadline.deleteMany({ where: { campaignId } });
    await prisma.task.deleteMany({ where: { campaignId } });
    await prisma.complianceFinding.deleteMany({ where: { campaignId } });
    await prisma.contribution.deleteMany({ where: { campaignId } });
    await prisma.campaignSetup.deleteMany({ where: { campaignId } });
    await prisma.candidateProfile.deleteMany({ where: { campaignId } });
    await prisma.campaignMember.deleteMany({ where: { campaignId } });
    await prisma.campaign.deleteMany({ where: { id: campaignId } });
  }
  if (organizationId) {
    await prisma.auditLog.deleteMany({ where: { organizationId } });
    await prisma.subscription.deleteMany({ where: { organizationId } });
    await prisma.organizationMember.deleteMany({ where: { organizationId } });
    await prisma.organization.deleteMany({ where: { id: organizationId } });
  }
  if (planId) await prisma.plan.deleteMany({ where: { id: planId } });
  if (donorId) await prisma.donor.deleteMany({ where: { id: donorId } });
  if (userId) await prisma.user.deleteMany({ where: { id: userId } });
  if (rulesetVersionId) await prisma.rulesetVersion.deleteMany({ where: { id: rulesetVersionId } });
  if (territoryId) {
    const municipality = await prisma.territory.findUnique({
      where: { id: territoryId },
      select: { parentId: true }
    });
    const province = municipality?.parentId
      ? await prisma.territory.findUnique({
          where: { id: municipality.parentId },
          select: { id: true, parentId: true }
        })
      : null;
    await prisma.territory.deleteMany({ where: { id: territoryId } });
    if (province) await prisma.territory.deleteMany({ where: { id: province.id } });
    if (province?.parentId) await prisma.territory.deleteMany({ where: { id: province.parentId } });
  }
  await prisma.$disconnect();
});

describe("apertura della campagna", () => {
  it("collega la campagna al comune e ne eredita popolazione e provincia", async () => {
    const result = await linkCampaignToMunicipality(
      ids.userId,
      ids.organizationId,
      ids.campaignId,
      ids.territoryId
    );
    expect(result.municipality.population).toBe(380_000);
    expect(result.campaign.territoryId).toBe(ids.territoryId);
  });

  it("da una campagna autofinanziata sotto soglia conclude che il mandatario non serve", async () => {
    const { mandatary } = await saveCampaignSetup(ids.userId, ids.organizationId, ids.campaignId, {
      expectsOwnSpending: true,
      plannedOwnSpending: "1800.00",
      expectsThirdPartyContributions: false,
      expectsPartyOrListSupport: false,
      expectsInKindContributions: false
    });
    expect(mandatary.requirement).toBe("NOT_REQUIRED");
    expect(mandatary.ruleCodes).toContain("IT-COM-MAND-EXC-001");
  });

  it("pretende l'importo previsto quando si dichiara di spendere denaro proprio", async () => {
    await expect(
      saveCampaignSetup(ids.userId, ids.organizationId, ids.campaignId, {
        expectsOwnSpending: true,
        expectsThirdPartyContributions: false,
        expectsPartyOrListSupport: false,
        expectsInKindContributions: false
      })
    ).rejects.toMatchObject({ code: "SETUP_PLANNED_OWN_SPENDING_REQUIRED" });
  });
});

describe("i fatti prevalgono sulle dichiarazioni", () => {
  /**
   * E' il comportamento che giustifica il prodotto: il candidato aveva dichiarato
   * una campagna interamente autofinanziata, incassa un contributo da un amico, e
   * il regime cambia subito invece che tre mesi dopo davanti al Collegio.
   */
  it("un contributo di terzi ribalta il regime dichiarato", async () => {
    const before = await getSetupStatus(ids.userId, ids.organizationId, ids.campaignId);
    expect(before.mandatary.requirement).toBe("NOT_REQUIRED");

    const result = await createContribution(
      {
        actorUserId: ids.userId,
        organizationId: ids.organizationId,
        campaignId: ids.campaignId
      },
      { donorId: ids.donorId, type: "MONEY", date: new Date("2027-04-10"), amount: "500.00" }
    );

    expect(result.reevaluated).toBe(true);
    expect(result.mandatary?.requirement).toBe("REQUIRED");

    const after = await getSetupStatus(ids.userId, ids.organizationId, ids.campaignId);
    expect(after.mandatary.requirement).toBe("REQUIRED");
    expect(after.mandatary.profileExists).toBe(false);
    expect(after.complete).toBe(false);
  });

  it("apre un rilievo bloccante e l'attivita' corrispondente", async () => {
    const [findings, tasks] = await Promise.all([
      prisma.complianceFinding.findMany({
        where: { campaignId: ids.campaignId, status: "OPEN" },
        include: { rule: { select: { ruleCode: true } } }
      }),
      prisma.task.findMany({ where: { campaignId: ids.campaignId, status: "OPEN" } })
    ]);
    expect(findings.some((finding) => finding.severity === "BLOCKER")).toBe(true);
    expect(findings.map((finding) => finding.rule.ruleCode)).toContain("IT-COM-MAND-001");
    expect(tasks.map((task) => task.title)).toContain(
      "Verificare la nomina del mandatario elettorale"
    );
  });

  it("registra il cambio di regime nel registro delle operazioni", async () => {
    const entries = await prisma.auditLog.findMany({
      where: { campaignId: ids.campaignId, action: "MANDATARY_REQUIREMENT_CHANGED" },
      orderBy: { createdAt: "asc" }
    });
    expect(entries.length).toBeGreaterThanOrEqual(2);
    const last = entries.at(-1)!;
    expect(last.beforeJson).toMatchObject({ requirement: "NOT_REQUIRED" });
    expect(last.afterJson).toMatchObject({ requirement: "REQUIRED" });
  });
});

describe("proclamazione e termine del rendiconto", () => {
  it("prima della proclamazione non esiste alcuna scadenza del rendiconto", async () => {
    const deadlines = await prisma.deadline.findMany({ where: { campaignId: ids.campaignId } });
    expect(deadlines).toHaveLength(0);
  });

  it("registrata la proclamazione, calcola il termine a tre mesi", async () => {
    await setProclamationDate(
      ids.userId,
      ids.organizationId,
      ids.campaignId,
      new Date("2027-05-31")
    );
    const deadline = await prisma.deadline.findFirst({
      where: { campaignId: ids.campaignId },
      select: {
        name: true,
        triggerEvent: true,
        offsetDefinition: true,
        calculatedDueDate: true
      }
    });
    expect(deadline).toMatchObject({ triggerEvent: "PROCLAMATION", offsetDefinition: "P3M" });
    // 31 maggio + tre mesi = 31 agosto, non 29 agosto come sarebbero novanta giorni.
    expect(deadline?.calculatedDueDate?.toISOString().slice(0, 10)).toBe("2027-08-31");
  });
});
