/**
 * Carica l'anagrafica territoriale da `prisma/seeds/comuni-italia.csv`.
 *
 * Costruisce la gerarchia Regione -> Provincia -> Comune e valorizza la
 * popolazione residente di ciascun comune.
 *
 * Due avvertenze che il codice deve rendere impossibili da ignorare:
 *
 * 1. La popolazione residente NON e' il numero di elettori iscritti nelle liste
 *    elettorali. La soglia demografica dei comuni si misura sulla popolazione, ma
 *    i limiti di spesa sono parametrati agli elettori iscritti. Questo file non
 *    contiene quel dato, quindi `registeredVoters` resta vuoto e i calcoli dei
 *    limiti restano non valutabili finche' il dato non viene inserito con la sua
 *    fonte.
 * 2. La provenienza e la data di rilevazione del file non sono note. Nessun
 *    territorio viene marcato come verificato: `sourceVerifiedAt` resta null e le
 *    regole di sistema segnalano che i dati non sono verificati.
 */
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SOURCE =
  "prisma/seeds/comuni-italia.csv — file fornito dall'utente, provenienza e data di rilevazione non verificate";

function parseLine(line) {
  const [istat, comune, regione, provincia, residenti] = line.split(";");
  return {
    istatCode: istat.trim().padStart(6, "0"),
    name: comune.trim(),
    region: regione.trim(),
    province: provincia.trim(),
    population: Number.parseInt(residenti.trim(), 10)
  };
}

const rows = [];
const input = createInterface({
  input: createReadStream("prisma/seeds/comuni-italia.csv", { encoding: "utf8" }),
  crlfDelay: Infinity
});

let header = true;
for await (const rawLine of input) {
  const line = rawLine.replace(/^﻿/, "").trim();
  if (!line) continue;
  if (header) {
    header = false;
    if (!line.startsWith("istat;")) {
      console.error(`Intestazione inattesa: ${line}`);
      process.exit(1);
    }
    continue;
  }
  const row = parseLine(line);
  if (!row.istatCode || !row.name || !Number.isInteger(row.population)) {
    console.error(`Riga non valida, caricamento interrotto: ${line}`);
    process.exit(1);
  }
  rows.push(row);
}

console.log(`Righe lette: ${rows.length}`);

async function upsertContainer(type, name, parentId) {
  const existing = await prisma.territory.findFirst({
    where: { type, name, parentId: parentId ?? null },
    select: { id: true }
  });
  if (existing) return existing.id;
  const created = await prisma.territory.create({
    data: { type, name, parentId: parentId ?? null, source: SOURCE }
  });
  return created.id;
}

const regionIds = new Map();
const provinceIds = new Map();

for (const region of [...new Set(rows.map((row) => row.region))].sort()) {
  regionIds.set(region, await upsertContainer("REGION", region, null));
}
console.log(`Regioni: ${regionIds.size}`);

for (const key of [...new Set(rows.map((row) => `${row.region}|${row.province}`))].sort()) {
  const [region, province] = key.split("|");
  provinceIds.set(key, await upsertContainer("PROVINCE", province, regionIds.get(region)));
}
console.log(`Province: ${provinceIds.size}`);

let created = 0;
let updated = 0;

for (const row of rows) {
  const parentId = provinceIds.get(`${row.region}|${row.province}`);
  const data = {
    type: "MUNICIPALITY",
    name: row.name,
    parentId,
    population: row.population,
    // Data di rilevazione ignota: non si inventa.
    populationReferenceDate: null,
    // Il file non contiene gli elettori iscritti: resta vuoto per scelta.
    registeredVoters: null,
    registeredVotersReferenceDate: null,
    source: SOURCE,
    sourceVerifiedAt: null
  };
  const existing = await prisma.territory.findUnique({
    where: { istatCode: row.istatCode },
    select: { id: true }
  });
  if (existing) {
    await prisma.territory.update({ where: { id: existing.id }, data });
    updated += 1;
  } else {
    await prisma.territory.create({ data: { istatCode: row.istatCode, ...data } });
    created += 1;
  }
}

const aboveThreshold = rows.filter((row) => row.population > 15_000).length;

console.log(`Comuni creati: ${created}, aggiornati: ${updated}`);
console.log(`Comuni sopra i 15.000 abitanti: ${aboveThreshold}`);
console.log(
  "Nessun territorio e' marcato come verificato e nessuno ha gli elettori iscritti: i limiti di spesa restano non calcolabili finche' quel dato non viene inserito con la sua fonte."
);
await prisma.$disconnect();
