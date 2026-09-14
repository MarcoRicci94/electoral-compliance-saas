import { randomUUID } from "node:crypto";
import { PlatformRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  activateRuleset,
  getRuleset,
  setRuleActive,
  updateRuleParameter,
  verifyLegalSource,
  verifyRuleParameter
} from "@/modules/administration/rulesets";

/**
 * Percorso di attivazione di un ruleset, sul database reale.
 *
 * Il ruleset e le fonti sono creati dal test: le bozze caricate in produzione
 * restano inattive, e la loro attivazione e' un atto che spetta a chi rivede le
 * fonti, non a una suite di test.
 */
const suffix = randomUUID().slice(0, 8);
const ids = {
  adminId: "",
  outsiderId: "",
  rulesetId: "",
  sourceId: "",
  systemSourceId: "",
  ruleId: "",
  systemRuleId: "",
  parameterId: ""
};

beforeAll(async () => {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL non configurata: questo test richiede il database.");

  const [admin, outsider] = await Promise.all([
    prisma.user.create({
      data: {
        email: `revisore-${suffix}@test.local`,
        passwordHash: "x",
        firstName: "Revisore",
        lastName: "Legale",
        platformRole: PlatformRole.ADMIN
      }
    }),
    prisma.user.create({
      data: {
        email: `estraneo-${suffix}@test.local`,
        passwordHash: "x",
        firstName: "Utente",
        lastName: "Qualunque"
      }
    })
  ]);
  ids.adminId = admin.id;
  ids.outsiderId = outsider.id;

  const source = await prisma.legalSource.create({
    data: { sourceType: "LAW", title: `Legge di prova ${suffix}` }
  });
  const systemSource = await prisma.legalSource.create({
    data: { sourceType: "SYSTEM_CONTROL", title: `Controllo di sistema ${suffix}` }
  });
  ids.sourceId = source.id;
  ids.systemSourceId = systemSource.id;

  const ruleset = await prisma.rulesetVersion.create({
    data: {
      name: `Ruleset attivabile ${suffix}`,
      jurisdiction: `TEST-ACT-${suffix}`,
      electionType: "MUNICIPAL",
      version: "v1",
      effectiveFrom: new Date("2026-01-01"),
      status: "DRAFT",
      parameters: {
        create: [{ code: "sogliaDemografica", value: "15000", note: "Valore non verificato." }]
      },
      rules: {
        create: [
          {
            ruleCode: "TEST-SCOPE-001",
            name: "Perimetro",
            description: "Regola di prova collegata a una fonte di legge.",
            category: "SCOPE",
            severityDefault: "INFO",
            conditionExpression: {
              field: "campaign.electionType",
              operator: "eq",
              value: "MUNICIPAL"
            },
            effectType: "INFORMATION",
            effectPayload: { title: "Perimetro", description: "Si applica." },
            legalSourceId: source.id,
            isActive: false
          },
          {
            ruleCode: "TEST-SYS-001",
            name: "Controllo di sistema",
            description: "Regola di prova senza fonte di legge.",
            category: "SYSTEM",
            severityDefault: "WARNING",
            conditionExpression: { field: "demographics.isVerified", operator: "eq", value: false },
            effectType: "WARNING",
            effectPayload: { title: "Dati non verificati", description: "Controllo." },
            legalSourceId: systemSource.id,
            isActive: false
          }
        ]
      }
    },
    include: { rules: true, parameters: true }
  });
  ids.rulesetId = ruleset.id;
  ids.parameterId = ruleset.parameters[0]!.id;
  ids.ruleId = ruleset.rules.find((rule) => rule.ruleCode === "TEST-SCOPE-001")!.id;
  ids.systemRuleId = ruleset.rules.find((rule) => rule.ruleCode === "TEST-SYS-001")!.id;
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({
    where: { userId: { in: [ids.adminId, ids.outsiderId].filter(Boolean) } }
  });
  if (ids.rulesetId) await prisma.rulesetVersion.deleteMany({ where: { id: ids.rulesetId } });
  await prisma.legalSource.deleteMany({
    where: { id: { in: [ids.sourceId, ids.systemSourceId].filter(Boolean) } }
  });
  await prisma.user.deleteMany({
    where: { id: { in: [ids.adminId, ids.outsiderId].filter(Boolean) } }
  });
  await prisma.$disconnect();
});

describe("chi non e' amministratore di piattaforma non tocca nulla", () => {
  it("non puo' leggere la console", async () => {
    await expect(getRuleset(ids.outsiderId, ids.rulesetId)).rejects.toMatchObject({
      code: "PLATFORM_ACCESS_DENIED"
    });
  });

  it("non puo' verificare una fonte ne' attivare un ruleset", async () => {
    await expect(verifyLegalSource(ids.outsiderId, ids.sourceId, {})).rejects.toMatchObject({
      code: "PLATFORM_ACCESS_DENIED"
    });
    await expect(
      activateRuleset(ids.outsiderId, ids.rulesetId, "nota sufficientemente lunga per passare")
    ).rejects.toMatchObject({ code: "PLATFORM_ACCESS_DENIED" });
  });
});

describe("l'attivazione richiede fonti verificate", () => {
  it("un ruleset senza regole attive non si attiva", async () => {
    const { readiness } = await getRuleset(ids.adminId, ids.rulesetId);
    expect(readiness.ready).toBe(false);
    expect(readiness.blockers[0]).toMatchObject({ code: "NO_ACTIVE_RULES" });
  });

  it("con una regola attiva ma la fonte non verificata, l'attivazione e' rifiutata", async () => {
    await setRuleActive(ids.adminId, ids.ruleId, true);
    await setRuleActive(ids.adminId, ids.systemRuleId, true);

    const { readiness } = await getRuleset(ids.adminId, ids.rulesetId);
    expect(readiness.ready).toBe(false);
    expect(readiness.blockers.map((blocker) => blocker.code)).toContain("UNVERIFIED_LEGAL_SOURCE");

    await expect(
      activateRuleset(ids.adminId, ids.rulesetId, "Verificato tutto, fidati sulla parola.")
    ).rejects.toMatchObject({ code: "RULESET_NOT_READY" });
  });

  it("pretende una nota di revisione non simbolica", async () => {
    await expect(activateRuleset(ids.adminId, ids.rulesetId, "ok")).rejects.toMatchObject({
      code: "REVIEW_NOTE_REQUIRED"
    });
  });

  it("la verifica di una fonte resta registrata con autore e data", async () => {
    await verifyLegalSource(ids.adminId, ids.sourceId, {
      officialUrl: "https://www.normattiva.it/esempio",
      notes: "Testo confrontato con la Gazzetta."
    });
    await verifyLegalSource(ids.adminId, ids.systemSourceId, {});

    const source = await prisma.legalSource.findUnique({ where: { id: ids.sourceId } });
    expect(source?.verifiedBy).toBe(ids.adminId);
    expect(source?.verifiedAt).toBeInstanceOf(Date);
    expect(source?.officialUrl).toBe("https://www.normattiva.it/esempio");

    const entry = await prisma.auditLog.findFirst({
      where: { action: "LEGAL_SOURCE_VERIFIED", entityId: ids.sourceId }
    });
    expect(entry?.userId).toBe(ids.adminId);
    /** Le azioni di piattaforma non appartengono a nessuna organizzazione. */
    expect(entry?.organizationId).toBeNull();
  });
});

describe("correzione e verifica dei parametri", () => {
  it("solo un amministratore di piattaforma puo' correggerli o verificarli", async () => {
    await expect(
      updateRuleParameter(ids.outsiderId, ids.parameterId, { value: "1" })
    ).rejects.toMatchObject({ code: "PLATFORM_ACCESS_DENIED" });
    await expect(verifyRuleParameter(ids.outsiderId, ids.parameterId)).rejects.toMatchObject({
      code: "PLATFORM_ACCESS_DENIED"
    });
  });

  it("rifiuta un valore che non e' un numero", async () => {
    // Compresa la forma italiana con la virgola: il motore di calcolo non la legge.
    for (const value of ["quindicimila", "15.000,50", "15 000", "", "1e5"])
      await expect(
        updateRuleParameter(ids.adminId, ids.parameterId, { value }),
        `valore rifiutato: ${JSON.stringify(value)}`
      ).rejects.toMatchObject({ code: "PARAMETER_NOT_NUMERIC" });
  });

  it("accetta interi, decimali col punto e negativi", async () => {
    for (const value of ["15000", "0.05", "-3", "  2500  "]) {
      const updated = await updateRuleParameter(ids.adminId, ids.parameterId, { value });
      expect(updated.value).toBe(value.trim());
    }
    await updateRuleParameter(ids.adminId, ids.parameterId, { value: "15000" });
  });

  it("salva un valore corretto con la sua nota e lascia traccia del vecchio", async () => {
    const updated = await updateRuleParameter(ids.adminId, ids.parameterId, {
      value: "15001.50",
      unit: "abitanti",
      note: "Art. 13 L. 96/2012, testo vigente."
    });
    expect(updated.value).toBe("15001.50");
    expect(updated.note).toBe("Art. 13 L. 96/2012, testo vigente.");

    const entry = await prisma.auditLog.findFirst({
      where: { action: "RULE_PARAMETER_UPDATED", entityId: ids.parameterId },
      orderBy: { createdAt: "desc" }
    });
    expect(entry?.beforeJson).toMatchObject({ value: "15000" });
    expect(entry?.afterJson).toMatchObject({ value: "15001.50" });
  });

  /**
   * Il punto della schermata: un numero cambiato non e' piu' il numero che
   * qualcuno aveva controllato, quindi la verifica precedente non lo copre.
   */
  it("correggere un valore gia' verificato azzera la verifica", async () => {
    const verified = await verifyRuleParameter(ids.adminId, ids.parameterId, "Letto in Gazzetta.");
    expect(verified.verifiedAt).toBeInstanceOf(Date);
    expect(verified.verifiedBy).toBe(ids.adminId);

    const changed = await updateRuleParameter(ids.adminId, ids.parameterId, { value: "15000" });
    expect(changed.verifiedAt).toBeNull();
    expect(changed.verifiedBy).toBeNull();
  });

  it("risalvare lo stesso valore non azzera la verifica", async () => {
    await verifyRuleParameter(ids.adminId, ids.parameterId);
    const resaved = await updateRuleParameter(ids.adminId, ids.parameterId, {
      value: "15000",
      note: "Nota aggiornata senza toccare il numero."
    });
    expect(resaved.verifiedAt).toBeInstanceOf(Date);
    expect(resaved.note).toBe("Nota aggiornata senza toccare il numero.");
  });
});

describe("attivazione", () => {
  it("attiva il ruleset e registra la nota di revisione", async () => {
    const { readiness } = await getRuleset(ids.adminId, ids.rulesetId);
    expect(readiness.ready).toBe(true);
    expect(readiness.activeRuleCount).toBe(2);

    const note = "Verificati soglia demografica e perimetro sul testo vigente in Gazzetta.";
    const result = await activateRuleset(ids.adminId, ids.rulesetId, note);
    expect(result.activated.status).toBe("ACTIVE");
    expect(result.activated.reviewedBy).toBe(ids.adminId);

    const entry = await prisma.auditLog.findFirst({
      where: { action: "RULESET_ACTIVATED", entityId: ids.rulesetId }
    });
    expect(entry?.afterJson).toMatchObject({ reviewNote: note, activeRuleCount: 2 });
  });

  /**
   * Un ruleset attivo non si modifica: le campagne lo stanno applicando, e
   * cambiare una regola sotto i loro piedi renderebbe irripetibile ogni
   * valutazione gia' compiuta.
   */
  it("un ruleset attivo non si modifica piu'", async () => {
    await expect(setRuleActive(ids.adminId, ids.ruleId, false)).rejects.toMatchObject({
      code: "RULESET_ALREADY_ACTIVE"
    });
    await expect(
      activateRuleset(
        ids.adminId,
        ids.rulesetId,
        "Nota abbastanza lunga per superare il controllo."
      )
    ).rejects.toMatchObject({ code: "RULESET_ALREADY_ACTIVE" });
  });
});
