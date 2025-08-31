import { Level } from '../models/Level';

export class LevelService {
  private readonly BASE_PATH = '/data/levels/';
  
  /**
   * Carrega um nível a partir do seu ID
   * @param levelId ID do nível a ser carregado
   * @returns Promise com o nível carregado
   */
  public async loadLevel(levelId: string): Promise<Level> {
    try {
      const response = await fetch(`${this.BASE_PATH}${levelId}.json`);
      if (!response.ok) {
        throw new Error(`Erro ao carregar nível: ${response.statusText}`);
      }
      return await response.json() as Level;
    } catch (error) {
      console.error('Erro ao carregar nível:', error);
      throw error;
    }
  }
  
  /**
   * Salva o progresso do jogador no localStorage
   * @param completedLevels Array com IDs dos níveis completados
   */
  public saveProgress(completedLevels: string[]): void {
    try {
      localStorage.setItem('completedLevels', JSON.stringify(completedLevels));
    } catch (error) {
      console.error('Erro ao salvar progresso:', error);
    }
  }
  
  /**
   * Carrega o progresso do jogador do localStorage
   * @returns Array com IDs dos níveis completados
   */
  public loadProgress(): string[] {
    try {
      const savedProgress = localStorage.getItem('completedLevels');
      return savedProgress ? JSON.parse(savedProgress) : [];
    } catch (error) {
      console.error('Erro ao carregar progresso:', error);
      return [];
    }
  }
}
