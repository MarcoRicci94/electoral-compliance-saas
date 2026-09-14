-- CreateEnum
CREATE TYPE "MandataryRequirement" AS ENUM ('UNKNOWN', 'REQUIRED', 'NOT_REQUIRED', 'NOT_APPLICABLE', 'EVALUATION_INCOMPLETE');

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "proclamation_date" DATE,
ADD COLUMN     "setup_completed_at" TIMESTAMP(3),
ADD COLUMN     "mandatary_requirement" "MandataryRequirement" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "mandatary_requirement_rule_code" TEXT,
ADD COLUMN     "mandatary_requirement_evaluated_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "campaign_setups" (
    "campaign_id" TEXT NOT NULL,
    "expects_own_spending" BOOLEAN NOT NULL DEFAULT false,
    "planned_own_spending" DECIMAL(15,2),
    "expects_third_party_contributions" BOOLEAN NOT NULL DEFAULT false,
    "expects_party_or_list_support" BOOLEAN NOT NULL DEFAULT false,
    "expects_in_kind_contributions" BOOLEAN NOT NULL DEFAULT false,
    "planned_total_spending" DECIMAL(15,2),
    "declared_by_user_id" TEXT NOT NULL,
    "declared_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_setups_pkey" PRIMARY KEY ("campaign_id")
);

-- AddForeignKey
ALTER TABLE "campaign_setups" ADD CONSTRAINT "campaign_setups_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
