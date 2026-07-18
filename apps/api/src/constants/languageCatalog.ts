import type { LanguageCategory } from "../types/domain";

export interface LanguageVersionSeed {
  version: string;
  label: string;
  judge0Id?: number | null;
  dockerImage?: string | null;
  compileCommand?: string | null;
  runCommand?: string | null;
  timeLimitMultiplier?: number;
  memoryLimitMultiplier?: number;
  sourceFileName: string;
  executableFileName?: string | null;
  starterTemplate: string;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface LanguageSeed {
  key: string;
  displayName: string;
  monacoId: string;
  fileExtension: string;
  category: LanguageCategory;
  isCompiled: boolean;
  sortOrder: number;
  versions: LanguageVersionSeed[];
}

const stdinStarter = (comment: string) => `${comment}\n`;

export const languageCatalog: LanguageSeed[] = [
  {
    key: "c",
    displayName: "C",
    monacoId: "c",
    fileExtension: "c",
    category: "SYSTEMS",
    isCompiled: true,
    sortOrder: 10,
    versions: [
      {
        version: "C11",
        label: "C 11",
        judge0Id: 50,
        dockerImage: "gcc:13",
        compileCommand: "gcc -std=c11 -O2 {source} -o {executable}",
        runCommand: "./{executable}",
        sourceFileName: "main.c",
        executableFileName: "main",
        starterTemplate: "#include <stdio.h>\n\nint main(void) {\n  return 0;\n}\n",
        isDefault: true
      }
    ]
  },
  {
    key: "cpp",
    displayName: "C++",
    monacoId: "cpp",
    fileExtension: "cpp",
    category: "SYSTEMS",
    isCompiled: true,
    sortOrder: 20,
    versions: [
      {
        version: "C++ 17",
        label: "C++ 17",
        judge0Id: 54,
        dockerImage: "gcc:13",
        compileCommand: "g++ -std=c++17 -O2 {source} -o {executable}",
        runCommand: "./{executable}",
        sourceFileName: "main.cpp",
        executableFileName: "main",
        starterTemplate:
          "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n  ios::sync_with_stdio(false);\n  cin.tie(nullptr);\n  return 0;\n}\n",
        isDefault: true
      },
      {
        version: "C++ 20",
        label: "C++ 20",
        dockerImage: "gcc:13",
        compileCommand: "g++ -std=c++20 -O2 {source} -o {executable}",
        runCommand: "./{executable}",
        sourceFileName: "main.cpp",
        executableFileName: "main",
        starterTemplate:
          "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n  ios::sync_with_stdio(false);\n  cin.tie(nullptr);\n  return 0;\n}\n"
      },
      {
        version: "C++ 23",
        label: "C++ 23",
        dockerImage: "gcc:14",
        compileCommand: "g++ -std=c++23 -O2 {source} -o {executable}",
        runCommand: "./{executable}",
        sourceFileName: "main.cpp",
        executableFileName: "main",
        starterTemplate:
          "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n  ios::sync_with_stdio(false);\n  cin.tie(nullptr);\n  return 0;\n}\n"
      }
    ]
  },
  {
    key: "java",
    displayName: "Java",
    monacoId: "java",
    fileExtension: "java",
    category: "JVM",
    isCompiled: true,
    sortOrder: 30,
    versions: [
      {
        version: "Java 17",
        label: "Java 17",
        judge0Id: 62,
        dockerImage: "eclipse-temurin:17",
        compileCommand: "javac {source}",
        runCommand: "java Main",
        sourceFileName: "Main.java",
        executableFileName: "Main.class",
        starterTemplate:
          "import java.io.*;\nimport java.util.*;\n\nclass Main {\n  public static void main(String[] args) throws Exception {\n  }\n}\n",
        isDefault: true
      },
      {
        version: "Java 21",
        label: "Java 21",
        dockerImage: "eclipse-temurin:21",
        compileCommand: "javac {source}",
        runCommand: "java Main",
        sourceFileName: "Main.java",
        executableFileName: "Main.class",
        starterTemplate:
          "import java.io.*;\nimport java.util.*;\n\nclass Main {\n  public static void main(String[] args) throws Exception {\n  }\n}\n"
      }
    ]
  },
  {
    key: "python",
    displayName: "Python",
    monacoId: "python",
    fileExtension: "py",
    category: "SCRIPTING",
    isCompiled: false,
    sortOrder: 40,
    versions: [
      {
        version: "Python 3",
        label: "Python 3",
        judge0Id: 71,
        dockerImage: "python:3.12-alpine",
        runCommand: "python {source}",
        sourceFileName: "main.py",
        starterTemplate:
          'import sys\n\ndef solve():\n    data = sys.stdin.read().strip().split()\n\nif __name__ == "__main__":\n    solve()\n',
        isDefault: true
      }
    ]
  },
  {
    key: "pypy",
    displayName: "PyPy",
    monacoId: "python",
    fileExtension: "py",
    category: "SCRIPTING",
    isCompiled: false,
    sortOrder: 45,
    versions: [
      {
        version: "PyPy 3",
        label: "PyPy 3",
        sourceFileName: "main.py",
        starterTemplate:
          'import sys\n\ndef solve():\n    data = sys.stdin.read().strip().split()\n\nif __name__ == "__main__":\n    solve()\n',
        isDefault: true
      }
    ]
  },
  {
    key: "javascript",
    displayName: "JavaScript",
    monacoId: "javascript",
    fileExtension: "js",
    category: "SCRIPTING",
    isCompiled: false,
    sortOrder: 50,
    versions: [
      {
        version: "Node.js 20",
        label: "JavaScript Node.js 20",
        judge0Id: 63,
        dockerImage: "node:20-alpine",
        runCommand: "node {source}",
        sourceFileName: "main.js",
        starterTemplate: "const fs = require('fs');\nconst input = fs.readFileSync(0, 'utf8').trim().split(/\\s+/);\n",
        isDefault: true
      }
    ]
  },
  {
    key: "typescript",
    displayName: "TypeScript",
    monacoId: "typescript",
    fileExtension: "ts",
    category: "SCRIPTING",
    isCompiled: true,
    sortOrder: 55,
    versions: [
      {
        version: "TypeScript 5",
        label: "TypeScript 5",
        sourceFileName: "main.ts",
        starterTemplate: "const fs = require('fs');\nconst input = fs.readFileSync(0, 'utf8').trim().split(/\\s+/);\n",
        isDefault: true
      }
    ]
  },
  {
    key: "kotlin",
    displayName: "Kotlin",
    monacoId: "kotlin",
    fileExtension: "kt",
    category: "JVM",
    isCompiled: true,
    sortOrder: 60,
    versions: [
      {
        version: "Kotlin 1.9",
        label: "Kotlin 1.9",
        sourceFileName: "Main.kt",
        starterTemplate: stdinStarter("fun main() { }"),
        isDefault: true
      }
    ]
  },
  {
    key: "go",
    displayName: "Go",
    monacoId: "go",
    fileExtension: "go",
    category: "GENERAL_PURPOSE",
    isCompiled: true,
    sortOrder: 70,
    versions: [
      {
        version: "Go 1.22",
        label: "Go 1.22",
        judge0Id: 60,
        dockerImage: "golang:1.22-alpine",
        runCommand: "go run {source}",
        sourceFileName: "main.go",
        starterTemplate: "package main\n\nfunc main() {\n}\n",
        isDefault: true
      }
    ]
  },
  {
    key: "rust",
    displayName: "Rust",
    monacoId: "rust",
    fileExtension: "rs",
    category: "SYSTEMS",
    isCompiled: true,
    sortOrder: 80,
    versions: [
      {
        version: "Rust 1.78",
        label: "Rust 1.78",
        judge0Id: 73,
        dockerImage: "rust:1.78",
        compileCommand: "rustc -O {source} -o {executable}",
        runCommand: "./{executable}",
        sourceFileName: "main.rs",
        executableFileName: "main",
        starterTemplate: "fn main() {\n}\n",
        isDefault: true
      }
    ]
  },
  {
    key: "csharp",
    displayName: "C#",
    monacoId: "csharp",
    fileExtension: "cs",
    category: "DOTNET",
    isCompiled: true,
    sortOrder: 90,
    versions: [
      {
        version: "C# 12",
        label: "C# 12",
        sourceFileName: "Program.cs",
        starterTemplate: "using System;\n\nclass Program {\n  static void Main() {\n  }\n}\n",
        isDefault: true
      }
    ]
  },
  ...[
    ["php", "PHP", "php", "php", "SCRIPTING", false, "PHP 8", "<?php\n"],
    ["ruby", "Ruby", "ruby", "rb", "SCRIPTING", false, "Ruby 3", ""],
    ["swift", "Swift", "swift", "swift", "GENERAL_PURPOSE", true, "Swift 5", "import Foundation\n"],
    ["scala", "Scala", "scala", "scala", "JVM", true, "Scala 3", "object Main extends App {\n}\n"],
    ["dart", "Dart", "dart", "dart", "GENERAL_PURPOSE", true, "Dart 3", "void main() {\n}\n"],
    ["perl", "Perl", "perl", "pl", "SCRIPTING", false, "Perl 5", "use strict;\nuse warnings;\n"],
    ["bash", "Bash", "shell", "sh", "SHELL", false, "Bash 5", "#!/usr/bin/env bash\n"],
    ["sql", "SQL", "sql", "sql", "DATABASE", false, "SQL", "-- Write SQL here\n"],
    ["lua", "Lua", "lua", "lua", "SCRIPTING", false, "Lua 5", ""],
    ["r", "R", "r", "r", "SCRIPTING", false, "R 4", ""],
    ["haskell", "Haskell", "haskell", "hs", "FUNCTIONAL", true, "GHC", "main :: IO ()\nmain = return ()\n"],
    ["ocaml", "OCaml", "ocaml", "ml", "FUNCTIONAL", true, "OCaml 5", ""],
    ["fsharp", "F#", "fsharp", "fs", "DOTNET", true, "F# 8", ""],
    ["elixir", "Elixir", "elixir", "exs", "FUNCTIONAL", false, "Elixir 1", ""],
    ["erlang", "Erlang", "erlang", "erl", "FUNCTIONAL", true, "Erlang OTP", ""],
    ["clojure", "Clojure", "clojure", "clj", "JVM", false, "Clojure 1", ""],
    ["julia", "Julia", "julia", "jl", "GENERAL_PURPOSE", false, "Julia 1", ""],
    ["zig", "Zig", "zig", "zig", "SYSTEMS", true, "Zig 0.13", "pub fn main() void {\n}\n"],
    ["nim", "Nim", "nim", "nim", "SYSTEMS", true, "Nim 2", ""],
    ["d", "D", "d", "d", "SYSTEMS", true, "D 2", ""],
    ["crystal", "Crystal", "ruby", "cr", "GENERAL_PURPOSE", true, "Crystal 1", ""]
  ].map(([key, displayName, monacoId, fileExtension, category, isCompiled, version, starter], index) => ({
    key: key as string,
    displayName: displayName as string,
    monacoId: monacoId as string,
    fileExtension: fileExtension as string,
    category: category as LanguageCategory,
    isCompiled: Boolean(isCompiled),
    sortOrder: 100 + index * 10,
    versions: [
      {
        version: version as string,
        label: version as string,
        sourceFileName: `main.${fileExtension}`,
        starterTemplate: starter as string,
        isDefault: true
      }
    ]
  }))
];

export const legacyLanguageKeyMap: Record<string, { key: string; version?: string }> = {
  CPP: { key: "cpp", version: "C++ 17" },
  JAVA: { key: "java", version: "Java 17" },
  PYTHON: { key: "python", version: "Python 3" },
  JAVASCRIPT: { key: "javascript", version: "Node.js 20" }
};

export const defaultLegacyStarterCode = {
  CPP: languageCatalog.find((language) => language.key === "cpp")?.versions[0]?.starterTemplate ?? "",
  JAVA: languageCatalog.find((language) => language.key === "java")?.versions[0]?.starterTemplate ?? "",
  PYTHON: languageCatalog.find((language) => language.key === "python")?.versions[0]?.starterTemplate ?? "",
  JAVASCRIPT: languageCatalog.find((language) => language.key === "javascript")?.versions[0]?.starterTemplate ?? ""
};
