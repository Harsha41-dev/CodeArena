import { Badge } from "./Badge";
import type { Difficulty } from "../types/api";
import { difficultyClass } from "../lib/status";

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const className = difficultyClass(difficulty);
  return <Badge className={className}>{difficulty}</Badge>;
}
