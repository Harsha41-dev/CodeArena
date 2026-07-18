// quick CLI: npm run judge0:health
async function main(): Promise<void> {
  if (!process.env.EXECUTOR_MODE) {
    process.env.EXECUTOR_MODE = "judge0";
  }

  const envModule = await import("../config/env");
  const healthModule = await import("../services/judge0Health");

  const result = await healthModule.checkJudge0Health();

  if (!result.baseUrlConfigured) {
    console.error(result.message);
    process.exit(1);
  }

  if (!result.judge0Reachable) {
    console.error(result.message);
    process.exit(1);
  }

  const count = result.languagesCount ?? "unknown";
  console.log(`Judge0 reachable at ${envModule.env.JUDGE0_BASE_URL}. Languages available: ${count}`);
}

main().catch((error) => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }
  process.exit(1);
});
