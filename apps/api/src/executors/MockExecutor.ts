import type { Executor, ExecutionRequest, ExecutionResult } from "./Executor";

export class MockExecutor implements Executor {
  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    // uppercase so marker checks are case-insensitive
    const source = request.sourceCode.toUpperCase();

    // compile error markers
    if (source.includes("__CE__") || source.includes("COMPILE_ERROR")) {
      return {
        status: "COMPILATION_ERROR",
        stdout: "",
        stderr: "Mock compilation failed",
        compileOutput: "Mock compilation failed",
        runtimeMs: 0,
        memoryKb: 0
      };
    }

    // time limit
    if (source.includes("__TLE__")) {
      return {
        status: "TIME_LIMIT_EXCEEDED",
        stdout: "",
        stderr: "Mock time limit exceeded",
        runtimeMs: request.timeLimitMs + 1,
        memoryKb: 1024
      };
    }

    // runtime error
    if (source.includes("__RE__") || source.includes("RUNTIME_ERROR")) {
      return {
        status: "RUNTIME_ERROR",
        stdout: "",
        stderr: "Mock runtime error",
        runtimeMs: 10,
        memoryKb: 1024
      };
    }

    // memory limit
    if (source.includes("__MLE__")) {
      return {
        status: "MEMORY_LIMIT_EXCEEDED",
        stdout: "",
        stderr: "Mock memory limit exceeded",
        runtimeMs: 10,
        memoryKb: request.memoryLimitMb * 1024 + 1
      };
    }

    // generator that fails on seed >= 2 (for testing retries / error paths)
    if (source.includes("MOCK_FAIL_ON_SEED_2_GENERATOR")) {
      let seedRaw: string | number = 0;
      if (request.args?.[0] != null) {
        seedRaw = request.args[0];
      } else if (request.stdin.trim()) {
        seedRaw = request.stdin.trim();
      }
      const seed = Number(seedRaw);

      if (seed >= 2) {
        return {
          status: "RUNTIME_ERROR",
          stdout: "",
          stderr: "Mock generator failed",
          runtimeMs: 4,
          memoryKb: 1024
        };
      }

      return {
        status: "ACCEPTED",
        stdout: `${seed}\n${seed + 1}\n`,
        runtimeMs: 4,
        memoryKb: 1024
      };
    }

    // basic mock generator: prints seed and seed+1
    if (source.includes("MOCK_GENERATOR")) {
      let seedRaw: string | number = 0;
      if (request.args?.[0] != null) {
        seedRaw = request.args[0];
      } else if (request.stdin.trim()) {
        seedRaw = request.stdin.trim();
      }
      const seed = Number(seedRaw);

      return {
        status: "ACCEPTED",
        stdout: `${seed}\n${seed + 1}\n`,
        runtimeMs: 4,
        memoryKb: 1024
      };
    }

    // always same output - good for duplicate tests
    if (source.includes("MOCK_DUPLICATE_GENERATOR")) {
      return {
        status: "ACCEPTED",
        stdout: "1\n2\n",
        runtimeMs: 4,
        memoryKb: 1024
      };
    }

    // validator mock - rejects if input has INVALID
    if (source.includes("MOCK_VALIDATOR")) {
      const hasInvalid = request.stdin.includes("INVALID");
      if (hasInvalid) {
        return {
          status: "WRONG_ANSWER",
          stdout: "",
          stderr: "Invalid generated input",
          runtimeMs: 4,
          memoryKb: 1024
        };
      }
      return {
        status: "ACCEPTED",
        stdout: "",
        stderr: undefined,
        runtimeMs: 4,
        memoryKb: 1024
      };
    }

    // checker that always accepts
    if (source.includes("MOCK_CHECKER_ALWAYS_ACCEPT")) {
      return {
        status: "ACCEPTED",
        stdout: "accepted",
        runtimeMs: 3,
        memoryKb: 512
      };
    }

    // checker that always rejects
    if (source.includes("MOCK_CHECKER_ALWAYS_REJECT")) {
      return {
        status: "WRONG_ANSWER",
        stdout: "",
        stderr: "checker rejected output",
        runtimeMs: 3,
        memoryKb: 512
      };
    }

    // multiset / any-order checker
    if (source.includes("MOCK_CHECKER_ANY_ORDER")) {
      const payload = parseCheckerPayload(request.stdin);

      const expectedTokens = payload.expectedOutput.split(/\s+/).filter(Boolean);
      const actualTokens = payload.actualOutput.split(/\s+/).filter(Boolean);
      const accepted = sameMultiset(expectedTokens, actualTokens);

      if (accepted) {
        return {
          status: "ACCEPTED",
          stdout: "accepted",
          stderr: undefined,
          runtimeMs: 3,
          memoryKb: 512
        };
      }

      return {
        status: "WRONG_ANSWER",
        stdout: "",
        stderr: "actual tokens differ from expected tokens",
        runtimeMs: 3,
        memoryKb: 512
      };
    }

    // float compare with 1e-6 tolerance
    if (source.includes("MOCK_CHECKER_FLOAT")) {
      const payload = parseCheckerPayload(request.stdin);
      const expected = Number(payload.expectedOutput.trim());
      const actual = Number(payload.actualOutput.trim());

      let accepted = false;
      if (Number.isFinite(expected) && Number.isFinite(actual)) {
        const diff = Math.abs(expected - actual);
        if (diff <= 1e-6) {
          accepted = true;
        }
      }

      if (accepted) {
        return {
          status: "ACCEPTED",
          stdout: "accepted",
          stderr: undefined,
          runtimeMs: 3,
          memoryKb: 512
        };
      }

      return {
        status: "WRONG_ANSWER",
        stdout: "",
        stderr: "actual value is outside tolerance",
        runtimeMs: 3,
        memoryKb: 512
      };
    }

    // reference solution - just sums all numbers in stdin
    if (source.includes("MOCK_REFERENCE")) {
      const trimmed = request.stdin.trim();
      const parts = trimmed.split(/\s+/);
      const numbers: number[] = [];
      for (let i = 0; i < parts.length; i += 1) {
        if (parts[i]) {
          numbers.push(Number(parts[i]));
        }
      }

      let sum = 0;
      for (let i = 0; i < numbers.length; i += 1) {
        sum = sum + numbers[i];
      }

      return {
        status: "ACCEPTED",
        stdout: `${sum}\n`,
        runtimeMs: 8,
        memoryKb: 2048
      };
    }

    // explicit stdout marker: MOCK_STDOUT:whatever
    const stdoutMatch = request.sourceCode.match(/MOCK_STDOUT:([\s\S]*)/i);
    if (stdoutMatch) {
      let out = stdoutMatch[1].trim();
      // turn \n into real newlines
      out = out.replace(/\\n/g, "\n");
      return {
        status: "ACCEPTED",
        stdout: out,
        runtimeMs: 12,
        memoryKb: 4096
      };
    }

    // fixture-based output (e.g. two-sum)
    if (source.includes("MOCK_FIXTURE_OUTPUT")) {
      const fixtureOut = explicitFixtureOutput(request.problemSlug, request.stdin);
      return {
        status: "ACCEPTED",
        stdout: fixtureOut,
        runtimeMs: 12,
        memoryKb: 4096
      };
    }

    // WA marker - program "runs" but prints wrong answer
    if (source.includes("__WA__") || source.includes("WRONG_ANSWER")) {
      return {
        status: "ACCEPTED",
        stdout: "wrong answer",
        runtimeMs: 12,
        memoryKb: 4096
      };
    }

    // default: try to scrape print statements from the source
    const literalStdout = parseLiteralStdout(request.sourceCode);
    return {
      status: "ACCEPTED",
      stdout: literalStdout,
      runtimeMs: 12,
      memoryKb: 4096
    };
  }
}

// hard-coded solutions for known fixture problems
function explicitFixtureOutput(problemSlug: string, stdin: string): string {
  if (problemSlug === "two-sum") {
    const tokens = stdin.trim().split(/\s+/).map(Number);
    const n = tokens[0] ?? 0;
    const values = tokens.slice(1, 1 + n);
    const target = tokens[1 + n];

    // classic two-sum with a map
    const seen = new Map<number, number>();
    for (let index = 0; index < values.length; index += 1) {
      const complement = target - values[index];
      const previous = seen.get(complement);
      if (previous !== undefined) {
        return `${previous} ${index}`;
      }
      seen.set(values[index], index);
    }
  }

  // unknown problem - empty output
  return "";
}

// pull string literals out of common print calls
function parseLiteralStdout(sourceCode: string): string {
  const fragments: string[] = [];

  const patterns = [
    /\bprintf\s*\(\s*"((?:\\.|[^"\\])*)"\s*\)/g,
    /\bprint\s*\(\s*["']((?:\\.|[^"'\\])*)["']\s*\)/g,
    /\bconsole\.log\s*\(\s*["']((?:\\.|[^"'\\])*)["']\s*\)/g,
    /\bSystem\.out\.println\s*\(\s*"((?:\\.|[^"\\])*)"\s*\)/g,
    /\bSystem\.out\.print\s*\(\s*"((?:\\.|[^"\\])*)"\s*\)/g
  ];

  for (let p = 0; p < patterns.length; p += 1) {
    const pattern = patterns[p];
    const matches = sourceCode.matchAll(pattern);
    for (const match of matches) {
      const literal = match[1];
      fragments.push(unescapeLiteral(literal));
    }
  }

  return fragments.join("");
}

// convert escape sequences back to real chars
function unescapeLiteral(value: string): string {
  let result = value;
  result = result.replace(/\\n/g, "\n");
  result = result.replace(/\\r/g, "\r");
  result = result.replace(/\\t/g, "\t");
  result = result.replace(/\\"/g, '"');
  result = result.replace(/\\'/g, "'");
  result = result.replace(/\\\\/g, "\\");
  return result;
}

// checker stdin format: input\n---EXPECTED---\nexpected\n---ACTUAL---\nactual
function parseCheckerPayload(stdin: string): {
  input: string;
  expectedOutput: string;
  actualOutput: string;
} {
  const expectedMarker = "\n---EXPECTED---\n";
  const actualMarker = "\n---ACTUAL---\n";

  const expectedMarkerIndex = stdin.indexOf(expectedMarker);
  if (expectedMarkerIndex < 0) {
    return {
      input: stdin,
      expectedOutput: "",
      actualOutput: ""
    };
  }

  const afterExpected = expectedMarkerIndex + expectedMarker.length;
  const actualMarkerIndex = stdin.indexOf(actualMarker, afterExpected);

  if (actualMarkerIndex < 0) {
    return {
      input: stdin.slice(0, expectedMarkerIndex),
      expectedOutput: stdin.slice(afterExpected),
      actualOutput: ""
    };
  }

  return {
    input: stdin.slice(0, expectedMarkerIndex),
    expectedOutput: stdin.slice(afterExpected, actualMarkerIndex),
    actualOutput: stdin.slice(actualMarkerIndex + actualMarker.length)
  };
}

// check if two arrays have the same elements (order doesn't matter)
function sameMultiset(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const counts = new Map<string, number>();

  // count left side
  for (let i = 0; i < left.length; i += 1) {
    const value = left[i];
    const current = counts.get(value) ?? 0;
    counts.set(value, current + 1);
  }

  // subtract right side
  for (let i = 0; i < right.length; i += 1) {
    const value = right[i];
    const current = counts.get(value) ?? 0;
    const next = current - 1;
    if (next < 0) {
      return false;
    }
    if (next === 0) {
      counts.delete(value);
    } else {
      counts.set(value, next);
    }
  }

  return counts.size === 0;
}
