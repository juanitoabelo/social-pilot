-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "ai_generations_this_month" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stripe_customer_id" TEXT,
ADD COLUMN     "stripe_subscription_id" TEXT,
ADD COLUMN     "subscription_ends_at" TIMESTAMP(3),
ADD COLUMN     "subscription_plan" TEXT NOT NULL DEFAULT 'free',
ADD COLUMN     "subscription_status" TEXT NOT NULL DEFAULT 'none';
