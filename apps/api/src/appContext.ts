import type { Executor } from "./executors/Executor";
import { createExecutor } from "./executors";
import { env } from "./config/env";
import { InMemorySubmissionEventBus, type SubmissionEventBus } from "./events/SubmissionEventBus";
import { MemoryRepository } from "./repositories/MemoryRepository";
import { PrismaRepository } from "./repositories/PrismaRepository";
import type { AppRepository } from "./repositories/AppRepository";
import {
  MemoryLanguageRepository,
  PrismaLanguageRepository,
  type LanguageRepository
} from "./repositories/LanguageRepository";
import { BullMqSubmissionQueue, InMemorySubmissionQueue, type SubmissionQueue } from "./queue/SubmissionQueue";
import {
  BullMqTestCaseGenerationQueue,
  InMemoryTestCaseGenerationQueue,
  type TestCaseGenerationQueue
} from "./queue/TestCaseGenerationQueue";
import { AuthService } from "./services/AuthService";
import { ContestService } from "./services/ContestService";
import { ExecutorCapabilityService } from "./services/executorCapability.service";
import { LanguageResolver } from "./services/LanguageResolver";
import { LanguageService } from "./services/LanguageService";
import { LeaderboardService } from "./services/LeaderboardService";
import { ProblemService } from "./services/ProblemService";
import { SocialService } from "./services/SocialService";
import { SubmissionService } from "./services/SubmissionService";
import { SubmissionWorker } from "./services/SubmissionWorker";
import { TestCaseGenerationService } from "./services/TestCaseGenerationService";
import { TestCaseGenerationWorker } from "./services/TestCaseGenerationWorker";
import { UserService } from "./services/UserService";

// everything the API needs — repos, queues, workers, services
export interface AppContext {
  repository: AppRepository;
  languageRepository: LanguageRepository;
  executor: Executor;
  queue: SubmissionQueue;
  testCaseGenerationQueue: TestCaseGenerationQueue;
  submissionEvents: SubmissionEventBus;
  worker: SubmissionWorker;
  testCaseGenerationWorker: TestCaseGenerationWorker;
  services: {
    auth: AuthService;
    users: UserService;
    problems: ProblemService;
    languages: LanguageService;
    submissions: SubmissionService;
    testCaseGeneration: TestCaseGenerationService;
    contests: ContestService;
    executorCapabilities: ExecutorCapabilityService;
    leaderboards: LeaderboardService;
    social: SocialService;
  };
}

// tests can pass in fakes / memory repos
export interface AppContextOptions {
  repository?: AppRepository;
  languageRepository?: LanguageRepository;
  executor?: Executor;
  queue?: SubmissionQueue;
  testCaseGenerationQueue?: TestCaseGenerationQueue;
  submissionEvents?: SubmissionEventBus;
  autoProcessSubmissions?: boolean;
  autoProcessTestCaseGeneration?: boolean;
}

export function createAppContext(options: AppContextOptions = {}): AppContext {
  // pick prisma if DATABASE_URL is set, otherwise in-memory (good for tests/local)
  let repository: AppRepository;
  if (options.repository) {
    repository = options.repository;
  } else if (env.DATABASE_URL) {
    repository = new PrismaRepository();
  } else {
    repository = new MemoryRepository(true);
  }

  let languageRepository: LanguageRepository;
  if (options.languageRepository) {
    languageRepository = options.languageRepository;
  } else if (env.DATABASE_URL) {
    languageRepository = new PrismaLanguageRepository();
  } else {
    languageRepository = new MemoryLanguageRepository(true);
  }

  let executor: Executor;
  if (options.executor) {
    executor = options.executor;
  } else {
    executor = createExecutor();
  }

  let submissionEvents: SubmissionEventBus;
  if (options.submissionEvents) {
    submissionEvents = options.submissionEvents;
  } else {
    submissionEvents = new InMemorySubmissionEventBus();
  }

  const languageResolver = new LanguageResolver(languageRepository);
  const executorCapabilities = new ExecutorCapabilityService(languageRepository, repository);

  // Assigned after the queue: in-memory queue needs a processJob callback into the worker.
  // eslint-disable-next-line prefer-const -- definite assignment after circular queue wiring
  let testCaseGenerationWorker!: TestCaseGenerationWorker;

  let testCaseGenerationQueue: TestCaseGenerationQueue;
  if (options.testCaseGenerationQueue) {
    testCaseGenerationQueue = options.testCaseGenerationQueue;
  } else if (env.REDIS_URL && env.NODE_ENV !== "test") {
    testCaseGenerationQueue = new BullMqTestCaseGenerationQueue();
  } else {
    const autoProcess =
      options.autoProcessTestCaseGeneration !== undefined
        ? options.autoProcessTestCaseGeneration
        : env.NODE_ENV !== "test";

    testCaseGenerationQueue = new InMemoryTestCaseGenerationQueue(
      {
        processJob: (jobId: string) => testCaseGenerationWorker.processJob(jobId)
      } as TestCaseGenerationWorker,
      autoProcess
    );
  }

  const testCaseGeneration = new TestCaseGenerationService(
    repository,
    languageRepository,
    executor,
    testCaseGenerationQueue
  );

  const worker = new SubmissionWorker(repository, executor, languageResolver, submissionEvents, testCaseGeneration);

  // same idea as test-gen queue: redis in prod, memory otherwise
  let queue: SubmissionQueue;
  if (options.queue) {
    queue = options.queue;
  } else if (env.REDIS_URL && env.NODE_ENV !== "test") {
    queue = new BullMqSubmissionQueue();
  } else {
    let autoProcess = true;
    if (options.autoProcessSubmissions !== undefined) {
      autoProcess = options.autoProcessSubmissions;
    } else if (env.NODE_ENV === "test") {
      autoProcess = false;
    }
    queue = new InMemorySubmissionQueue(worker, autoProcess);
  }

  const submissions = new SubmissionService(repository, executor, queue, languageResolver);
  testCaseGenerationWorker = new TestCaseGenerationWorker(repository, testCaseGeneration);

  return {
    repository,
    languageRepository,
    executor,
    queue,
    testCaseGenerationQueue,
    submissionEvents,
    worker,
    testCaseGenerationWorker,
    services: {
      auth: new AuthService(repository),
      users: new UserService(repository),
      problems: new ProblemService(repository),
      languages: new LanguageService(languageRepository, repository),
      executorCapabilities,
      submissions,
      testCaseGeneration,
      contests: new ContestService(repository),
      leaderboards: new LeaderboardService(repository),
      social: new SocialService(repository)
    }
  };
}
