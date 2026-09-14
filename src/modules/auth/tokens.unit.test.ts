import { describe, expect, it } from "vitest";
import { UserTokenType } from "@prisma/client";
import {
  TOKEN_LIFETIME_MINUTES,
  buildLink,
  checkToken,
  hashToken,
  hashesMatch,
  issueToken
} from "@/modules/auth/tokens";

const now = new Date("2027-05-10T12:00:00Z");
const minutes = (count: number) => new Date(now.getTime() + count * 60_000);

describe("il token in chiaro non finisce nel database", () => {
  it("emette un token e ne conserva solo l'impronta", () => {
    const issued = issueToken(UserTokenType.PASSWORD_RESET, now);
    expect(issued.token.length).toBeGreaterThanOrEqual(40);
    expect(issued.tokenHash).toBe(hashToken(issued.token));
    expect(issued.tokenHash).not.toContain(issued.token);
    expect(issued.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("due token consecutivi sono diversi", () => {
    const first = issueToken(UserTokenType.PASSWORD_RESET, now);
    const second = issueToken(UserTokenType.PASSWORD_RESET, now);
    expect(first.token).not.toBe(second.token);
    expect(first.tokenHash).not.toBe(second.tokenHash);
  });

  it("l'impronta e' deterministica, cosi' la ricerca per token funziona", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
  });
});

describe("durate", () => {
  /**
   * Un link di reimpostazione e' una chiave d'accesso completa e deve durare
   * poco; una verifica dell'indirizzo non fa entrare da nessuna parte e scadere
   * in fretta produrrebbe solo utenti bloccati fuori.
   */
  it("la reimpostazione password dura meno della verifica dell'indirizzo", () => {
    expect(TOKEN_LIFETIME_MINUTES.PASSWORD_RESET).toBeLessThan(
      TOKEN_LIFETIME_MINUTES.EMAIL_VERIFICATION
    );
  });

  it("applica la durata prevista dal tipo", () => {
    expect(issueToken(UserTokenType.PASSWORD_RESET, now).expiresAt).toEqual(
      minutes(TOKEN_LIFETIME_MINUTES.PASSWORD_RESET)
    );
    expect(issueToken(UserTokenType.EMAIL_VERIFICATION, now).expiresAt).toEqual(
      minutes(TOKEN_LIFETIME_MINUTES.EMAIL_VERIFICATION)
    );
  });
});

describe("validita' del token", () => {
  it("accetta un token non usato e non scaduto", () => {
    expect(checkToken({ expiresAt: minutes(10), usedAt: null }, now)).toEqual({ valid: true });
  });

  it("rifiuta un token inesistente", () => {
    expect(checkToken(null, now)).toEqual({ valid: false, reason: "NOT_FOUND" });
  });

  it("rifiuta un token gia' usato, anche se non scaduto", () => {
    expect(checkToken({ expiresAt: minutes(10), usedAt: minutes(-1) }, now)).toEqual({
      valid: false,
      reason: "ALREADY_USED"
    });
  });

  it("rifiuta un token scaduto", () => {
    expect(checkToken({ expiresAt: minutes(-1), usedAt: null }, now)).toEqual({
      valid: false,
      reason: "EXPIRED"
    });
  });

  it("il momento esatto della scadenza non e' piu' valido", () => {
    expect(checkToken({ expiresAt: now, usedAt: null }, now).valid).toBe(false);
    expect(checkToken({ expiresAt: new Date(now.getTime() + 1), usedAt: null }, now).valid).toBe(
      true
    );
  });
});

describe("confronto fra impronte", () => {
  it("riconosce impronte uguali e diverse", () => {
    const hash = hashToken("qualcosa");
    expect(hashesMatch(hash, hash)).toBe(true);
    expect(hashesMatch(hash, hashToken("altro"))).toBe(false);
  });

  it("non va in errore su valori vuoti o di lunghezza diversa", () => {
    expect(hashesMatch("", "")).toBe(false);
    expect(hashesMatch("aa", "aabb")).toBe(false);
  });
});

describe("costruzione del link", () => {
  it("mette il token in query e rispetta la base", () => {
    expect(buildLink("https://conforme.it", "/verifica-email", "abc")).toBe(
      "https://conforme.it/verifica-email?token=abc"
    );
    expect(buildLink("http://localhost:3000/", "/reimposta-password", "x/y+z")).toBe(
      "http://localhost:3000/reimposta-password?token=x%2Fy%2Bz"
    );
  });
});
