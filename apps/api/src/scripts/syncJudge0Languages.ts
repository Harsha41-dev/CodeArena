import { PrismaLanguageRepository } from "../repositories/LanguageRepository";
import { PrismaRepository } from "../repositories/PrismaRepository";
import { LanguageService } from "../services/LanguageService";

// CLI: npm run languages:sync:judge0
async function main(): Promise<void> {
  const languageRepo = new PrismaLanguageRepository();
  const appRepo = new PrismaRepository();
  const service = new LanguageService(languageRepo, appRepo);

  const result = await service.syncJudge0();
  console.log(
    `Judge0 language sync complete: created=${result.created}, updated=${result.updated}, skipped=${result.skipped}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
