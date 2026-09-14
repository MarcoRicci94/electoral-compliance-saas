/**
 * Carica il listino. Idempotente: aggiorna i piani esistenti per codice e non
 * ne disattiva nessuno, perche' disattivare un piano a cui sono gia' agganciati
 * abbonamenti e' una decisione commerciale, non un effetto di uno script.
 */
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const seed = JSON.parse(await readFile("prisma/seeds/plans.json", "utf8"));

for (const plan of seed.plans) {
  const data = {
    name: plan.name,
    description: plan.description,
    priceCents: plan.priceCents,
    currency: plan.currency,
    interval: plan.interval,
    campaignLimit: plan.campaignLimit ?? null,
    isPublic: plan.isPublic,
    sortOrder: plan.sortOrder
  };
  await prisma.plan.upsert({
    where: { code: plan.code },
    update: data,
    create: { code: plan.code, ...data }
  });
}

console.log(`Listino caricato: ${seed.plans.length} piani.`);
console.log("I prezzi sono una proposta di partenza e vanno confermati prima della vendita.");
await prisma.$disconnect();
