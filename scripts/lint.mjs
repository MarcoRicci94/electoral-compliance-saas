import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]))).flat();
}

const sourceFiles = (await files("src")).filter((file) => /\.(ts|tsx)$/.test(file) && !file.includes(".test."));
const forbidden = [
  { expression: /\bas any\b/, message: "evitare `as any`" },
  { expression: /Math\.round\([^)]*(amount|money|gross|net|vat)/i, message: "non arrotondare denaro con Math.round" },
  { expression: /findUnique\(\{\s*where:\s*\{\s*id\s*\}/, message: "vietata lettura Prisma non scopeata per solo id" }
];
const errors = [];

for (const file of sourceFiles) {
  const content = await readFile(file, "utf8");
  for (const rule of forbidden) if (rule.expression.test(content)) errors.push(`${file}: ${rule.message}`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Policy lint superato: ${sourceFiles.length} file controllati.`);
