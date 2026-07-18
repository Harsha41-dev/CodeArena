import type { Difficulty, StarterCode } from "../types/domain";

export interface ProblemFixture {
  slug: string;
  title: string;
  difficulty: Difficulty;
  tags: string[];
  description: string;
  constraints: string;
  inputFormat: string;
  outputFormat: string;
  starterCode: StarterCode;
  editorial: string;
  sampleCases: Array<{ input: string; expectedOutput: string; explanation?: string }>;
  hiddenCases: Array<{ input: string; expectedOutput: string }>;
}

const starterCode: StarterCode = {
  CPP: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n  // read input and print answer\n  return 0;\n}\n",
  JAVA: "import java.io.*;\nimport java.util.*;\n\nclass Main {\n  public static void main(String[] args) throws Exception {\n    // read input and print answer\n  }\n}\n",
  PYTHON:
    'import sys\n\ndef solve():\n    data = sys.stdin.read().strip().split()\n    # compute answer\n\nif __name__ == "__main__":\n    solve()\n',
  JAVASCRIPT:
    "const fs = require('fs');\nconst input = fs.readFileSync(0, 'utf8').trim().split(/\\s+/);\n// compute answer\n"
};

export const problemFixtures: ProblemFixture[] = [
  {
    slug: "two-sum",
    title: "Two Sum",
    difficulty: "EASY",
    tags: ["Array", "Hash Table"],
    description:
      "Given an array of integers and a target, return the indices of two numbers that add up to the target.",
    constraints: "2 <= n <= 10^5. Exactly one valid answer exists.",
    inputFormat: "First line contains n. Second line contains n integers. Third line contains target.",
    outputFormat: "Print two zero-based indices separated by a space.",
    starterCode,
    editorial: "Use a hash map from value to index. For each value x, check whether target - x was seen earlier.",
    sampleCases: [{ input: "4\n2 7 11 15\n9", expectedOutput: "0 1", explanation: "2 + 7 = 9." }],
    hiddenCases: [
      { input: "3\n3 2 4\n6", expectedOutput: "1 2" },
      { input: "2\n3 3\n6", expectedOutput: "0 1" }
    ]
  },
  {
    slug: "reverse-string",
    title: "Reverse String",
    difficulty: "EASY",
    tags: ["String", "Two Pointers"],
    description: "Reverse the given string.",
    constraints: "1 <= length <= 10^5.",
    inputFormat: "A single string without spaces.",
    outputFormat: "The reversed string.",
    starterCode,
    editorial: "Swap characters from both ends moving toward the center.",
    sampleCases: [{ input: "hello", expectedOutput: "olleh" }],
    hiddenCases: [
      { input: "codearena", expectedOutput: "aneraedoc" },
      { input: "a", expectedOutput: "a" }
    ]
  },
  {
    slug: "valid-parentheses",
    title: "Valid Parentheses",
    difficulty: "EASY",
    tags: ["String", "Stack"],
    description: "Determine whether a string containing brackets is balanced.",
    constraints: "1 <= length <= 10^5.",
    inputFormat: "One string containing only bracket characters.",
    outputFormat: "Print true or false.",
    starterCode,
    editorial: "Push opening brackets on a stack and match closing brackets against the top.",
    sampleCases: [{ input: "()[]{}", expectedOutput: "true" }],
    hiddenCases: [
      { input: "(]", expectedOutput: "false" },
      { input: "([{}])", expectedOutput: "true" }
    ]
  },
  {
    slug: "binary-search",
    title: "Binary Search",
    difficulty: "EASY",
    tags: ["Array", "Binary Search"],
    description: "Find the index of a target in a sorted array, or -1 if it does not exist.",
    constraints: "1 <= n <= 10^5.",
    inputFormat: "First line n. Second line sorted integers. Third line target.",
    outputFormat: "Print the zero-based index or -1.",
    starterCode,
    editorial: "Maintain low and high bounds and discard half the range each step.",
    sampleCases: [{ input: "6\n-1 0 3 5 9 12\n9", expectedOutput: "4" }],
    hiddenCases: [
      { input: "6\n-1 0 3 5 9 12\n2", expectedOutput: "-1" },
      { input: "1\n5\n5", expectedOutput: "0" }
    ]
  },
  {
    slug: "merge-two-sorted-lists",
    title: "Merge Two Sorted Lists",
    difficulty: "EASY",
    tags: ["Linked List", "Recursion"],
    description: "Merge two sorted integer sequences into one sorted sequence.",
    constraints: "0 <= n, m <= 10^4.",
    inputFormat: "Line 1 n, line 2 n integers, line 3 m, line 4 m integers.",
    outputFormat: "Print the merged sequence.",
    starterCode,
    editorial: "Use two pointers and append the smaller current value.",
    sampleCases: [{ input: "3\n1 2 4\n3\n1 3 4", expectedOutput: "1 1 2 3 4 4" }],
    hiddenCases: [
      { input: "0\n\n2\n0 1", expectedOutput: "0 1" },
      { input: "2\n2 5\n3\n1 3 4", expectedOutput: "1 2 3 4 5" }
    ]
  },
  {
    slug: "maximum-subarray",
    title: "Maximum Subarray",
    difficulty: "MEDIUM",
    tags: ["Array", "Dynamic Programming"],
    description: "Find the maximum sum of a non-empty contiguous subarray.",
    constraints: "1 <= n <= 10^5.",
    inputFormat: "First line n. Second line n integers.",
    outputFormat: "Print the maximum subarray sum.",
    starterCode,
    editorial: "Kadane's algorithm keeps the best subarray ending at the current index and the global best.",
    sampleCases: [{ input: "9\n-2 1 -3 4 -1 2 1 -5 4", expectedOutput: "6" }],
    hiddenCases: [
      { input: "1\n1", expectedOutput: "1" },
      { input: "5\n5 4 -1 7 8", expectedOutput: "23" }
    ]
  },
  {
    slug: "climbing-stairs",
    title: "Climbing Stairs",
    difficulty: "EASY",
    tags: ["Dynamic Programming", "Math"],
    description: "Count how many distinct ways exist to climb n stairs taking 1 or 2 steps.",
    constraints: "1 <= n <= 45.",
    inputFormat: "A single integer n.",
    outputFormat: "Print the number of ways.",
    starterCode,
    editorial: "The recurrence is f(n) = f(n - 1) + f(n - 2).",
    sampleCases: [{ input: "3", expectedOutput: "3" }],
    hiddenCases: [
      { input: "2", expectedOutput: "2" },
      { input: "5", expectedOutput: "8" }
    ]
  },
  {
    slug: "longest-substring-without-repeating-characters",
    title: "Longest Substring Without Repeating Characters",
    difficulty: "MEDIUM",
    tags: ["String", "Sliding Window", "Hash Table"],
    description: "Return the length of the longest substring without repeating characters.",
    constraints: "0 <= length <= 5 * 10^4.",
    inputFormat: "A single string.",
    outputFormat: "Print the maximum length.",
    starterCode,
    editorial: "Use a sliding window and last-seen positions to move the left pointer.",
    sampleCases: [{ input: "abcabcbb", expectedOutput: "3" }],
    hiddenCases: [
      { input: "bbbbb", expectedOutput: "1" },
      { input: "pwwkew", expectedOutput: "3" }
    ]
  },
  {
    slug: "coin-change",
    title: "Coin Change",
    difficulty: "MEDIUM",
    tags: ["Dynamic Programming", "BFS"],
    description: "Given coin denominations and an amount, compute the minimum number of coins needed.",
    constraints: "1 <= coins.length <= 12, 0 <= amount <= 10^4.",
    inputFormat: "Line 1 n. Line 2 coin values. Line 3 amount.",
    outputFormat: "Print minimum coins or -1.",
    starterCode,
    editorial: "Use one-dimensional DP where dp[x] is the minimum coins needed for amount x.",
    sampleCases: [{ input: "3\n1 2 5\n11", expectedOutput: "3" }],
    hiddenCases: [
      { input: "1\n2\n3", expectedOutput: "-1" },
      { input: "3\n1 3 4\n6", expectedOutput: "2" }
    ]
  },
  {
    slug: "number-of-islands",
    title: "Number of Islands",
    difficulty: "MEDIUM",
    tags: ["Graph", "DFS", "BFS", "Matrix"],
    description: "Count connected components of 1s in a grid using four-directional adjacency.",
    constraints: "1 <= rows, cols <= 300.",
    inputFormat: "Line 1 rows cols, followed by rows strings of 0 and 1.",
    outputFormat: "Print the island count.",
    starterCode,
    editorial: "Run DFS or BFS from each unvisited land cell and mark the full island.",
    sampleCases: [{ input: "4 5\n11110\n11010\n11000\n00000", expectedOutput: "1" }],
    hiddenCases: [
      { input: "4 5\n11000\n11000\n00100\n00011", expectedOutput: "3" },
      { input: "2 2\n00\n00", expectedOutput: "0" }
    ]
  },
  {
    slug: "course-schedule",
    title: "Course Schedule",
    difficulty: "MEDIUM",
    tags: ["Graph", "Topological Sort"],
    description: "Given prerequisites, determine whether all courses can be completed.",
    constraints: "1 <= numCourses <= 2000.",
    inputFormat: "Line 1 courses edges. Next edges lines contain course prerequisite.",
    outputFormat: "Print true if possible, otherwise false.",
    starterCode,
    editorial: "Detect cycles with Kahn's algorithm or DFS colors.",
    sampleCases: [{ input: "2 1\n1 0", expectedOutput: "true" }],
    hiddenCases: [
      { input: "2 2\n1 0\n0 1", expectedOutput: "false" },
      { input: "4 3\n1 0\n2 1\n3 2", expectedOutput: "true" }
    ]
  },
  {
    slug: "lru-cache",
    title: "LRU Cache",
    difficulty: "MEDIUM",
    tags: ["Hash Table", "Linked List", "Design"],
    description: "Simulate an LRU cache with get and put operations.",
    constraints: "1 <= capacity <= 3000.",
    inputFormat: "Line 1 capacity operations. Each following line is get key or put key value.",
    outputFormat: "Print outputs of get operations separated by spaces.",
    starterCode,
    editorial: "Combine a hash map with a doubly linked list to move recently used keys to the front.",
    sampleCases: [{ input: "2 7\nput 1 1\nput 2 2\nget 1\nput 3 3\nget 2\nput 4 4\nget 1", expectedOutput: "1 -1 -1" }],
    hiddenCases: [
      { input: "2 4\nput 2 1\nput 2 2\nget 2\nget 3", expectedOutput: "2 -1" },
      { input: "1 3\nput 1 1\nput 2 2\nget 1", expectedOutput: "-1" },
      { input: "2 6\nput 1 1\nput 2 2\nget 1\nput 3 3\nget 1\nget 2", expectedOutput: "1 1 -1" }
    ]
  },
  {
    slug: "word-break",
    title: "Word Break",
    difficulty: "MEDIUM",
    tags: ["Dynamic Programming", "Trie", "String"],
    description: "Determine whether a string can be segmented into words from a dictionary.",
    constraints: "1 <= s.length <= 300.",
    inputFormat: "Line 1 string. Line 2 dictionary size. Line 3 dictionary words.",
    outputFormat: "Print true or false.",
    starterCode,
    editorial: "Use DP where dp[i] is true when s[0..i) can be segmented.",
    sampleCases: [{ input: "leetcode\n2\nleet code", expectedOutput: "true" }],
    hiddenCases: [
      { input: "applepenapple\n2\napple pen", expectedOutput: "true" },
      { input: "catsandog\n5\ncats dog sand and cat", expectedOutput: "false" }
    ]
  },
  {
    slug: "median-of-two-sorted-arrays",
    title: "Median of Two Sorted Arrays",
    difficulty: "HARD",
    tags: ["Array", "Binary Search", "Divide and Conquer"],
    description: "Find the median of two sorted arrays.",
    constraints: "0 <= n, m <= 1000 and n + m > 0.",
    inputFormat: "Line 1 n and n integers, line 2 m and m integers.",
    outputFormat: "Print median. Use .5 when needed.",
    starterCode,
    editorial: "Binary search the smaller array partition so left side values are <= right side values.",
    sampleCases: [{ input: "2 1 3\n1 2", expectedOutput: "2" }],
    hiddenCases: [
      { input: "2 1 2\n2 3 4", expectedOutput: "2.5" },
      { input: "0\n1 1", expectedOutput: "1" }
    ]
  },
  {
    slug: "n-queens",
    title: "N Queens",
    difficulty: "HARD",
    tags: ["Backtracking"],
    description: "Return the number of distinct solutions to the n-queens puzzle.",
    constraints: "1 <= n <= 12.",
    inputFormat: "A single integer n.",
    outputFormat: "Print the count of valid boards.",
    starterCode,
    editorial: "Backtrack row by row while tracking occupied columns and diagonals.",
    sampleCases: [{ input: "4", expectedOutput: "2" }],
    hiddenCases: [
      { input: "1", expectedOutput: "1" },
      { input: "5", expectedOutput: "10" }
    ]
  }
];

export function allFixtureTags(): string[] {
  return [...new Set(problemFixtures.flatMap((problem) => problem.tags))].sort();
}
