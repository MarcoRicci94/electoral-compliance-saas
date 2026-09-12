import assert from "node:assert/strict";
import { hasCampaignPermission } from "../src/modules/access/policy.ts";

assert.equal(hasCampaignPermission("CANDIDATE", "campaign:manage"), true, "il candidato gestisce la campagna");
assert.equal(hasCampaignPermission("CONTRIBUTOR", "finance:write"), false, "il collaboratore non registra finanze");
assert.equal(hasCampaignPermission("ADVISOR", "members:manage"), false, "il consulente non gestisce utenti");
console.log("Unit test superati: policy RBAC.");
