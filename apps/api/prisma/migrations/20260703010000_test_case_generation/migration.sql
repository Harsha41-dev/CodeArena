-- CreateEnum
CREATE TYPE "ProblemAssetType" AS ENUM ('GENERATOR', 'REFERENCE_SOLUTION', 'VALIDATOR', 'CHECKER');

-- CreateEnum
CREATE TYPE "GenerationJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "TestCase"
ADD COLUMN "batchId" TEXT,
ADD COLUMN "generatedByJobId" TEXT,
ADD COLUMN "inputHash" TEXT,
ADD COLUMN "outputHash" TEXT,
ADD COLUMN "generatorSeed" INTEGER,
ADD COLUMN "isGenerated" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ProblemAsset" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "type" "ProblemAssetType" NOT NULL,
    "languageId" TEXT,
    "languageVersionId" TEXT,
    "filename" TEXT NOT NULL,
    "sourceCode" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProblemAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestCaseGenerationJob" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "status" "GenerationJobStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT,
    "config" JSONB NOT NULL,
    "totalCases" INTEGER NOT NULL DEFAULT 0,
    "generatedCases" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "TestCaseGenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedTestCaseBatch" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedTestCaseBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TestCase_generatedByJobId_idx" ON "TestCase"("generatedByJobId");

-- CreateIndex
CREATE INDEX "TestCase_batchId_idx" ON "TestCase"("batchId");

-- CreateIndex
CREATE INDEX "TestCase_problemId_inputHash_idx" ON "TestCase"("problemId", "inputHash");

-- CreateIndex
CREATE INDEX "ProblemAsset_problemId_type_idx" ON "ProblemAsset"("problemId", "type");

-- CreateIndex
CREATE INDEX "ProblemAsset_languageId_idx" ON "ProblemAsset"("languageId");

-- CreateIndex
CREATE INDEX "ProblemAsset_languageVersionId_idx" ON "ProblemAsset"("languageVersionId");

-- CreateIndex
CREATE INDEX "TestCaseGenerationJob_problemId_status_idx" ON "TestCaseGenerationJob"("problemId", "status");

-- CreateIndex
CREATE INDEX "TestCaseGenerationJob_requestedById_idx" ON "TestCaseGenerationJob"("requestedById");

-- CreateIndex
CREATE INDEX "GeneratedTestCaseBatch_problemId_idx" ON "GeneratedTestCaseBatch"("problemId");

-- CreateIndex
CREATE INDEX "GeneratedTestCaseBatch_jobId_idx" ON "GeneratedTestCaseBatch"("jobId");

-- AddForeignKey
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "GeneratedTestCaseBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_generatedByJobId_fkey" FOREIGN KEY ("generatedByJobId") REFERENCES "TestCaseGenerationJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemAsset" ADD CONSTRAINT "ProblemAsset_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemAsset" ADD CONSTRAINT "ProblemAsset_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemAsset" ADD CONSTRAINT "ProblemAsset_languageVersionId_fkey" FOREIGN KEY ("languageVersionId") REFERENCES "LanguageVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemAsset" ADD CONSTRAINT "ProblemAsset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCaseGenerationJob" ADD CONSTRAINT "TestCaseGenerationJob_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCaseGenerationJob" ADD CONSTRAINT "TestCaseGenerationJob_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedTestCaseBatch" ADD CONSTRAINT "GeneratedTestCaseBatch_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedTestCaseBatch" ADD CONSTRAINT "GeneratedTestCaseBatch_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "TestCaseGenerationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedTestCaseBatch" ADD CONSTRAINT "GeneratedTestCaseBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
