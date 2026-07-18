#!/usr/bin/env python3
"""Input validator for the two-integer sum example."""

import sys


def main() -> None:
    tokens = sys.stdin.read().strip().split()
    if len(tokens) != 2:
        raise SystemExit("expected exactly two integers")
    try:
        a, b = map(int, tokens)
    except ValueError as exc:
        raise SystemExit("input must be integer tokens") from exc
    if not (-10**6 <= a <= 10**6 and -10**6 <= b <= 10**6):
        raise SystemExit("integer out of allowed range")


if __name__ == "__main__":
    main()
