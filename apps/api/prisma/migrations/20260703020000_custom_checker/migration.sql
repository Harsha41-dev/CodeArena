-- CreateEnum
CREATE TYPE "CheckerMode" AS ENUM ('STANDARD', 'CUSTOM_CHECKER');

-- AlterTable
ALTER TABLE "Problem"
ADD COLUMN "checkerMode" "CheckerMode" NOT NULL DEFAULT 'STANDARD';
