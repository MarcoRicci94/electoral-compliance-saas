import { describe, expect, it } from "vitest";
import { hasCampaignPermission } from "@/modules/access/policy";

describe("campaign RBAC policy", () => {
  it("allows a candidate to manage the campaign", () => {
    expect(hasCampaignPermission("CANDIDATE", "campaign:manage")).toBe(true);
  });

  it("does not allow a contributor to write finance data", () => {
    expect(hasCampaignPermission("CONTRIBUTOR", "finance:write")).toBe(false);
  });

  it("does not allow an advisor to manage members", () => {
    expect(hasCampaignPermission("ADVISOR", "members:manage")).toBe(false);
  });
});
