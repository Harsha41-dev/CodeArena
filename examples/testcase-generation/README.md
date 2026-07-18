# Test-Case Generation Examples

Example scripts for the test-case generation flow:

- `sum-generator.py` receives a seed and prints deterministic input.
- `sum-solution.cpp` is the trusted reference solution used to produce expected output.
- `sum-validator.py` rejects malformed generated input before it becomes a saved test case.
- `any-order-checker.py` accepts outputs with the same tokens in any order.
- `float-checker.py` accepts floating-point answers within `1e-6`.

Custom checkers receive stdin in this format:

```text
[input]
---EXPECTED---
[expectedOutput]
---ACTUAL---
[actualOutput]
```

Exit code `0` means accepted. Any rejected, timed-out, crashed, or unavailable checker never accepts a submission.

Upload these through the admin dashboard or the admin test-generation APIs. In production, run generation assets through the configured executor profile, not inside the API process.
