-- CreateEnum
CREATE TYPE "LearningCollectionType" AS ENUM ('STUDY_PLAN', 'CURATED_LIST');

-- CreateEnum
CREATE TYPE "PracticeSessionType" AS ENUM ('VIRTUAL_CONTEST', 'MOCK_INTERVIEW');

-- CreateEnum
CREATE TYPE "PracticeSessionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PracticeOutcome" AS ENUM ('SOLVED', 'REVIEW', 'SKIPPED');

-- CreateEnum
CREATE TYPE "EditorialSectionType" AS ENUM ('TEXT', 'HINT', 'SOLUTION', 'COMPLEXITY', 'DIAGRAM');

-- CreateEnum
CREATE TYPE "RatingJobStatus" AS ENUM ('SCHEDULED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MonitoringAlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- AlterTable
ALTER TABLE "Contest"
ADD COLUMN "freezeStartsAt" TIMESTAMP(3),
ADD COLUMN "isRated" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "ratingSeason" TEXT,
ADD COLUMN "ratingScheduledAt" TIMESTAMP(3),
ADD COLUMN "ratingsPublishedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "DiscussionComment" ADD COLUMN "helpfulVotes" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProblemCompany" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "frequency" INTEGER NOT NULL DEFAULT 0,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProblemCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningCollection" (
    "id" TEXT NOT NULL,
    "type" "LearningCollectionType" NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "badge" TEXT,
    "dailyUnlockCount" INTEGER NOT NULL DEFAULT 0,
    "visibility" "ProblemVisibility" NOT NULL DEFAULT 'PUBLIC',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningCollectionItem" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningCollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningCollectionProgress" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unlockedCount" INTEGER NOT NULL DEFAULT 0,
    "completedCount" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "LearningCollectionProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyChallenge" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "problemId" TEXT NOT NULL,
    "assignedById" TEXT,
    "rewardXp" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyChallengeCompletion" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "submissionId" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "xpAwarded" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DailyChallengeCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BadgeDefinition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT,
    "triggerType" TEXT NOT NULL,
    "triggerValue" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BadgeDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditorialSection" (
    "id" TEXT NOT NULL,
    "editorialId" TEXT NOT NULL,
    "type" "EditorialSectionType" NOT NULL DEFAULT 'TEXT',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "language" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditorialSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditorialOfficialSolution" (
    "id" TEXT NOT NULL,
    "editorialId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "explanation" TEXT,
    "timeComplexity" TEXT,
    "spaceComplexity" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditorialOfficialSolution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscussionHelpfulVote" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscussionHelpfulVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscussionAcceptedAnswer" (
    "id" TEXT NOT NULL,
    "discussionId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "acceptedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscussionAcceptedAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "PracticeSessionType" NOT NULL,
    "status" "PracticeSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "settings" JSONB,
    "summary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeSessionProblem" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "outcome" "PracticeOutcome",
    "secondsSpent" INTEGER,
    "submissionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeSessionProblem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContestAnnouncement" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContestAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContestRatingJob" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "requestedById" TEXT,
    "status" "RatingJobStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContestRatingJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitoringAlert" (
    "id" TEXT NOT NULL,
    "status" "MonitoringAlertStatus" NOT NULL DEFAULT 'OPEN',
    "severity" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "acknowledgedById" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonitoringAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_name_key" ON "Company"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE INDEX "Company_slug_idx" ON "Company"("slug");

-- CreateIndex
CREATE INDEX "ProblemCompany_companyId_frequency_idx" ON "ProblemCompany"("companyId", "frequency");

-- CreateIndex
CREATE INDEX "ProblemCompany_problemId_idx" ON "ProblemCompany"("problemId");

-- CreateIndex
CREATE UNIQUE INDEX "ProblemCompany_problemId_companyId_key" ON "ProblemCompany"("problemId", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningCollection_type_slug_key" ON "LearningCollection"("type", "slug");

-- CreateIndex
CREATE INDEX "LearningCollection_type_visibility_idx" ON "LearningCollection"("type", "visibility");

-- CreateIndex
CREATE INDEX "LearningCollection_createdById_idx" ON "LearningCollection"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "LearningCollectionItem_collectionId_problemId_key" ON "LearningCollectionItem"("collectionId", "problemId");

-- CreateIndex
CREATE INDEX "LearningCollectionItem_collectionId_order_idx" ON "LearningCollectionItem"("collectionId", "order");

-- CreateIndex
CREATE INDEX "LearningCollectionItem_problemId_idx" ON "LearningCollectionItem"("problemId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningCollectionProgress_collectionId_userId_key" ON "LearningCollectionProgress"("collectionId", "userId");

-- CreateIndex
CREATE INDEX "LearningCollectionProgress_userId_completedAt_idx" ON "LearningCollectionProgress"("userId", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailyChallenge_date_key" ON "DailyChallenge"("date");

-- CreateIndex
CREATE INDEX "DailyChallenge_problemId_idx" ON "DailyChallenge"("problemId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyChallengeCompletion_challengeId_userId_key" ON "DailyChallengeCompletion"("challengeId", "userId");

-- CreateIndex
CREATE INDEX "DailyChallengeCompletion_userId_completedAt_idx" ON "DailyChallengeCompletion"("userId", "completedAt");

-- CreateIndex
CREATE INDEX "DailyChallengeCompletion_problemId_idx" ON "DailyChallengeCompletion"("problemId");

-- CreateIndex
CREATE UNIQUE INDEX "BadgeDefinition_key_key" ON "BadgeDefinition"("key");

-- CreateIndex
CREATE INDEX "BadgeDefinition_isActive_idx" ON "BadgeDefinition"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "UserBadge_userId_badgeId_sourceType_sourceId_key" ON "UserBadge"("userId", "badgeId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "UserBadge_userId_awardedAt_idx" ON "UserBadge"("userId", "awardedAt");

-- CreateIndex
CREATE INDEX "UserBadge_badgeId_idx" ON "UserBadge"("badgeId");

-- CreateIndex
CREATE INDEX "EditorialSection_editorialId_order_idx" ON "EditorialSection"("editorialId", "order");

-- CreateIndex
CREATE INDEX "EditorialOfficialSolution_editorialId_order_idx" ON "EditorialOfficialSolution"("editorialId", "order");

-- CreateIndex
CREATE INDEX "EditorialOfficialSolution_language_idx" ON "EditorialOfficialSolution"("language");

-- CreateIndex
CREATE UNIQUE INDEX "DiscussionHelpfulVote_commentId_userId_key" ON "DiscussionHelpfulVote"("commentId", "userId");

-- CreateIndex
CREATE INDEX "DiscussionHelpfulVote_userId_idx" ON "DiscussionHelpfulVote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscussionAcceptedAnswer_discussionId_key" ON "DiscussionAcceptedAnswer"("discussionId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscussionAcceptedAnswer_commentId_key" ON "DiscussionAcceptedAnswer"("commentId");

-- CreateIndex
CREATE INDEX "DiscussionAcceptedAnswer_acceptedById_idx" ON "DiscussionAcceptedAnswer"("acceptedById");

-- CreateIndex
CREATE INDEX "PracticeSession_userId_type_startedAt_idx" ON "PracticeSession"("userId", "type", "startedAt");

-- CreateIndex
CREATE INDEX "PracticeSession_status_startedAt_idx" ON "PracticeSession"("status", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PracticeSessionProblem_sessionId_problemId_key" ON "PracticeSessionProblem"("sessionId", "problemId");

-- CreateIndex
CREATE INDEX "PracticeSessionProblem_problemId_idx" ON "PracticeSessionProblem"("problemId");

-- CreateIndex
CREATE INDEX "ContestAnnouncement_contestId_createdAt_idx" ON "ContestAnnouncement"("contestId", "createdAt");

-- CreateIndex
CREATE INDEX "ContestRatingJob_status_scheduledAt_idx" ON "ContestRatingJob"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "ContestRatingJob_contestId_idx" ON "ContestRatingJob"("contestId");

-- CreateIndex
CREATE INDEX "MonitoringAlert_status_createdAt_idx" ON "MonitoringAlert"("status", "createdAt");

-- CreateIndex
CREATE INDEX "MonitoringAlert_severity_createdAt_idx" ON "MonitoringAlert"("severity", "createdAt");

-- CreateIndex
CREATE INDEX "Contest_freezeStartsAt_idx" ON "Contest"("freezeStartsAt");

-- CreateIndex
CREATE INDEX "Contest_ratingsPublishedAt_idx" ON "Contest"("ratingsPublishedAt");

-- CreateIndex
CREATE INDEX "DiscussionComment_helpfulVotes_idx" ON "DiscussionComment"("helpfulVotes");

-- AddForeignKey
ALTER TABLE "ProblemCompany" ADD CONSTRAINT "ProblemCompany_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemCompany" ADD CONSTRAINT "ProblemCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningCollection" ADD CONSTRAINT "LearningCollection_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningCollectionItem" ADD CONSTRAINT "LearningCollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "LearningCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningCollectionItem" ADD CONSTRAINT "LearningCollectionItem_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningCollectionProgress" ADD CONSTRAINT "LearningCollectionProgress_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "LearningCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningCollectionProgress" ADD CONSTRAINT "LearningCollectionProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyChallenge" ADD CONSTRAINT "DailyChallenge_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyChallenge" ADD CONSTRAINT "DailyChallenge_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyChallengeCompletion" ADD CONSTRAINT "DailyChallengeCompletion_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "DailyChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyChallengeCompletion" ADD CONSTRAINT "DailyChallengeCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyChallengeCompletion" ADD CONSTRAINT "DailyChallengeCompletion_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyChallengeCompletion" ADD CONSTRAINT "DailyChallengeCompletion_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BadgeDefinition" ADD CONSTRAINT "BadgeDefinition_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "BadgeDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialSection" ADD CONSTRAINT "EditorialSection_editorialId_fkey" FOREIGN KEY ("editorialId") REFERENCES "Editorial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialOfficialSolution" ADD CONSTRAINT "EditorialOfficialSolution_editorialId_fkey" FOREIGN KEY ("editorialId") REFERENCES "Editorial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionHelpfulVote" ADD CONSTRAINT "DiscussionHelpfulVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "DiscussionComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionHelpfulVote" ADD CONSTRAINT "DiscussionHelpfulVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionAcceptedAnswer" ADD CONSTRAINT "DiscussionAcceptedAnswer_discussionId_fkey" FOREIGN KEY ("discussionId") REFERENCES "Discussion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionAcceptedAnswer" ADD CONSTRAINT "DiscussionAcceptedAnswer_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "DiscussionComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionAcceptedAnswer" ADD CONSTRAINT "DiscussionAcceptedAnswer_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeSession" ADD CONSTRAINT "PracticeSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeSessionProblem" ADD CONSTRAINT "PracticeSessionProblem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PracticeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeSessionProblem" ADD CONSTRAINT "PracticeSessionProblem_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeSessionProblem" ADD CONSTRAINT "PracticeSessionProblem_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestAnnouncement" ADD CONSTRAINT "ContestAnnouncement_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestAnnouncement" ADD CONSTRAINT "ContestAnnouncement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestRatingJob" ADD CONSTRAINT "ContestRatingJob_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestRatingJob" ADD CONSTRAINT "ContestRatingJob_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitoringAlert" ADD CONSTRAINT "MonitoringAlert_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitoringAlert" ADD CONSTRAINT "MonitoringAlert_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
