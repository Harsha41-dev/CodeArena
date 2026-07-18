import assert from "node:assert/strict";
import { shouldShowMockJudgeWarning } from "./executorUi";

assert.equal(shouldShowMockJudgeWarning("mock"), true);
assert.equal(shouldShowMockJudgeWarning("judge0"), false);
assert.equal(shouldShowMockJudgeWarning("docker"), false);
assert.equal(shouldShowMockJudgeWarning(undefined), false);

console.log("executor UI helper tests passed");
