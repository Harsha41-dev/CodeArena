import type { CodeLanguage, ProblemAssetType } from "../../types/api";

export const assetTypes: ProblemAssetType[] = ["GENERATOR", "REFERENCE_SOLUTION", "VALIDATOR", "CHECKER"];

export function assetLabel(type: ProblemAssetType): string {
  if (type === "REFERENCE_SOLUTION") {
    return "Reference";
  }
  return type.charAt(0) + type.slice(1).toLowerCase();
}

export function defaultAssetFilename(type: ProblemAssetType, language?: CodeLanguage): string {
  const extension = language?.fileExtension ?? "py";
  const base = type === "REFERENCE_SOLUTION" ? "reference" : type.toLowerCase();
  return `${base}.${extension}`;
}

export function defaultAssetSource(type: ProblemAssetType): string {
  if (type === "GENERATOR") {
    return `#!/usr/bin/env python3
import random
import sys

seed = int(sys.argv[1]) if len(sys.argv) > 1 else int(sys.stdin.read() or "1")
rng = random.Random(seed)
a = rng.randint(-1000000, 1000000)
b = rng.randint(-1000000, 1000000)
print(a, b)
`;
  }
  if (type === "REFERENCE_SOLUTION") {
    return `import sys

numbers = list(map(int, sys.stdin.read().split()))
print(sum(numbers))
`;
  }
  if (type === "VALIDATOR") {
    return `import sys

tokens = sys.stdin.read().split()
if len(tokens) != 2:
    raise SystemExit("expected exactly two integers")
for token in tokens:
    value = int(token)
    if value < -1000000 or value > 1000000:
        raise SystemExit("integer out of range")
`;
  }
  return `import sys

payload = sys.stdin.read()
input_part, rest = payload.split("\\n---EXPECTED---\\n", 1)
expected, actual = rest.split("\\n---ACTUAL---\\n", 1)

if sorted(expected.split()) != sorted(actual.split()):
    raise SystemExit("actual tokens differ from expected tokens")
`;
}
