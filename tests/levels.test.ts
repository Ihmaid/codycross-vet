import { RAW_LEVELS } from '../src/data/levels';
import { prepareLevel, validateLevel } from '../src/core/levels';
import { Level } from '../src/core/models/Level';

describe('dados dos níveis', () => {
  it.each(RAW_LEVELS.map((l) => [l.id, l] as const))('%s é válido', (_, level) => {
    expect(validateLevel(prepareLevel(level))).toEqual([]);
  });

  it('não repete ids', () => {
    const ids = RAW_LEVELS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('validateLevel', () => {
  const base: Level = {
    id: 'teste',
    theme: 'Teste',
    verticalWord: { word: 'GA', clue: 'Pista' },
    horizontalWords: [
      { word: 'GATO', clue: 'Felino', intersectionIndex: 0, position: 0 },
      { word: 'ASA', clue: 'Ave voa com ela', intersectionIndex: 1, position: 1 },
    ],
    difficulty: 'fácil',
    timeLimit: 60,
    points: { base: 100, timeBonus: 1, hintPenalty: 10 },
  };

  it('aceita um nível correto', () => {
    expect(validateLevel(base)).toEqual([]);
  });

  it('acusa palavra vertical que não bate com as iniciais', () => {
    expect(validateLevel({ ...base, verticalWord: { word: 'GO', clue: 'x' } })).toEqual([
      expect.stringContaining('não bate'),
    ]);
  });

  it('acusa acentos e posições fora de ordem', () => {
    const problems = validateLevel({
      ...base,
      horizontalWords: [
        { word: 'GATÃO', clue: 'x', intersectionIndex: 0, position: 1 },
        { word: 'ASA', clue: 'x', intersectionIndex: 1, position: 0 },
      ],
    });
    expect(problems.join('\n')).toMatch(/apenas letras/);
    expect(problems.join('\n')).toMatch(/"position" deveria ser 0/);
  });

  it('prepareLevel ordena as linhas por posição e lança erro se inválido', () => {
    const shuffled = { ...base, horizontalWords: [...base.horizontalWords].reverse() };
    expect(prepareLevel(shuffled).horizontalWords.map((w) => w.word)).toEqual(['GATO', 'ASA']);
    expect(() => prepareLevel({ ...base, timeLimit: 0 })).toThrow(/timeLimit/);
  });
});
