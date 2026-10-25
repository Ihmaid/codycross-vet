import { STAGES } from '../src/core/content';
import { awardPoints, emptyProgress, Progress, PROGRESS_KEY, starsFor } from '../src/core/progress';
import { createBackup, emptyNotebook, Notebook, NOTEBOOK_KEY, parseBackup } from '../src/core/notebook';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v), data };
}

describe('pontuação', () => {
  it('100 - 8 por dica - 3 por erro, mínimo 25', () => {
    expect(awardPoints(0, 0)).toBe(100);
    expect(awardPoints(2, 1)).toBe(81);
    expect(awardPoints(20, 20)).toBe(25);
  });

  it('estrelas pela pontuação', () => {
    expect([starsFor(100), starsFor(90), starsFor(89), starsFor(60), starsFor(59)]).toEqual([3, 3, 2, 2, 1]);
  });
});

describe('Progress', () => {
  it('libera fases em sequência; modo exploração libera todas', () => {
    const p = Progress.load(STAGES, memoryStorage());
    expect(p.isAvailable(0)).toBe(true);
    expect(p.isAvailable(1)).toBe(false);
    p.finish(STAGES[0], 'hunt');
    expect(p.isAvailable(1)).toBe(true);
    expect(p.isAvailable(2)).toBe(false);
    expect(p.nextStageIndex()).toBe(1);
    p.state.explore = true;
    expect(p.isAvailable(27)).toBe(true);
  });

  it('pontua com dicas e erros e guarda o recorde', () => {
    const storage = memoryStorage();
    const p = Progress.load(STAGES, storage);
    const s = STAGES[0];
    p.addHint(s, 'cross');
    p.addMistake(s, 'cross');
    expect(p.finish(s, 'cross')).toEqual({ award: 89, best: 89, wasDone: false });
    p.restart(s, 'cross');
    expect(p.finish(s, 'cross')).toEqual({ award: 100, best: 100, wasDone: true });
    p.addHint(s, 'cross');
    expect(p.finish(s, 'cross').best).toBe(100);
    expect(p.totalPoints()).toBe(100);
    expect(p.stagePoints(s)).toBe(100);
    expect(JSON.parse(storage.data[PROGRESS_KEY]).best['intro:cross']).toBe(100);
  });

  it('lê o progresso salvo pelo V5 e ignora dados corrompidos', () => {
    const v5 = { ...emptyProgress(), done: { 'intro:cross': true } };
    expect(Progress.load(STAGES, memoryStorage({ [PROGRESS_KEY]: JSON.stringify(v5) })).finishedCount()).toBe(1);
    expect(Progress.load(STAGES, memoryStorage({ [PROGRESS_KEY]: '{oops' })).finishedCount()).toBe(0);
  });
});

describe('Notebook e backup', () => {
  it('favoritos, revisados e anotações persistem', () => {
    const storage = memoryStorage();
    const nb = Notebook.load(storage);
    nb.toggleFavorite('raiva');
    nb.toggleReviewed('raiva');
    nb.setNote('raiva', '  lembrar: Lyssavirus ');
    const again = Notebook.load(storage);
    expect(again.isFavorite('raiva') && again.isReviewed('raiva') && again.hasNote('raiva')).toBe(true);
    expect(again.count(STAGES, 'favorites')).toBe(1);
    expect(JSON.parse(storage.data[NOTEBOOK_KEY]).notes.raiva).toContain('Lyssavirus');
  });

  it('exporta e importa (formato do V5)', () => {
    const game = { ...emptyProgress(), done: { 'pif:hunt': true } };
    const caderno = { ...emptyNotebook(), notes: { pif: 'nota' } };
    const restored = parseBackup(JSON.stringify(createBackup(game, caderno, new Date('2026-01-01'))));
    expect(restored.game.done).toEqual({ 'pif:hunt': true });
    expect(restored.caderno.notes).toEqual({ pif: 'nota' });
  });

  it('recusa arquivos incompatíveis', () => {
    expect(() => parseBackup('não é json')).toThrow(/JSON/);
    expect(() => parseBackup(JSON.stringify({ app: 'Outro', format: 1 }))).toThrow(/backup do Virologia/);
  });
});
