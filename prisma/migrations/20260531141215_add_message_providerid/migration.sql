-- AlterTable
ALTER TABLE "Message" ADD COLUMN "providerId" TEXT;

-- CreateIndex
CREATE INDEX "Message_providerId_idx" ON "Message"("providerId");
