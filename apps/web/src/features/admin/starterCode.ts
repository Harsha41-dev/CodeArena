import type { CodeLanguage, LegacyLanguage, StarterCode } from "../../types/api";

export const defaultStarterCode: StarterCode = {
  CPP: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n  ios::sync_with_stdio(false);\n  cin.tie(nullptr);\n  return 0;\n}\n",
  JAVA: "import java.io.*;\nimport java.util.*;\n\nclass Main {\n  public static void main(String[] args) throws Exception {\n  }\n}\n",
  PYTHON:
    'import sys\n\ndef solve():\n    data = sys.stdin.read().strip().split()\n\nif __name__ == "__main__":\n    solve()\n',
  JAVASCRIPT: "const fs = require('fs');\nconst input = fs.readFileSync(0, 'utf8').trim().split(/\\s+/);\n"
};

export function defaultVersion(language?: CodeLanguage) {
  if (!language) {
    return undefined;
  }
  const defaultActive = language.versions.find((version) => version.isDefault && version.isActive);
  if (defaultActive) {
    return defaultActive;
  }
  const firstActive = language.versions.find((version) => version.isActive);
  if (firstActive) {
    return firstActive;
  }
  return language.versions[0];
}

export function starterStateKey(language: CodeLanguage): string {
  const version = defaultVersion(language);
  if (version) {
    return version.id;
  }
  return language.id;
}

export function legacyKeyForLanguage(key: string): LegacyLanguage | null {
  switch (key) {
    case "cpp":
      return "CPP";
    case "java":
      return "JAVA";
    case "python":
      return "PYTHON";
    case "javascript":
      return "JAVASCRIPT";
    default:
      return null;
  }
}

export function getStarterCode(
  language: CodeLanguage,
  legacyStarterCode: StarterCode,
  dynamicStarterCode: Record<string, string>
): string {
  const legacyKey = legacyKeyForLanguage(language.key);
  if (legacyKey) {
    return legacyStarterCode[legacyKey];
  }
  const key = starterStateKey(language);
  if (dynamicStarterCode[key]) {
    return dynamicStarterCode[key];
  }
  const version = defaultVersion(language);
  if (version?.starterTemplate) {
    return version.starterTemplate;
  }
  return "";
}

export function activeStarterLanguages(languages: CodeLanguage[]): CodeLanguage[] {
  return languages.filter((language) => {
    if (!language.isActive) {
      return false;
    }
    return language.versions.some((version) => version.isActive);
  });
}
