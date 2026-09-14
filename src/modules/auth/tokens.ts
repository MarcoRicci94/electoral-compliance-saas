import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { UserTokenType } from "@prisma/client";

/**
 * Token monouso per verifica email e reimpostazione password.
 *
 * Il token viaggia nel link e non viene mai memorizzato: il database conserva
 * solo l'impronta SHA-256. Chi ottiene una copia del database non puo' quindi
 * usare i token in sospeso per impossessarsi degli account.
 *
 * La durata e' diversa per tipo. Un link di reimpostazione password e' una
 * chiave d'accesso completa e resta valido poco; una verifica dell'indirizzo non
 * consente di entrare da nessuna parte e puo' durare piu' a lungo, perche'
 * scadere subito produrrebbe solo utenti bloccati fuori.
 */

/**
 * Chiavi scritte come stringhe e non come valori dell'enum generato: questa
 * costante viene valutata al caricamento del modulo, e dipendere li' da un
 * oggetto generato a runtime significa rompersi quando quell'oggetto non e'
 * ancora pronto. Il tipo resta comunque legato all'enum, quindi aggiungerne un
 * valore senza dargli una durata non compila.
 */
export const TOKEN_LIFETIME_MINUTES: Record<UserTokenType, number> = {
  EMAIL_VERIFICATION: 60 * 24 * 3,
  PASSWORD_RESET: 60
};

export type IssuedToken = {
  /** Da mettere nel link. Esiste solo in memoria, non viene mai salvato. */
  token: string;
  tokenHash: string;
  expiresAt: Date;
};

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function issueToken(type: UserTokenType, now = new Date()): IssuedToken {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: hashToken(token),
    expiresAt: new Date(now.getTime() + TOKEN_LIFETIME_MINUTES[type] * 60_000)
  };
}

export type StoredToken = {
  expiresAt: Date;
  usedAt: Date | null;
} | null;

export type TokenCheck =
  { valid: true } | { valid: false; reason: "NOT_FOUND" | "ALREADY_USED" | "EXPIRED" };

/**
 * Un token gia' usato e uno scaduto restano due casi distinti nel modello, cosi'
 * si puo' spiegare all'utente cosa e' successo. Verso l'esterno il messaggio e'
 * comunque lo stesso: dire "questo link e' gia' stato usato" a chi ha in mano un
 * token altrui e' una conferma che non va data.
 */
export function checkToken(stored: StoredToken, now = new Date()): TokenCheck {
  if (!stored) return { valid: false, reason: "NOT_FOUND" };
  if (stored.usedAt) return { valid: false, reason: "ALREADY_USED" };
  if (stored.expiresAt <= now) return { valid: false, reason: "EXPIRED" };
  return { valid: true };
}

/** Confronto a tempo costante, per i casi in cui un'impronta va verificata a mano. */
export function hashesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

export function buildLink(baseUrl: string, path: string, token: string): string {
  const url = new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  url.searchParams.set("token", token);
  return url.toString();
}
