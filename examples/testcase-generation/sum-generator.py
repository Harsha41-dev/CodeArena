#!/usr/bin/env python3
"""Deterministic generator for a two-integer sum problem.

The first CLI argument is the seed. The same seed always emits the same input,
which makes generated batches reproducible and easy to audit.
"""

import random
import sys


def main() -> None:
    seed = int(sys.argv[1]) if len(sys.argv) > 1 else int(sys.stdin.read() or "1")
    rng = random.Random(seed)
    a = rng.randint(-10**6, 10**6)
    b = rng.randint(-10**6, 10**6)
    print(a, b)


if __name__ == "__main__":
    main()
