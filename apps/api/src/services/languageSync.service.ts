import type { LanguageService } from "./LanguageService";

// thin wrapper — admin routes call this for Judge0 language sync
export class LanguageSyncService {
  constructor(private readonly languageService: LanguageService) {}

  syncJudge0() {
    return this.languageService.syncJudge0();
  }
}
