import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { requireCampaignPermission } from "@/modules/access/service";

/**
 * Anagrafica territoriale.
 *
 * I territori sono dati condivisi fra tutti i tenant, non dati di campagna: si
 * leggono da qualunque utente autenticato e non si modificano dall'applicazione.
 * L'aggiornamento passa dal caricamento dell'anagrafica, cosi' la provenienza
 * resta una sola e nessun utente puo' alterare la popolazione da cui dipende
 * l'applicabilita' di una soglia di legge ad altre campagne.
 */

export type MunicipalitySummary = {
  id: string;
  istatCode: string | null;
  name: string;
  province: string | null;
  region: string | null;
  population: number | null;
  registeredVoters: number | null;
  isVerified: boolean;
  source: string | null;
};

const municipalitySelect = {
  id: true,
  istatCode: true,
  name: true,
  population: true,
  registeredVoters: true,
  source: true,
  sourceVerifiedAt: true,
  parent: { select: { name: true, parent: { select: { name: true } } } }
} satisfies Prisma.TerritorySelect;

type MunicipalityRow = Prisma.TerritoryGetPayload<{ select: typeof municipalitySelect }>;

function toSummary(row: MunicipalityRow): MunicipalitySummary {
  return {
    id: row.id,
    istatCode: row.istatCode,
    name: row.name,
    province: row.parent?.name ?? null,
    region: row.parent?.parent?.name ?? null,
    population: row.population,
    registeredVoters: row.registeredVoters,
    isVerified: Boolean(row.sourceVerifiedAt),
    source: row.source
  };
}

/**
 * Ricerca per il wizard di onboarding. Esistono comuni omonimi in province
 * diverse, quindi il risultato porta sempre provincia e regione: il nome da solo
 * non identifica il comune.
 */
export async function searchMunicipalities(query: string, limit = 20) {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const rows = await prisma.territory.findMany({
    where: { type: "MUNICIPALITY", name: { startsWith: trimmed, mode: "insensitive" } },
    select: municipalitySelect,
    orderBy: [{ population: "desc" }, { name: "asc" }],
    take: Math.min(limit, 50)
  });
  return rows.map(toSummary);
}

export async function getMunicipality(territoryId: string) {
  const row = await prisma.territory.findFirst({
    where: { id: territoryId, type: "MUNICIPALITY" },
    select: municipalitySelect
  });
  return row ? toSummary(row) : null;
}

/**
 * Collega la campagna a un comune. Copia nome, provincia e regione sulla
 * campagna per comodita' di lettura, ma il dato che conta resta il collegamento:
 * popolazione ed elettori iscritti vengono sempre riletti dall'anagrafica, mai
 * copiati, cosi' una correzione dell'anagrafica si riflette sulla valutazione
 * invece di lasciare in giro una copia diventata falsa.
 */
export async function linkCampaignToMunicipality(
  actorUserId: string,
  organizationId: string,
  campaignId: string,
  territoryId: string
) {
  await requireCampaignPermission(actorUserId, organizationId, campaignId, "campaign:manage");

  const municipality = await getMunicipality(territoryId);
  if (!municipality)
    throw new HttpError(404, "TERRITORY_NOT_FOUND", "Comune non trovato nell'anagrafica");

  return prisma.$transaction(async (tx) => {
    const before = await tx.campaign.findFirst({
      where: { id: campaignId, organizationId },
      select: { territoryId: true, municipality: true, province: true, region: true }
    });
    if (!before) throw new HttpError(404, "CAMPAIGN_NOT_FOUND", "Campagna non trovata");

    const campaign = await tx.campaign.update({
      where: { id: campaignId },
      data: {
        territoryId: municipality.id,
        municipality: municipality.name,
        province: municipality.province,
        region: municipality.region
      }
    });

    await tx.auditLog.create({
      data: {
        organizationId,
        campaignId,
        userId: actorUserId,
        action: "CAMPAIGN_TERRITORY_LINKED",
        entityType: "Campaign",
        entityId: campaignId,
        beforeJson: before as unknown as Prisma.InputJsonValue,
        afterJson: {
          territoryId: municipality.id,
          istatCode: municipality.istatCode,
          municipality: municipality.name,
          province: municipality.province,
          region: municipality.region,
          population: municipality.population,
          populationIsVerified: municipality.isVerified
        } as Prisma.InputJsonValue
      }
    });

    return { campaign, municipality };
  });
}
