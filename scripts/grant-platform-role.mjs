/**
 * Assegna un ruolo di piattaforma a un utente.
 *
 * Volutamente uno strumento da riga di comando e non una schermata: il primo
 * amministratore non puo' nominarsi da solo dall'applicazione, e chi ha accesso
 * al server e' gia' in grado di fare qualunque cosa. Ogni assegnazione lascia
 * traccia nel registro delle operazioni.
 *
 *   node scripts/grant-platform-role.mjs email@example.com ADMIN
 */
import { PrismaClient } from "@prisma/client";

const [email, role = "ADMIN"] = process.argv.slice(2);
if (!email) {
  console.error("Uso: node scripts/grant-platform-role.mjs <email> [NONE|SUPPORT|ADMIN]");
  process.exit(1);
}
if (!["NONE", "SUPPORT", "ADMIN"].includes(role)) {
  console.error(`Ruolo non valido: ${role}`);
  process.exit(1);
}

const prisma = new PrismaClient();
const user = await prisma.user.findUnique({
  where: { email: email.trim().toLowerCase() },
  select: { id: true, platformRole: true, firstName: true, lastName: true }
});
if (!user) {
  console.error(`Nessun utente con email ${email}`);
  process.exit(1);
}

await prisma.user.update({ where: { id: user.id }, data: { platformRole: role } });

const organization = await prisma.organization.findFirst({
  where: { ownerUserId: user.id },
  select: { id: true }
});
if (organization)
  await prisma.auditLog.create({
    data: {
      organizationId: organization.id,
      userId: user.id,
      action: "PLATFORM_ROLE_GRANTED",
      entityType: "User",
      entityId: user.id,
      beforeJson: { platformRole: user.platformRole },
      afterJson: { platformRole: role, grantedVia: "scripts/grant-platform-role.mjs" }
    }
  });

console.log(`${user.firstName} ${user.lastName} (${email}): ${user.platformRole} → ${role}`);
await prisma.$disconnect();
