-- MatFlow pending schema migration (additive, non-destructive)
-- Generated 2026-06-08 from prisma/schema.prisma vs committed HEAD.
-- Apply to prod with: npx prisma db push   (recommended; project uses db push, no migration history)
-- Or run this SQL directly. All changes are ADD COLUMN / CREATE TABLE / index / FK + one safe DROP NOT NULL.

-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "emailSentAt" TIMESTAMP(3),
ADD COLUMN     "emailSentCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ClassSchedule" ADD COLUMN     "instructorId" TEXT;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "instructorId" TEXT;

-- AlterTable
ALTER TABLE "WaiverSignature" ADD COLUMN     "dropInId" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "memberId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Instructor" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "beltRank" TEXT,
    "bio" TEXT,
    "memberId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Instructor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementDelivery" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DropIn" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "emergencyName" TEXT,
    "emergencyPhone" TEXT,
    "visitDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "classType" TEXT,
    "instructorId" TEXT,
    "notes" TEXT,
    "convertedMemberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DropIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Instructor_gymId_active_idx" ON "Instructor"("gymId", "active");

-- CreateIndex
CREATE INDEX "AnnouncementDelivery_announcementId_idx" ON "AnnouncementDelivery"("announcementId");

-- CreateIndex
CREATE INDEX "DropIn_gymId_visitDate_idx" ON "DropIn"("gymId", "visitDate");

-- CreateIndex
CREATE INDEX "WaiverSignature_gymId_idx" ON "WaiverSignature"("gymId");

-- CreateIndex
CREATE INDEX "WaiverSignature_dropInId_idx" ON "WaiverSignature"("dropInId");

-- AddForeignKey
ALTER TABLE "Instructor" ADD CONSTRAINT "Instructor_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementDelivery" ADD CONSTRAINT "AnnouncementDelivery_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSchedule" ADD CONSTRAINT "ClassSchedule_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaiverSignature" ADD CONSTRAINT "WaiverSignature_dropInId_fkey" FOREIGN KEY ("dropInId") REFERENCES "DropIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DropIn" ADD CONSTRAINT "DropIn_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DropIn" ADD CONSTRAINT "DropIn_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

