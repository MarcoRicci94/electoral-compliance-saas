import type { CampaignRole } from "@prisma/client";

export type CampaignPermission =
  | "campaign:read"
  | "campaign:manage"
  | "finance:read"
  | "finance:write"
  | "documents:read"
  | "documents:write"
  | "members:manage";

const permissions: Record<CampaignRole, readonly CampaignPermission[]> = {
  CANDIDATE: [
    "campaign:read",
    "campaign:manage",
    "finance:read",
    "finance:write",
    "documents:read",
    "documents:write",
    "members:manage"
  ],
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

export function hasCampaignPermission(role: CampaignRole, permission: CampaignPermission) {
  return permissions[role].includes(permission);
}
