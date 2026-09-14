import bcrypt from "bcryptjs";
import { UserTokenType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { buildLink, checkToken, hashToken, issueToken } from "@/modules/auth/tokens";
import { describeDelivery, getEmailProvider } from "@/modules/notifications/email";

/**
 * Verifica dell'indirizzo email e reimpostazione della password.
 *
 * Nessuna delle due funzioni di richiesta rivela se un indirizzo sia registrato:
 * rispondono allo stesso modo in ogni caso. Un modulo "password dimenticata" che
 * distingue fra indirizzo noto e ignoto e' un modo comodo per scoprire chi ha un
 * account su una piattaforma, e qui l'elenco degli account e' l'elenco di chi si
 * candida.
 */

const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";

/**
 * Il link di sviluppo si mostra solo quando lo sviluppo locale e' attivato in
 * modo esplicito. Fuori di li' non compare mai: restituirlo per un indirizzo
 * esistente e ometterlo per uno sconosciuto renderebbe la risposta un modo per
 * sapere chi ha un account.
 */
const localDevelopment = () => process.env.LOCAL_DEVELOPMENT_MODE === "true";

/**
 * Messaggio di consegna calcolato senza guardare se l'utente esista: dipende
 * solo dallo stato del servizio di posta, quindi e' identico nei due casi.
 */
function deliveryMessageForRequest(): string {
  return getEmailProvider().deliversForReal
    ? "Se l'indirizzo e' registrato, riceverai un messaggio con le istruzioni per reimpostare la password."
    : "Nessun servizio di posta e' configurato: il messaggio non e' stato spedito.";
}

export type RequestOutcome = {
  /** Sempre vero verso l'esterno: non dice se l'indirizzo esiste. */
  accepted: true;
  deliveryMessage: string;
  /** Valorizzato solo senza provider email configurato, per non bloccare lo sviluppo. */
  developmentLink?: string;
};

async function issueAndSend(
  userId: string,
  email: string,
  type: UserTokenType,
  path: string,
  subject: string,
  body: (link: string) => string,
  requestedIp?: string
) {
  const issued = issueToken(type);

  await prisma.$transaction(async (tx) => {
    /** Un nuovo token invalida i precedenti dello stesso tipo: uno solo per volta. */
    await tx.userToken.updateMany({
      where: { userId, type, usedAt: null },
      data: { usedAt: new Date() }
    });
    await tx.userToken.create({
      data: {
        userId,
        type,
        tokenHash: issued.tokenHash,
        expiresAt: issued.expiresAt,
        requestedIp
      }
    });
  });

  const link = buildLink(appUrl(), path, issued.token);
  const result = await getEmailProvider().send({ to: email, subject, text: body(link) });
  return { link, result };
}

export async function requestEmailVerification(
  userId: string,
  requestedIp?: string
): Promise<RequestOutcome> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, firstName: true, emailVerifiedAt: true }
  });
  if (!user) throw new HttpError(404, "USER_NOT_FOUND", "Utente non trovato");
  if (user.emailVerifiedAt)
    return { accepted: true, deliveryMessage: "L'indirizzo risulta gia' verificato." };

  const { link, result } = await issueAndSend(
    userId,
    user.email,
    UserTokenType.EMAIL_VERIFICATION,
    "/verifica-email",
    "Conferma il tuo indirizzo email",
    (url) =>
      `Ciao ${user.firstName},\n\nconferma il tuo indirizzo aprendo questo link:\n${url}\n\nSe non hai creato tu l'account, ignora questo messaggio.`,
    requestedIp
  );

  return {
    accepted: true,
    deliveryMessage: describeDelivery(result),
    developmentLink: !result.delivered && localDevelopment() ? link : undefined
  };
}

export async function confirmEmailVerification(token: string) {
  const record = await prisma.userToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, type: true, expiresAt: true, usedAt: true }
  });

  const check = checkToken(record, new Date());
  if (!check.valid || record?.type !== UserTokenType.EMAIL_VERIFICATION)
    throw new HttpError(
      400,
      "TOKEN_NOT_VALID",
      "Il link non e' piu' valido. Richiedine uno nuovo dal tuo profilo."
    );

  await prisma.$transaction(async (tx) => {
    await tx.userToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    const user = await tx.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
      select: { id: true, ownedOrganizations: { select: { id: true }, take: 1 } }
    });
    const organizationId = user.ownedOrganizations[0]?.id;
    if (organizationId)
      await tx.auditLog.create({
        data: {
          organizationId,
          userId: user.id,
          action: "USER_EMAIL_VERIFIED",
          entityType: "User",
          entityId: user.id
        }
      });
  });

  return { verified: true as const };
}

export async function requestPasswordReset(
  emailInput: string,
  requestedIp?: string
): Promise<RequestOutcome> {
  const email = emailInput.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, firstName: true, status: true }
  });

  /**
   * Indirizzo sconosciuto o account sospeso: si risponde come in tutti gli altri
   * casi e non si spedisce nulla.
   */
  if (!user || user.status === "SUSPENDED")
    return { accepted: true, deliveryMessage: deliveryMessageForRequest() };

  const { link, result } = await issueAndSend(
    user.id,
    email,
    UserTokenType.PASSWORD_RESET,
    "/reimposta-password",
    "Reimposta la tua password",
    (url) =>
      `Ciao ${user.firstName},\n\nper scegliere una nuova password apri questo link entro un'ora:\n${url}\n\nSe non hai chiesto tu la reimpostazione, ignora questo messaggio: la password attuale resta valida.`,
    requestedIp
  );

  return {
    accepted: true,
    deliveryMessage: deliveryMessageForRequest(),
    developmentLink: !result.delivered && localDevelopment() ? link : undefined
  };
}

export async function confirmPasswordReset(token: string, newPassword: string) {
  const record = await prisma.userToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, type: true, expiresAt: true, usedAt: true }
  });

  const check = checkToken(record, new Date());
  if (!check.valid || record?.type !== UserTokenType.PASSWORD_RESET)
    throw new HttpError(
      400,
      "TOKEN_NOT_VALID",
      "Il link non e' piu' valido. Richiedine uno nuovo."
    );

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction(async (tx) => {
    await tx.userToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    /** Chi reimposta la password chiude anche ogni altra richiesta in sospeso. */
    await tx.userToken.updateMany({
      where: { userId: record.userId, type: UserTokenType.PASSWORD_RESET, usedAt: null },
      data: { usedAt: new Date() }
    });
    const user = await tx.user.update({
      where: { id: record.userId },
      data: { passwordHash },
      select: { id: true, ownedOrganizations: { select: { id: true }, take: 1 } }
    });
    const organizationId = user.ownedOrganizations[0]?.id;
    if (organizationId)
      await tx.auditLog.create({
        data: {
          organizationId,
          userId: user.id,
          action: "USER_PASSWORD_RESET",
          entityType: "User",
          entityId: user.id
        }
      });
  });

  return { updated: true as const };
}
