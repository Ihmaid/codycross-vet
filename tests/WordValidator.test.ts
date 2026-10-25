import { WordValidator } from '../src/core/engine/WordValidator';
import { Level } from '../src/core/models/Level';

const level = (vertical: string): Level => ({
  id: 'teste',
  theme: 'Teste',
  verticalWord: { word: vertical, clue: vertical ? 'Pista' : '' },
  horizontalWords: [
    { word: 'GATO', clue: 'Felino', intersectionIndex: 0, position: 0 },
    { word: 'ASA', clue: 'Ave voa com ela', intersectionIndex: 2, position: 1 },
  ],
  difficulty: 'fácil',
  timeLimit: 60,
  points: { base: 100, timeBonus: 1, hintPenalty: 10 },
});

function type(v: WordValidator, row: number, startCol: number, word: string): boolean[] {
  return [...word].map((ch, i) => v.setLetter(row, startCol + i, ch));
}

describe('WordValidator', () => {
  it('resolve a linha só quando todas as letras estão corretas', () => {
    const v = new WordValidator(level('GA'));
    expect(type(v, 0, 0, 'GAT')).toEqual([false, false, false]);
    expect(v.setLetter(0, 3, 'o')).toBe(true); // minúscula é aceita
    expect(v.isRowSolved(0)).toBe(true);
  });

  it('não marca palavra errada como resolvida', () => {
    const v = new WordValidator(level('GA'));
    type(v, 0, 0, 'GATA');
    expect(v.isRowSolved(0)).toBe(false);
  });

  it('trava linhas resolvidas e ignora células fora da palavra', () => {
    const v = new WordValidator(level('GA'));
    type(v, 0, 0, 'GATO');
    expect(v.setLetter(0, 1, 'X')).toBe(false);
    expect(v.getLetter(0, 1)).toBe('A');
    expect(v.setLetter(1, 0, 'X')).toBe(false); // linha 1 começa na coluna 2
    expect(v.getLetter(1, 0)).toBe('');
  });

  it('revela a palavra vertical conforme as linhas são resolvidas', () => {
    const v = new WordValidator(level('GA'));
    type(v, 1, 2, 'ASA');
    expect(v.getVerticalLetters()).toEqual(['', 'A']);
    expect(v.isLevelComplete()).toBe(false);
    type(v, 0, 0, 'GATO');
    expect(v.getVerticalLetters()).toEqual(['G', 'A']);
    expect(v.isLevelComplete()).toBe(true);
  });

  it('conclui níveis sem palavra vertical', () => {
    const v = new WordValidator(level(''));
    expect(v.hasVerticalWord()).toBe(false);
    type(v, 0, 0, 'GATO');
    type(v, 1, 2, 'ASA');
    expect(v.isLevelComplete()).toBe(true);
  });

  it('reset limpa respostas e linhas resolvidas', () => {
    const v = new WordValidator(level('GA'));
    type(v, 0, 0, 'GATO');
    v.reset();
    expect(v.isRowSolved(0)).toBe(false);
    expect(v.getLetter(0, 0)).toBe('');
  });
});
