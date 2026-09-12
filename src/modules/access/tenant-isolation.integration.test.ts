import { describe, expect, it } from "vitest";

type Membership = { organizationId: string; userId: string; active: boolean };
type CampaignMembership = Membership & { campaignId: string };

function canAccessCampaign(
  organizationMemberships: Membership[],
  campaignMemberships: CampaignMembership[],
  userId: string,
  organizationId: string,
  campaignId: string
) {
  return (
    organizationMemberships.some(
      (m) => m.userId === userId && m.organizationId === organizationId && m.active
    ) &&
    campaignMemberships.some(
      (m) =>
        m.userId === userId &&
        m.organizationId === organizationId &&
        m.campaignId === campaignId &&
        m.active
    )
  );
}

describe("tenant isolation contract", () => {
  it("rejects a valid campaign id belonging to another organization", () => {
    expect(
      canAccessCampaign(
        [{ userId: "u1", organizationId: "org_a", active: true }],
        [{ userId: "u1", organizationId: "org_b", campaignId: "campaign_b", active: true }],
        "u1",
        "org_a",
        "campaign_b"
      )
    ).toBe(false);
  });

  it("rejects a campaign when organization membership is missing", () => {
    expect(
      canAccessCampaign(
        [],
        [{ userId: "u1", organizationId: "org_a", campaignId: "campaign_a", active: true }],
        "u1",
        "org_a",
        "campaign_a"
      )
    ).toBe(false);
  });
});
