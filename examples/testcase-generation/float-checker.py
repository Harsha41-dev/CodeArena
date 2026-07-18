#!/usr/bin/env python3
import math
import sys

payload = sys.stdin.read()
_, rest = payload.split("\n---EXPECTED---\n", 1)
expected_text, actual_text = rest.split("\n---ACTUAL---\n", 1)

expected = float(expected_text.strip())
actual = float(actual_text.strip())

if not math.isfinite(actual) or abs(expected - actual) > 1e-6:
    raise SystemExit("actual value is outside tolerance")
