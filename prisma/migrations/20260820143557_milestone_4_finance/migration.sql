-- CreateEnum
CREATE TYPE "DonorType" AS ENUM ('INDIVIDUAL', 'COMPANY', 'ASSOCIATION', 'POLITICAL_ENTITY', 'OTHER');

-- CreateEnum
CREATE TYPE "ContributionType" AS ENUM ('MONEY', 'SELF_FINANCING', 'THIRD_PARTY_PAYMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ContributionStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'VOID');

-- CreateEnum
CREATE TYPE "InKindContributionStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'VOID');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('DRAFT', 'RECORDED', 'PARTIALLY_PAID', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "AllocationType" AS ENUM ('CAMPAIGN', 'SHARE');

-- CreateTable
CREATE TABLE "donors" (
    "id" TEXT NOT NULL,
    "type" "DonorType" NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "company_name" TEXT,
    "tax_code" TEXT,
    "vat_number" TEXT,
    "country" TEXT DEFAULT 'IT',
    "address" TEXT,
    "email" TEXT,
    "pec" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "donors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contributions" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "donor_id" TEXT,
    "type" "ContributionType" NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "payment_method" TEXT,
    "bank_transaction_id" TEXT,
    "status" "ContributionStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corporate_contribution_details" (
    "contribution_id" TEXT NOT NULL,
    "resolution_date" DATE,
    "resolution_document_id" TEXT,
    "corporate_book_document_id" TEXT,
    "accounting_record_document_id" TEXT,
    "journal_document_id" TEXT,
    "documentation_status" TEXT NOT NULL DEFAULT 'NOT_STARTED',

    CONSTRAINT "corporate_contribution_details_pkey" PRIMARY KEY ("contribution_id")
);

-- CreateTable
CREATE TABLE "in_kind_contributions" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "provider_id" TEXT,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "service_date" DATE,
    "estimated_value" DECIMAL(15,2) NOT NULL,
    "valuation_method" TEXT NOT NULL,
    "valuation_notes" TEXT,
    "supporting_document_id" TEXT,
    "paid_by_third_party" BOOLEAN NOT NULL DEFAULT false,
    "status" "InKindContributionStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "in_kind_contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tax_code" TEXT,
    "vat_number" TEXT,
    "address" TEXT,
    "email" TEXT,
    "pec" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "supplier_id" TEXT,
    "expense_date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "legal_category" TEXT NOT NULL,
    "subcategory" TEXT,
    "gross_amount" DECIMAL(15,2) NOT NULL,
    "net_amount" DECIMAL(15,2),
    "vat_amount" DECIMAL(15,2),
    "relevant_amount_for_limit" DECIMAL(15,2) NOT NULL,
    "paid_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "outstanding_amount" DECIMAL(15,2) NOT NULL,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'DRAFT',
    "invoice_document_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_allocations" (
    "id" TEXT NOT NULL,
    "expense_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "allocation_type" "AllocationType" NOT NULL,
    "percentage" DECIMAL(7,4),
    "amount" DECIMAL(15,2),
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "donors_tax_code_idx" ON "donors"("tax_code");

-- CreateIndex
CREATE INDEX "donors_vat_number_idx" ON "donors"("vat_number");

-- CreateIndex
CREATE INDEX "contributions_campaign_id_date_status_idx" ON "contributions"("campaign_id", "date", "status");

-- CreateIndex
CREATE INDEX "contributions_donor_id_date_idx" ON "contributions"("donor_id", "date");

-- CreateIndex
CREATE INDEX "in_kind_contributions_campaign_id_status_idx" ON "in_kind_contributions"("campaign_id", "status");

-- CreateIndex
CREATE INDEX "suppliers_vat_number_idx" ON "suppliers"("vat_number");

-- CreateIndex
CREATE INDEX "expenses_campaign_id_expense_date_status_idx" ON "expenses"("campaign_id", "expense_date", "status");

-- CreateIndex
CREATE INDEX "expense_allocations_campaign_id_idx" ON "expense_allocations"("campaign_id");

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_donor_id_fkey" FOREIGN KEY ("donor_id") REFERENCES "donors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corporate_contribution_details" ADD CONSTRAINT "corporate_contribution_details_contribution_id_fkey" FOREIGN KEY ("contribution_id") REFERENCES "contributions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "in_kind_contributions" ADD CONSTRAINT "in_kind_contributions_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "in_kind_contributions" ADD CONSTRAINT "in_kind_contributions_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "donors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_allocations" ADD CONSTRAINT "expense_allocations_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
