/**
 * Carica i ruleset di bozza in `prisma/seeds/initial-ruleset-drafts.json`.
 *
 * Il caricamento e' idempotente e non attiva mai nulla: i ruleset restano in
 * stato DRAFT e ogni regola resta `isActive = false`. L'attivazione e' un atto
 * di un revisore, non un effetto collaterale di un seed.
 */
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const seed = JSON.parse(await readFile("prisma/seeds/initial-ruleset-drafts.json", "utf8"));

if (seed.status !== "LEGAL_REVIEW_REQUIRED") {
  console.error(
    `Il file dei seed dichiara lo stato "${seed.status}". Questo caricatore accetta solo bozze in LEGAL_REVIEW_REQUIRED.`
  );
  process.exit(1);
}

const sourceIdByKey = new Map();
for (const source of seed.legalSources ?? []) {
  const existing = await prisma.legalSource.findFirst({
    where: { title: source.title },
    select: { id: true }
  });
  const data = {
    sourceType: source.sourceType,
    title: source.title,
    lawNumber: source.lawNumber ?? null,
    lawDate: source.lawDate ? new Date(source.lawDate) : null,
    article: source.article ?? null,
    authority: source.authority ?? null,
    officialUrl: source.officialUrl ?? null,
    // Nessuna fonte viene marcata come verificata da uno script.
    verifiedAt: null,
    verifiedBy: null
  };
  const record = existing
    ? await prisma.legalSource.update({ where: { id: existing.id }, data })
    : await prisma.legalSource.create({ data });
  sourceIdByKey.set(source.key, record.id);
}

let ruleCount = 0;
let parameterCount = 0;

for (const ruleset of seed.rulesets) {
  const version = await prisma.rulesetVersion.upsert({
    where: {
      jurisdiction_electionType_version: {
        jurisdiction: ruleset.jurisdiction,
        electionType: ruleset.electionType,
        version: ruleset.version
      }
    },
    update: { name: ruleset.name },
    create: {
      name: ruleset.name,
      jurisdiction: ruleset.jurisdiction,
      electionType: ruleset.electionType,
      version: ruleset.version,
      effectiveFrom: new Date(ruleset.effectiveFrom),
      status: "DRAFT"
    }
  });

  if (version.status !== "DRAFT") {
    console.error(
      `Il ruleset ${ruleset.name} risulta in stato ${version.status}: il caricatore non modifica un ruleset gia' uscito dalla bozza.`
    );
    continue;
  }

  for (const parameter of ruleset.parameters ?? []) {
    await prisma.ruleParameter.upsert({
      where: {
        rulesetVersionId_code: { rulesetVersionId: version.id, code: parameter.code }
      },
      update: { value: parameter.value, unit: parameter.unit ?? null },
      create: {
        rulesetVersionId: version.id,
        code: parameter.code,
        value: parameter.value,
        unit: parameter.unit ?? null,
        legalSourceId: sourceIdByKey.get(parameter.legalSourceKey) ?? null
      }
    });
    parameterCount += 1;
  }

  for (const rule of ruleset.rules) {
    const legalSourceId = sourceIdByKey.get(rule.legalSourceKey) ?? null;
    if (!legalSourceId)
      console.warn(`Regola ${rule.ruleCode}: fonte "${rule.legalSourceKey}" non trovata.`);

    const data = {
      name: rule.name,
      description: rule.description,
      category: rule.category,
      severityDefault: rule.severityDefault,
      conditionExpression: rule.conditionExpression,
      effectType: rule.effectType,
      effectPayload: rule.effectPayload,
      legalSourceId,
      // Mai attivata da uno script.
      isActive: false
    };

    await prisma.complianceRule.upsert({
      where: {
        rulesetVersionId_ruleCode: { rulesetVersionId: version.id, ruleCode: rule.ruleCode }
      },
      update: data,
      create: { rulesetVersionId: version.id, ruleCode: rule.ruleCode, ...data }
    });
    ruleCount += 1;
  }
}

console.log(
  `Bozze caricate: ${seed.rulesets.length} ruleset, ${ruleCount} regole, ${parameterCount} parametri, ${sourceIdByKey.size} fonti.`
);
console.log("Tutti i ruleset restano in stato DRAFT e nessuna regola e' attiva.");
await prisma.$disconnect();
