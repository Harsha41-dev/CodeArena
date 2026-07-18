// show a warning banner when the judge is running in mock mode
export function shouldShowMockJudgeWarning(executorMode?: string | null): boolean {
  if (executorMode === "mock") {
    return true;
  }
  return false;
}
