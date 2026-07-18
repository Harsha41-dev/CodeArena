#!/usr/bin/env python3
import sys

payload = sys.stdin.read()
_, rest = payload.split("\n---EXPECTED---\n", 1)
expected_text, actual_text = rest.split("\n---ACTUAL---\n", 1)

if sorted(expected_text.split()) != sorted(actual_text.split()):
    raise SystemExit("actual tokens differ from expected tokens")
