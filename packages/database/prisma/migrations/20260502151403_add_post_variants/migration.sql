-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "variant_count" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "is_variant_winner" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "variant_label" TEXT NOT NULL DEFAULT 'A';

-- CreateIndex
CREATE INDEX "Post_campaign_id_platform_variant_label_idx" ON "Post"("campaign_id", "platform", "variant_label");
