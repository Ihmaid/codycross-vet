import { PointsConfig } from './models/Level';

/** Pontuação base + bônus por segundo restante - penalidade por dica, nunca negativa. */
export function calculateScore(points: PointsConfig, timeRemaining: number, hintsUsed: number): number {
  const score = points.base + timeRemaining * points.timeBonus - hintsUsed * points.hintPenalty;
  return Math.max(0, score);
}
