-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('ENTWURF', 'VERSENDET', 'UNTERSCHRIEBEN', 'GEKUENDIGT');

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "last_ai_review_at" TIMESTAMP(3),
ADD COLUMN     "last_ai_review_freigabe" TEXT,
ADD COLUMN     "last_ai_review_result" JSONB,
ADD COLUMN     "sent_at" TIMESTAMP(3),
ADD COLUMN     "signed_at" TIMESTAMP(3),
ADD COLUMN     "status" "ContractStatus" NOT NULL DEFAULT 'ENTWURF';

-- CreateTable
CREATE TABLE "sequences" (
    "name" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sequences_pkey" PRIMARY KEY ("name")
);
