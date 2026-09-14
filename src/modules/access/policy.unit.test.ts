import type { CampaignRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { hasCampaignPermission, type CampaignPermission } from "@/modules/access/policy";

const roles: CampaignRole[] = ["CANDIDATE", "MANDATARY", "ADVISOR", "CONTRIBUTOR"];
const permissions: CampaignPermission[] = [
  "campaign:read",
  "campaign:manage",
  "finance:read",
  "finance:write",
  "documents:read",
  "documents:write",
  "members:manage"
];

/**
 * Matrice completa: un permesso aggiunto al tipo senza deciderne l'attribuzione
 * fa fallire il test invece di essere concesso o negato per caso.
 */
const expected: Record<CampaignRole, CampaignPermission[]> = {
  CANDIDATE: permissions,
  MANDATARY: [
    "campaign:read",
    "finance:read",
    "finance:write",
    "documents:read",
    "documents:write"
  ],
  ADVISOR: ["campaign:read", "finance:read", "finance:write", "documents:read", "documents:write"],
  CONTRIBUTOR: ["campaign:read", "documents:read", "documents:write"]
};

describe("matrice dei permessi di campagna", () => {
  for (const role of roles) {
    for (const permission of permissions) {
      const allowed = expected[role].includes(permission);
      it(`${role} ${allowed ? "puo'" : "non puo'"} ${permission}`, () => {
        expect(hasCampaignPermission(role, permission)).toBe(allowed);
      });
    }
  }
});

describe("confini dei ruoli", () => {
  it("riserva la gestione della campagna e dei membri al solo candidato", () => {
    for (const role of roles) {
      expect(hasCampaignPermission(role, "campaign:manage")).toBe(role === "CANDIDATE");
      expect(hasCampaignPermission(role, "members:manage")).toBe(role === "CANDIDATE");
    }
  });

  it("non concede scrittura finanziaria al collaboratore", () => {
    expect(hasCampaignPermission("CONTRIBUTOR", "finance:write")).toBe(false);
    expect(hasCampaignPermission("CONTRIBUTOR", "finance:read")).toBe(false);
  });

  it("concede a ogni ruolo almeno la lettura della campagna", () => {
    for (const role of roles) expect(hasCampaignPermission(role, "campaign:read")).toBe(true);
  });
});
