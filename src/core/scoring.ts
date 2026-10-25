import { PointsConfig } from './models/Level';

/** Pontuação base + bônus por segundo restante - penalidade por dica, nunca negativa. */
export function calculateScore(points: PointsConfig, timeRemaining: number, hintsUsed: number): number {
  const score = points.base + timeRemaining * points.timeBonus - hintsUsed * points.hintPenalty;
  return Math.max(0, score);
}

/** Estrelas (1 a 3): perde uma ao usar dica, outra com 3+ dicas e outra se sobrou menos de 25% do tempo. */
export function calculateStars(timeRemaining: number, timeLimit: number, hintsUsed: number): number {
  let stars = 3;
  if (hintsUsed >= 1) stars--;
  if (hintsUsed >= 3) stars--;
  if (timeRemaining < timeLimit * 0.25) stars--;
  return Math.max(1, stars);
}
