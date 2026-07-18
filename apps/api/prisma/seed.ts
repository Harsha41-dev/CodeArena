import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma, PrismaClient, SubmissionStatus } from "@prisma/client";
import { languageCatalog } from "../src/constants/languageCatalog";
import { problemFixtures } from "../src/constants/problemFixtures";

const prisma = new PrismaClient();

const dayMs = 24 * 60 * 60 * 1000;

function minutesAfter(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * dayMs);
}

function startOfUtcDay(date: Date): Date {
  return new Date(`${date.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

function hashContent(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function seedLanguageCatalog() {
  const languageByKey = new Map<string, Awaited<ReturnType<typeof prisma.language.upsert>>>();
  const defaultVersionByKey = new Map<string, Awaited<ReturnType<typeof prisma.languageVersion.upsert>>>();

  for (const languageSeed of languageCatalog) {
    const language = await prisma.language.upsert({
      where: { key: languageSeed.key },
      update: {
        displayName: languageSeed.displayName,
        monacoId: languageSeed.monacoId,
        fileExtension: languageSeed.fileExtension,
        category: languageSeed.category,
        isCompiled: languageSeed.isCompiled,
        sortOrder: languageSeed.sortOrder
      },
      create: {
        key: languageSeed.key,
        displayName: languageSeed.displayName,
        monacoId: languageSeed.monacoId,
        fileExtension: languageSeed.fileExtension,
        category: languageSeed.category,
        isActive: true,
        isCompiled: languageSeed.isCompiled,
        sortOrder: languageSeed.sortOrder
      }
    });
    languageByKey.set(language.key, language);

    for (const versionSeed of languageSeed.versions) {
      if (versionSeed.isDefault) {
        await prisma.languageVersion.updateMany({ where: { languageId: language.id }, data: { isDefault: false } });
      }
      const version = await prisma.languageVersion.upsert({
        where: { languageId_version: { languageId: language.id, version: versionSeed.version } },
        update: {
          label: versionSeed.label,
          judge0Id: versionSeed.judge0Id ?? null,
          dockerImage: versionSeed.dockerImage ?? null,
          compileCommand: versionSeed.compileCommand ?? null,
          runCommand: versionSeed.runCommand ?? null,
          timeLimitMultiplier: versionSeed.timeLimitMultiplier ?? 1,
          memoryLimitMultiplier: versionSeed.memoryLimitMultiplier ?? 1,
          sourceFileName: versionSeed.sourceFileName,
          executableFileName: versionSeed.executableFileName ?? null,
          starterTemplate: versionSeed.starterTemplate,
          isDefault: versionSeed.isDefault ?? false,
          isActive: versionSeed.isActive ?? true
        },
        create: {
          languageId: language.id,
          version: versionSeed.version,
          label: versionSeed.label,
          judge0Id: versionSeed.judge0Id ?? null,
          dockerImage: versionSeed.dockerImage ?? null,
          compileCommand: versionSeed.compileCommand ?? null,
          runCommand: versionSeed.runCommand ?? null,
          timeLimitMultiplier: versionSeed.timeLimitMultiplier ?? 1,
          memoryLimitMultiplier: versionSeed.memoryLimitMultiplier ?? 1,
          sourceFileName: versionSeed.sourceFileName,
          executableFileName: versionSeed.executableFileName ?? null,
          starterTemplate: versionSeed.starterTemplate,
          isDefault: versionSeed.isDefault ?? false,
          isActive: versionSeed.isActive ?? true
        }
      });

      if (version.isDefault || !defaultVersionByKey.has(language.key)) {
        defaultVersionByKey.set(language.key, version);
      }

      await prisma.executionProfile.upsert({
        where: { languageVersionId_executorType: { languageVersionId: version.id, executorType: "MOCK" } },
        update: { isActive: true },
        create: { languageVersionId: version.id, executorType: "MOCK", isActive: true }
      });
      if (version.judge0Id) {
        await prisma.executionProfile.upsert({
          where: { languageVersionId_executorType: { languageVersionId: version.id, executorType: "JUDGE0" } },
          update: { judge0Id: version.judge0Id, isActive: true },
          create: { languageVersionId: version.id, executorType: "JUDGE0", judge0Id: version.judge0Id, isActive: true }
        });
      }
      if (version.dockerImage && (version.compileCommand || version.runCommand)) {
        await prisma.executionProfile.upsert({
          where: { languageVersionId_executorType: { languageVersionId: version.id, executorType: "DOCKER" } },
          update: {
            dockerImage: version.dockerImage,
            compileCommand: version.compileCommand,
            runCommand: version.runCommand,
            isActive: true
          },
          create: {
            languageVersionId: version.id,
            executorType: "DOCKER",
            dockerImage: version.dockerImage,
            compileCommand: version.compileCommand,
            runCommand: version.runCommand,
            isActive: true
          }
        });
      }
    }
  }

  return { languageByKey, defaultVersionByKey };
}

async function main(): Promise<void> {
  const localPasswordHash = await bcrypt.hash("password", 10);
  const legacyPasswordHash = await bcrypt.hash("Password123!", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {
      username: "admin_local",
      displayName: "CodeArena Admin",
      passwordHash: localPasswordHash,
      role: "ADMIN",
      status: "ACTIVE",
      bio: "Platform administrator",
      country: "India",
      countryCode: "IN"
    },
    create: {
      email: "admin@example.com",
      username: "admin_local",
      displayName: "CodeArena Admin",
      passwordHash: localPasswordHash,
      role: "ADMIN",
      status: "ACTIVE",
      bio: "Platform administrator",
      country: "India",
      countryCode: "IN"
    }
  });

  const demo = await prisma.user.upsert({
    where: { email: "user@example.com" },
    update: {
      username: "demo_user",
      displayName: "Demo User",
      passwordHash: localPasswordHash,
      role: "USER",
      status: "ACTIVE",
      bio: "Practicing DSA and contests",
      country: "United States",
      countryCode: "US"
    },
    create: {
      email: "user@example.com",
      username: "demo_user",
      displayName: "Demo User",
      passwordHash: localPasswordHash,
      role: "USER",
      status: "ACTIVE",
      bio: "Practicing DSA and contests",
      country: "United States",
      countryCode: "US"
    }
  });

  await prisma.user.upsert({
    where: { email: "admin@codearena.dev" },
    update: {
      passwordHash: legacyPasswordHash,
      role: "ADMIN",
      status: "ACTIVE"
    },
    create: {
      email: "admin@codearena.dev",
      username: "admin",
      displayName: "CodeArena Admin",
      passwordHash: legacyPasswordHash,
      role: "ADMIN",
      status: "ACTIVE",
      bio: "Legacy demo administrator",
      country: "India",
      countryCode: "IN"
    }
  });

  await prisma.user.upsert({
    where: { email: "demo@codearena.dev" },
    update: {
      passwordHash: legacyPasswordHash,
      role: "USER",
      status: "ACTIVE"
    },
    create: {
      email: "demo@codearena.dev",
      username: "demo",
      displayName: "Legacy Demo User",
      passwordHash: legacyPasswordHash,
      role: "USER",
      status: "ACTIVE",
      bio: "Legacy demo account",
      country: "United States",
      countryCode: "US"
    }
  });

  const { languageByKey, defaultVersionByKey } = await seedLanguageCatalog();
  const problemIds: string[] = [];
  const problemBySlug = new Map<string, { id: string; title: string }>();
  for (const fixture of problemFixtures) {
    const tags = await Promise.all(
      fixture.tags.map((name) => {
        const slug = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
        return prisma.tag.upsert({
          where: { slug },
          update: { name },
          create: { name, slug }
        });
      })
    );

    const problem = await prisma.problem.upsert({
      where: { slug: fixture.slug },
      update: {
        title: fixture.title,
        difficulty: fixture.difficulty,
        description: fixture.description,
        constraints: fixture.constraints,
        inputFormat: fixture.inputFormat,
        outputFormat: fixture.outputFormat,
        starterCode: fixture.starterCode as unknown as Prisma.InputJsonValue,
        visibility: "PUBLIC",
        timeLimitMs: 2000,
        memoryLimitMb: 256
      },
      create: {
        slug: fixture.slug,
        title: fixture.title,
        difficulty: fixture.difficulty,
        description: fixture.description,
        constraints: fixture.constraints,
        inputFormat: fixture.inputFormat,
        outputFormat: fixture.outputFormat,
        starterCode: fixture.starterCode as unknown as Prisma.InputJsonValue,
        visibility: "PUBLIC",
        timeLimitMs: 2000,
        memoryLimitMb: 256,
        createdById: admin.id
      }
    });
    problemIds.push(problem.id);
    problemBySlug.set(fixture.slug, { id: problem.id, title: problem.title });

    await prisma.problemTag.deleteMany({ where: { problemId: problem.id } });
    await prisma.problemTag.createMany({
      data: tags.map((tag) => ({ problemId: problem.id, tagId: tag.id })),
      skipDuplicates: true
    });

    await prisma.testCase.deleteMany({ where: { problemId: problem.id } });
    const testCases = [
      ...fixture.sampleCases.map((testCase) => ({ ...testCase, isSample: true })),
      ...fixture.hiddenCases.map((testCase) => ({ ...testCase, isSample: false }))
    ];
    await prisma.testCase.createMany({
      data: testCases.map((testCase, index) => ({
        problemId: problem.id,
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        isSample: testCase.isSample,
        isStrict: true,
        explanation:
          "explanation" in testCase && typeof testCase.explanation === "string" ? testCase.explanation : null,
        order: index + 1
      }))
    });

    await prisma.editorial.upsert({
      where: { problemId: problem.id },
      update: {
        title: `${fixture.title} Editorial`,
        content: fixture.editorial,
        authorId: admin.id,
        isPublished: true,
        publishedAt: new Date()
      },
      create: {
        problemId: problem.id,
        title: `${fixture.title} Editorial`,
        content: fixture.editorial,
        authorId: admin.id,
        isPublished: true,
        publishedAt: new Date()
      }
    });

    for (const [languageKey, language] of languageByKey.entries()) {
      const version = defaultVersionByKey.get(languageKey);
      if (!version) continue;
      await prisma.problemLanguage.upsert({
        where: { problemId_languageId: { problemId: problem.id, languageId: language.id } },
        update: { languageVersionId: version.id, isEnabled: true },
        create: { problemId: problem.id, languageId: language.id, languageVersionId: version.id, isEnabled: true }
      });
      const starterCode = version.starterTemplate ?? "";
      const existingStarter = await prisma.problemStarterCode.findFirst({
        where: { problemId: problem.id, languageId: language.id, languageVersionId: version.id }
      });
      if (existingStarter) {
        await prisma.problemStarterCode.update({ where: { id: existingStarter.id }, data: { code: starterCode } });
      } else {
        await prisma.problemStarterCode.create({
          data: { problemId: problem.id, languageId: language.id, languageVersionId: version.id, code: starterCode }
        });
      }
    }
  }

  const twoSumForGeneration = problemBySlug.get("two-sum");
  const pythonForGeneration = languageByKey.get("python");
  const pythonVersionForGeneration = defaultVersionByKey.get("python");
  if (twoSumForGeneration && pythonForGeneration && pythonVersionForGeneration) {
    await prisma.problemAsset.deleteMany({ where: { problemId: twoSumForGeneration.id } });
    await prisma.testCaseGenerationJob.deleteMany({ where: { problemId: twoSumForGeneration.id } });

    await prisma.problemAsset.createMany({
      data: [
        {
          problemId: twoSumForGeneration.id,
          type: "GENERATOR",
          languageId: pythonForGeneration.id,
          languageVersionId: pythonVersionForGeneration.id,
          filename: "two_sum_generator.py",
          sourceCode:
            "import random, sys\nseed = int(sys.argv[1]) if len(sys.argv) > 1 else 1\nrng = random.Random(seed)\nnums = [rng.randint(1, 20) for _ in range(4)]\ntarget = nums[0] + nums[1]\nprint(len(nums))\nprint(*nums)\nprint(target)\n",
          createdById: admin.id,
          isActive: true
        },
        {
          problemId: twoSumForGeneration.id,
          type: "REFERENCE_SOLUTION",
          languageId: pythonForGeneration.id,
          languageVersionId: pythonVersionForGeneration.id,
          filename: "two_sum_reference.py",
          sourceCode:
            "import sys\ndata=list(map(int, sys.stdin.read().split()))\nn=data[0]\nnums=data[1:1+n]\ntarget=data[1+n]\nseen={}\nfor i,x in enumerate(nums):\n    if target-x in seen:\n        print(seen[target-x], i)\n        break\n    seen[x]=i\n",
          createdById: admin.id,
          isActive: true
        },
        {
          problemId: twoSumForGeneration.id,
          type: "VALIDATOR",
          languageId: pythonForGeneration.id,
          languageVersionId: pythonVersionForGeneration.id,
          filename: "two_sum_validator.py",
          sourceCode:
            "import sys\ndata=list(map(int, sys.stdin.read().split()))\nassert data and data[0] == len(data[1:-1])\nassert data[0] >= 2\n",
          createdById: admin.id,
          isActive: true
        }
      ]
    });

    const generationConfig = {
      batchName: "Seeded generated hidden tests",
      description: "Demo generated cases for the admin test-generation workflow",
      visibility: "HIDDEN",
      count: 2,
      seedStart: 101,
      seedEnd: 102,
      inputMode: "STDIN",
      replaceExistingGenerated: false,
      runValidator: true,
      allowEmptyInput: false,
      allowEmptyOutput: false,
      skipDuplicates: true,
      timeLimitMs: 2000,
      memoryLimitMb: 256
    };
    const generationJob = await prisma.testCaseGenerationJob.create({
      data: {
        problemId: twoSumForGeneration.id,
        requestedById: admin.id,
        status: "COMPLETED",
        config: generationConfig as Prisma.InputJsonValue,
        totalCases: 2,
        generatedCases: 2,
        completedAt: new Date()
      }
    });
    const generatedBatch = await prisma.generatedTestCaseBatch.create({
      data: {
        problemId: twoSumForGeneration.id,
        jobId: generationJob.id,
        name: "Seeded generated hidden tests",
        description: "Demo generated cases for the admin test-generation workflow",
        createdById: admin.id
      }
    });
    const generatedCases = [
      { seed: 101, input: "4\n7 10 3 15\n17\n", expectedOutput: "0 1" },
      { seed: 102, input: "4\n12 5 9 2\n17\n", expectedOutput: "0 1" }
    ];
    await prisma.testCase.createMany({
      data: generatedCases.map((testCase, index) => ({
        problemId: twoSumForGeneration.id,
        batchId: generatedBatch.id,
        generatedByJobId: generationJob.id,
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        isSample: false,
        isStrict: true,
        explanation: `Generated with seed ${testCase.seed}`,
        order: 100 + index,
        inputHash: hashContent(testCase.input),
        outputHash: hashContent(testCase.expectedOutput),
        generatorSeed: testCase.seed,
        isGenerated: true
      }))
    });
  }

  const startTime = new Date(Date.now() - 60 * 60 * 1000);
  const endTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const contest = await prisma.contest.upsert({
    where: { slug: "starter-contest" },
    update: {
      title: "CodeArena Starter Contest",
      description: "A short contest using the first three warm-up problems.",
      startTime,
      endTime,
      status: "LIVE",
      visibility: "PUBLIC"
    },
    create: {
      title: "CodeArena Starter Contest",
      slug: "starter-contest",
      description: "A short contest using the first three warm-up problems.",
      startTime,
      endTime,
      status: "LIVE",
      visibility: "PUBLIC",
      createdById: admin.id
    }
  });

  await prisma.contestProblem.deleteMany({ where: { contestId: contest.id } });
  await prisma.contestProblem.createMany({
    data: problemIds.slice(0, 3).map((problemId, index) => ({
      contestId: contest.id,
      problemId,
      order: index + 1,
      points: 100
    })),
    skipDuplicates: true
  });

  await prisma.contestRegistration.upsert({
    where: { contestId_userId: { contestId: contest.id, userId: demo.id } },
    update: {},
    create: { contestId: contest.id, userId: demo.id }
  });

  const previousSubmissionIds = await prisma.submission.findMany({
    where: { userId: demo.id },
    select: { id: true }
  });
  const previousSubmissionIdValues = previousSubmissionIds.map((submission) => submission.id);
  if (previousSubmissionIdValues.length > 0) {
    await prisma.contestSubmission.deleteMany({ where: { submissionId: { in: previousSubmissionIdValues } } });
    await prisma.submissionTestCaseResult.deleteMany({ where: { submissionId: { in: previousSubmissionIdValues } } });
    await prisma.submission.deleteMany({ where: { id: { in: previousSubmissionIdValues } } });
  }
  await prisma.problemSolvedStatus.deleteMany({
    where: { userId: demo.id, problemId: { in: problemIds } }
  });

  async function createDemoSubmission(input: {
    problemSlug: string;
    status: SubmissionStatus;
    createdAt: Date;
    runtimeMs?: number;
    memoryKb?: number;
    errorMessage?: string;
    actualOutput?: string;
  }) {
    const problem = problemBySlug.get(input.problemSlug);
    if (!problem) throw new Error(`Missing seeded problem ${input.problemSlug}`);
    const python = languageByKey.get("python");
    const pythonVersion = defaultVersionByKey.get("python");
    if (!python || !pythonVersion) throw new Error("Missing Python language seed");

    const completedAt = minutesAfter(input.createdAt, 1);
    const submission = await prisma.submission.create({
      data: {
        userId: demo.id,
        problemId: problem.id,
        code: "# Seeded demo submission\nprint('demo')\n",
        language: "PYTHON",
        languageId: python.id,
        languageVersionId: pythonVersion.id,
        languageKeySnapshot: python.key,
        languageNameSnapshot: python.displayName,
        languageVersionSnapshot: pythonVersion.label,
        status: input.status,
        runtimeMs: input.runtimeMs ?? null,
        memoryKb: input.memoryKb ?? null,
        errorMessage: input.errorMessage ?? null,
        createdAt: input.createdAt,
        completedAt
      }
    });

    const testCase = await prisma.testCase.findFirst({
      where: { problemId: problem.id },
      orderBy: { order: "asc" }
    });
    if (testCase) {
      await prisma.submissionTestCaseResult.create({
        data: {
          submissionId: submission.id,
          testCaseId: testCase.id,
          status: input.status,
          input: testCase.input,
          expectedOutput: testCase.expectedOutput,
          actualOutput:
            input.actualOutput ?? (input.status === "ACCEPTED" ? testCase.expectedOutput : "seeded wrong output"),
          stderr: input.errorMessage ?? null,
          runtimeMs: input.runtimeMs ?? null,
          memoryKb: input.memoryKb ?? null,
          createdAt: completedAt
        }
      });
    }

    return submission;
  }

  const contestTwoSum = await createDemoSubmission({
    problemSlug: "two-sum",
    status: "ACCEPTED",
    createdAt: minutesAfter(startTime, 12),
    runtimeMs: 42,
    memoryKb: 12340
  });
  const contestReverseWrong = await createDemoSubmission({
    problemSlug: "reverse-string",
    status: "WRONG_ANSWER",
    createdAt: minutesAfter(startTime, 20),
    runtimeMs: 38,
    memoryKb: 11800
  });
  const contestReverseAccepted = await createDemoSubmission({
    problemSlug: "reverse-string",
    status: "ACCEPTED",
    createdAt: minutesAfter(startTime, 31),
    runtimeMs: 35,
    memoryKb: 11840
  });
  const binaryAccepted = await createDemoSubmission({
    problemSlug: "binary-search",
    status: "ACCEPTED",
    createdAt: daysAgo(2),
    runtimeMs: 29,
    memoryKb: 10920
  });
  const maximumAccepted = await createDemoSubmission({
    problemSlug: "maximum-subarray",
    status: "ACCEPTED",
    createdAt: daysAgo(1),
    runtimeMs: 51,
    memoryKb: 13120
  });
  const validWrong = await createDemoSubmission({
    problemSlug: "valid-parentheses",
    status: "WRONG_ANSWER",
    createdAt: minutesAfter(startTime, 40),
    runtimeMs: 24,
    memoryKb: 10400
  });

  for (const [problemSlug, attempts, firstSolvedAt, lastSubmittedAt] of [
    ["two-sum", 1, contestTwoSum.completedAt, contestTwoSum.completedAt],
    ["reverse-string", 2, contestReverseAccepted.completedAt, contestReverseAccepted.completedAt],
    ["binary-search", 1, binaryAccepted.completedAt, binaryAccepted.completedAt],
    ["maximum-subarray", 1, maximumAccepted.completedAt, maximumAccepted.completedAt]
  ] as Array<[string, number, Date | null, Date | null]>) {
    const problem = problemBySlug.get(problemSlug);
    if (!problem || !firstSolvedAt || !lastSubmittedAt) continue;
    await prisma.problemSolvedStatus.upsert({
      where: { userId_problemId: { userId: demo.id, problemId: problem.id } },
      update: {
        attempted: true,
        solved: true,
        attempts,
        firstSolvedAt,
        lastSubmittedAt
      },
      create: {
        userId: demo.id,
        problemId: problem.id,
        attempted: true,
        solved: true,
        attempts,
        firstSolvedAt,
        lastSubmittedAt
      }
    });
  }

  const validParentheses = problemBySlug.get("valid-parentheses");
  if (validParentheses) {
    await prisma.problemSolvedStatus.upsert({
      where: { userId_problemId: { userId: demo.id, problemId: validParentheses.id } },
      update: {
        attempted: true,
        solved: false,
        attempts: 1,
        firstSolvedAt: null,
        lastSubmittedAt: validWrong.completedAt
      },
      create: {
        userId: demo.id,
        problemId: validParentheses.id,
        attempted: true,
        solved: false,
        attempts: 1,
        firstSolvedAt: null,
        lastSubmittedAt: validWrong.completedAt
      }
    });
  }

  const twoSumProblemId = problemBySlug.get("two-sum")?.id;
  const reverseStringProblemId = problemBySlug.get("reverse-string")?.id;
  if (!twoSumProblemId || !reverseStringProblemId) throw new Error("Missing contest demo problems");

  const contestSubmissionRows: Prisma.ContestSubmissionCreateManyInput[] = [
    {
      contestId: contest.id,
      userId: demo.id,
      problemId: twoSumProblemId,
      submissionId: contestTwoSum.id,
      status: SubmissionStatus.ACCEPTED,
      penaltyMinutes: 12,
      submittedAt: contestTwoSum.createdAt
    },
    {
      contestId: contest.id,
      userId: demo.id,
      problemId: reverseStringProblemId,
      submissionId: contestReverseWrong.id,
      status: SubmissionStatus.WRONG_ANSWER,
      penaltyMinutes: 0,
      submittedAt: contestReverseWrong.createdAt
    },
    {
      contestId: contest.id,
      userId: demo.id,
      problemId: reverseStringProblemId,
      submissionId: contestReverseAccepted.id,
      status: SubmissionStatus.ACCEPTED,
      penaltyMinutes: 51,
      submittedAt: contestReverseAccepted.createdAt
    }
  ];

  await prisma.contestSubmission.createMany({
    data: contestSubmissionRows,
    skipDuplicates: true
  });

  const bookmarkSlugs = ["two-sum", "binary-search", "maximum-subarray"];
  for (const slug of bookmarkSlugs) {
    const problem = problemBySlug.get(slug);
    if (!problem) continue;
    await prisma.bookmark.upsert({
      where: { userId_problemId: { userId: demo.id, problemId: problem.id } },
      update: {},
      create: { userId: demo.id, problemId: problem.id }
    });
  }

  const twoSumProblemRef = problemBySlug.get("two-sum");
  if (twoSumProblemRef) {
    await prisma.note.upsert({
      where: { userId_problemId: { userId: demo.id, problemId: twoSumProblemRef.id } },
      update: { content: "Use a hash map of value -> index and check the complement before inserting." },
      create: {
        userId: demo.id,
        problemId: twoSumProblemRef.id,
        content: "Use a hash map of value -> index and check the complement before inserting."
      }
    });
  }

  const snapshotDate = startOfUtcDay(daysAgo(1));
  await prisma.userRankSnapshot.upsert({
    where: { userId_snapshotDate: { userId: demo.id, snapshotDate } },
    update: { rank: 4, solvedCount: 2, acceptanceRate: 67 },
    create: {
      userId: demo.id,
      rank: 4,
      solvedCount: 2,
      acceptanceRate: 67,
      snapshotDate
    }
  });
  await prisma.userRankSnapshot.upsert({
    where: { userId_snapshotDate: { userId: admin.id, snapshotDate } },
    update: { rank: 2, solvedCount: 0, acceptanceRate: 0 },
    create: {
      userId: admin.id,
      rank: 2,
      solvedCount: 0,
      acceptanceRate: 0,
      snapshotDate
    }
  });

  await prisma.discussion.deleteMany({
    where: {
      authorId: demo.id,
      title: {
        in: ["Hash map intuition", "How should I warm up before a contest?"]
      }
    }
  });

  const twoSum = await prisma.problem.findUnique({ where: { slug: "two-sum" } });
  if (twoSum) {
    const problemDiscussion = await prisma.discussion.create({
      data: {
        problemId: twoSum.id,
        authorId: demo.id,
        title: "Hash map intuition",
        content: "The complement lookup is the key idea for linear time.",
        tags: ["two-sum", "hash-map"],
        upvotes: 3
      }
    });
    await prisma.discussionComment.create({
      data: {
        discussionId: problemDiscussion.id,
        authorId: admin.id,
        content: "This is the intended direction. It also keeps the first valid pair stable.",
        upvotes: 1
      }
    });
  }

  const generalDiscussion = await prisma.discussion.create({
    data: {
      authorId: demo.id,
      title: "How should I warm up before a contest?",
      content: "I usually solve one implementation task and one binary-search task before a live contest.",
      tags: ["contest", "beginner"],
      upvotes: 2
    }
  });
  await prisma.discussionComment.create({
    data: {
      discussionId: generalDiscussion.id,
      authorId: admin.id,
      content: "Pick one implementation problem and one familiar pattern. Keep it short.",
      upvotes: 1
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
