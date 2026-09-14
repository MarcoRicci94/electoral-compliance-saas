-- AlterTable
ALTER TABLE "rule_parameters" ADD COLUMN     "note" TEXT,
ADD COLUMN     "verified_at" TIMESTAMP(3),
ADD COLUMN     "verified_by" TEXT;
