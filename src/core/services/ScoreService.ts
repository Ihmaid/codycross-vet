import { Level, PointsConfig } from '../models/Level';

export class ScoreService {
  private readonly SCORE_KEY = 'totalScore';
  
  /**
   * Calcula a pontuação para um nível completado
   * @param level Nível completado
   * @param timeRemaining Tempo restante em segundos
   * @param hintsUsed Número de dicas utilizadas
   * @returns Pontuação total para o nível
   */
  public calculateLevelScore(level: Level, timeRemaining: number, hintsUsed: number): number {
    const { base, timeBonus, hintPenalty } = level.points;
    
    // Pontuação base + bônus de tempo - penalidade por dicas
    let score = base + (timeRemaining * timeBonus) - (hintsUsed * hintPenalty);
    
    // Garantir que a pontuação não seja negativa
    return Math.max(0, score);
  }
  
  /**
   * Salva a pontuação total no localStorage
   * @param score Pontuação total
   */
  public saveTotalScore(score: number): void {
    try {
      localStorage.setItem(this.SCORE_KEY, score.toString());
    } catch (error) {
      console.error('Erro ao salvar pontuação:', error);
    }
  }
  
  /**
   * Carrega a pontuação total do localStorage
   * @returns Pontuação total salva ou 0 se não existir
   */
  public loadTotalScore(): number {
    try {
      const savedScore = localStorage.getItem(this.SCORE_KEY);
      return savedScore ? parseInt(savedScore, 10) : 0;
    } catch (error) {
      console.error('Erro ao carregar pontuação:', error);
      return 0;
    }
  }
  
  /**
   * Adiciona pontos à pontuação total
   * @param points Pontos a serem adicionados
   * @returns Nova pontuação total
   */
  public addPoints(points: number): number {
    const currentScore = this.loadTotalScore();
    const newScore = currentScore + points;
    this.saveTotalScore(newScore);
    return newScore;
  }
}
