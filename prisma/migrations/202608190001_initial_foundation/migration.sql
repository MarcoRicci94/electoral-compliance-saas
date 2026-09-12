-- This migration is generated from the Milestone 1 Prisma schema. Apply with `npm run db:deploy`.
-- PostgreSQL extension requirements are intentionally kept infrastructure-neutral.

CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED');
CREATE TYPE "OrganizationType" AS ENUM ('INDIVIDUAL', 'POLITICAL_LIST', 'PARTY', 'PROFESSIONAL', 'INTERNAL');
CREATE TYPE "MembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED');
CREATE TYPE "CampaignRole" AS ENUM ('CANDIDATE', 'MANDATARY', 'ADVISOR', 'CONTRIBUTOR');
CREATE TYPE "ElectionType" AS ENUM ('POLITICAL', 'MUNICIPAL', 'REGIONAL');
CREATE TYPE "OfficeSought" AS ENUM ('DEPUTY', 'SENATOR', 'MAYOR', 'MUNICIPAL_COUNCILLOR', 'REGIONAL_PRESIDENT', 'REGIONAL_COUNCILLOR');
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SETUP', 'ACTIVE', 'ELECTION_COMPLETED', 'POST_ELECTION', 'REPORT_PREPARATION', 'REPORT_READY', 'REPORT_FILED', 'UNDER_REVIEW', 'CLOSED', 'ARCHIVED');

CREATE TABLE "users" ("id" TEXT PRIMARY KEY, "email" TEXT NOT NULL UNIQUE, "password_hash" TEXT NOT NULL, "first_name" TEXT NOT NULL, "last_name" TEXT NOT NULL, "phone" TEXT, "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE', "email_verified_at" TIMESTAMP(3), "mfa_enabled" BOOLEAN NOT NULL DEFAULT false, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL, "last_login_at" TIMESTAMP(3));
CREATE TABLE "organizations" ("id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "type" "OrganizationType" NOT NULL, "owner_user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT, "billing_status" TEXT NOT NULL DEFAULT 'TRIAL', "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL);
CREATE TABLE "organization_members" ("id" TEXT PRIMARY KEY, "organization_id" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE, "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE, "role" TEXT NOT NULL, "status" "MembershipStatus" NOT NULL DEFAULT 'INVITED', "invited_at" TIMESTAMP(3), "accepted_at" TIMESTAMP(3), UNIQUE("organization_id", "user_id"));
CREATE TABLE "campaigns" ("id" TEXT PRIMARY KEY, "organization_id" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE RESTRICT, "name" TEXT NOT NULL, "election_type" "ElectionType" NOT NULL, "office_sought" "OfficeSought" NOT NULL, "country" TEXT NOT NULL DEFAULT 'IT', "region" TEXT, "province" TEXT, "municipality" TEXT, "election_date" DATE, "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT', "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL, "archived_at" TIMESTAMP(3));
CREATE TABLE "campaign_members" ("id" TEXT PRIMARY KEY, "campaign_id" TEXT NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE, "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE, "role" "CampaignRole" NOT NULL, "permissions_override" JSONB, "status" "MembershipStatus" NOT NULL DEFAULT 'INVITED', "joined_at" TIMESTAMP(3), UNIQUE("campaign_id", "user_id"));
CREATE TABLE "candidate_profiles" ("id" TEXT PRIMARY KEY, "campaign_id" TEXT NOT NULL UNIQUE REFERENCES "campaigns"("id") ON DELETE CASCADE, "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT, "first_name" TEXT NOT NULL, "last_name" TEXT NOT NULL, "email" TEXT, "phone" TEXT, "political_party" TEXT, "list_name" TEXT, "coalition_name" TEXT, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL);
CREATE TABLE "audit_logs" ("id" TEXT PRIMARY KEY, "organization_id" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE RESTRICT, "campaign_id" TEXT REFERENCES "campaigns"("id") ON DELETE RESTRICT, "user_id" TEXT REFERENCES "users"("id") ON DELETE SET NULL, "action" TEXT NOT NULL, "entity_type" TEXT NOT NULL, "entity_id" TEXT NOT NULL, "before_json" JSONB, "after_json" JSONB, "ip_address" TEXT, "user_agent" TEXT, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "organizations_owner_user_id_idx" ON "organizations"("owner_user_id");
CREATE INDEX "organization_members_user_id_status_idx" ON "organization_members"("user_id", "status");
CREATE INDEX "campaigns_organization_id_status_idx" ON "campaigns"("organization_id", "status");
CREATE INDEX "campaign_members_user_id_status_idx" ON "campaign_members"("user_id", "status");
CREATE INDEX "candidate_profiles_user_id_idx" ON "candidate_profiles"("user_id");
CREATE INDEX "audit_logs_organization_id_created_at_idx" ON "audit_logs"("organization_id", "created_at");
CREATE INDEX "audit_logs_campaign_id_created_at_idx" ON "audit_logs"("campaign_id", "created_at");
