-- CreateEnum
CREATE TYPE "RulesetStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'ACTIVE', 'SUPERSEDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LegalSourceType" AS ENUM ('LAW', 'DECREE', 'REGULATION', 'COREGE_GUIDANCE', 'AGCOM_DECISION', 'PRIVACY_AUTHORITY', 'MUNICIPAL_REGULATION', 'PRACTICE', 'SYSTEM_CONTROL', 'PRODUCT_BEST_PRACTICE');

-- CreateEnum
CREATE TYPE "FindingSeverity" AS ENUM ('INFO', 'ACTION_REQUIRED', 'WARNING', 'CRITICAL', 'BLOCKER');

-- CreateEnum
CREATE TYPE "FindingStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'OVERRIDDEN');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "TaskSourceType" AS ENUM ('RULE', 'FINDING', 'USER', 'SYSTEM', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "DeadlineStatus" AS ENUM ('PENDING', 'COMPLETED', 'OVERDUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "MandataryStatus" AS ENUM ('NOT_STARTED', 'DATA_COMPLETE', 'DOCUMENT_GENERATED', 'SIGNED', 'SUBMITTED', 'CONFIRMED');

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_campaign_id_fkey";

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_user_id_fkey";

-- DropForeignKey
ALTER TABLE "campaign_members" DROP CONSTRAINT "campaign_members_campaign_id_fkey";

-- DropForeignKey
ALTER TABLE "campaign_members" DROP CONSTRAINT "campaign_members_user_id_fkey";

-- DropForeignKey
ALTER TABLE "campaigns" DROP CONSTRAINT "campaigns_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "candidate_profiles" DROP CONSTRAINT "candidate_profiles_campaign_id_fkey";

-- DropForeignKey
ALTER TABLE "candidate_profiles" DROP CONSTRAINT "candidate_profiles_user_id_fkey";

-- DropForeignKey
ALTER TABLE "organization_members" DROP CONSTRAINT "organization_members_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "organization_members" DROP CONSTRAINT "organization_members_user_id_fkey";

-- DropForeignKey
ALTER TABLE "organizations" DROP CONSTRAINT "organizations_owner_user_id_fkey";

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "election_id" TEXT,
ADD COLUMN     "ruleset_version_id" TEXT,
ADD COLUMN     "territory_id" TEXT;

-- CreateTable
CREATE TABLE "mandatary_profiles" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "user_id" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "tax_code" TEXT,
    "birth_date" DATE,
    "birth_place" TEXT,
    "residence" TEXT,
    "pec" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "appointment_date" DATE,
    "status" "MandataryStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "identity_document_id" TEXT,
    "appointment_document_id" TEXT,
    "submission_receipt_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mandatary_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "territories" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "istat_code" TEXT,
    "name" TEXT NOT NULL,
    "parent_id" TEXT,
    "population" INTEGER,
    "population_reference_date" DATE,
    "registered_voters" INTEGER,
    "registered_voters_reference_date" DATE,
    "source" TEXT,
    "source_verified_at" TIMESTAMP(3),

    CONSTRAINT "territories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "elections" (
    "id" TEXT NOT NULL,
    "type" "ElectionType" NOT NULL,
    "name" TEXT NOT NULL,
    "election_date" DATE NOT NULL,
    "runoff_date" DATE,
    "call_date" DATE,
    "candidate_submission_deadline" DATE,
    "country" TEXT NOT NULL DEFAULT 'IT',
    "region" TEXT,
    "province" TEXT,
    "municipality" TEXT,
    "population" INTEGER,
    "population_reference_date" DATE,
    "registered_voters" INTEGER,
    "registered_voters_reference_date" DATE,
    "official_source_url" TEXT,
    "source_verified_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "elections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_sources" (
    "id" TEXT NOT NULL,
    "source_type" "LegalSourceType" NOT NULL,
    "title" TEXT NOT NULL,
    "law_number" TEXT,
    "law_date" DATE,
    "article" TEXT,
    "paragraph" TEXT,
    "authority" TEXT,
    "official_url" TEXT,
    "effective_from" DATE,
    "effective_to" DATE,
    "text_excerpt" TEXT,
    "verified_at" TIMESTAMP(3),
    "verified_by" TEXT,

    CONSTRAINT "legal_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ruleset_versions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "election_type" "ElectionType" NOT NULL,
    "version" TEXT NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "status" "RulesetStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ruleset_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_parameters" (
    "id" TEXT NOT NULL,
    "ruleset_version_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "unit" TEXT,
    "legal_source_id" TEXT,

    CONSTRAINT "rule_parameters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_rules" (
    "id" TEXT NOT NULL,
    "ruleset_version_id" TEXT NOT NULL,
    "rule_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity_default" "FindingSeverity" NOT NULL,
    "condition_expression" JSONB NOT NULL,
    "effect_type" TEXT NOT NULL,
    "effect_payload" JSONB NOT NULL,
    "legal_source_id" TEXT,
    "effective_from" DATE,
    "effective_to" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_findings" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "severity" "FindingSeverity" NOT NULL,
    "status" "FindingStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "resolution_method" TEXT,
    "override_reason" TEXT,
    "overridden_by" TEXT,

    CONSTRAINT "compliance_findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "source_type" "TaskSourceType" NOT NULL,
    "source_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "FindingSeverity" NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "assigned_to" TEXT,
    "due_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deadlines" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "rule_id" TEXT,
    "name" TEXT NOT NULL,
    "trigger_event" TEXT NOT NULL,
    "trigger_date" DATE,
    "offset_definition" TEXT NOT NULL,
    "calculated_due_date" DATE,
    "status" "DeadlineStatus" NOT NULL DEFAULT 'PENDING',
    "source" TEXT NOT NULL,

    CONSTRAINT "deadlines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mandatary_profiles_campaign_id_key" ON "mandatary_profiles"("campaign_id");

-- CreateIndex
CREATE INDEX "mandatary_profiles_user_id_idx" ON "mandatary_profiles"("user_id");

-- CreateIndex
CREATE INDEX "mandatary_profiles_tax_code_idx" ON "mandatary_profiles"("tax_code");

-- CreateIndex
CREATE UNIQUE INDEX "territories_istat_code_key" ON "territories"("istat_code");

-- CreateIndex
CREATE INDEX "territories_parent_id_idx" ON "territories"("parent_id");

-- CreateIndex
CREATE INDEX "elections_type_election_date_idx" ON "elections"("type", "election_date");

-- CreateIndex
CREATE UNIQUE INDEX "ruleset_versions_jurisdiction_election_type_version_key" ON "ruleset_versions"("jurisdiction", "election_type", "version");

-- CreateIndex
CREATE UNIQUE INDEX "rule_parameters_ruleset_version_id_code_key" ON "rule_parameters"("ruleset_version_id", "code");

-- CreateIndex
CREATE INDEX "compliance_rules_ruleset_version_id_is_active_idx" ON "compliance_rules"("ruleset_version_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_rules_ruleset_version_id_rule_code_key" ON "compliance_rules"("ruleset_version_id", "rule_code");

-- CreateIndex
CREATE INDEX "compliance_findings_campaign_id_status_severity_idx" ON "compliance_findings"("campaign_id", "status", "severity");

-- CreateIndex
CREATE INDEX "tasks_campaign_id_status_due_at_idx" ON "tasks"("campaign_id", "status", "due_at");

-- CreateIndex
CREATE INDEX "deadlines_campaign_id_status_calculated_due_date_idx" ON "deadlines"("campaign_id", "status", "calculated_due_date");

-- CreateIndex
CREATE INDEX "campaigns_election_id_idx" ON "campaigns"("election_id");

-- CreateIndex
CREATE INDEX "campaigns_ruleset_version_id_idx" ON "campaigns"("ruleset_version_id");

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_territory_id_fkey" FOREIGN KEY ("territory_id") REFERENCES "territories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_ruleset_version_id_fkey" FOREIGN KEY ("ruleset_version_id") REFERENCES "ruleset_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mandatary_profiles" ADD CONSTRAINT "mandatary_profiles_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mandatary_profiles" ADD CONSTRAINT "mandatary_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "territories" ADD CONSTRAINT "territories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "territories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_parameters" ADD CONSTRAINT "rule_parameters_ruleset_version_id_fkey" FOREIGN KEY ("ruleset_version_id") REFERENCES "ruleset_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_rules" ADD CONSTRAINT "compliance_rules_ruleset_version_id_fkey" FOREIGN KEY ("ruleset_version_id") REFERENCES "ruleset_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_rules" ADD CONSTRAINT "compliance_rules_legal_source_id_fkey" FOREIGN KEY ("legal_source_id") REFERENCES "legal_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_findings" ADD CONSTRAINT "compliance_findings_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_findings" ADD CONSTRAINT "compliance_findings_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "compliance_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "compliance_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_members" ADD CONSTRAINT "campaign_members_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_members" ADD CONSTRAINT "campaign_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_profiles" ADD CONSTRAINT "candidate_profiles_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_profiles" ADD CONSTRAINT "candidate_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
