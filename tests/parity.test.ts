/**
 * Garante que as grades geradas são idênticas às do protótipo V5 aprovado pela equipe.
 * O arquivo fixtures/v5-layouts.json foi gerado executando o código original do V5 (game.js).
 */
import fixture from './fixtures/v5-layouts.json';
import { STAGES } from '../src/core/content';
import { buildCrossword } from '../src/core/crossword';
import { buildWordSearch, linePath } from '../src/core/wordSearch';

describe('fidelidade ao protótipo V5', () => {
  it('tem as mesmas 28 fases, na mesma ordem', () => {
    expect(STAGES.map((s) => s.id)).toEqual(fixture.stages.map((s) => s.id));
  });

  it.each(fixture.stages.map((s, i) => [s.id, i] as const))('%s: palavras-cruzadas idênticas', (_, i) => {
    const expected = fixture.stages[i].cross;
    const built = buildCrossword(STAGES[i].cross);
    expect({ width: built.width, height: built.height }).toEqual({ width: expected.width, height: expected.height });
    expect(built.entries.map(({ index, word, x, y, d }) => ({ index, word, x, y, d }))).toEqual(expected.entries);
  });

  it.each(fixture.stages.map((s, i) => [s.id, i] as const))('%s: caça-palavras idêntico', (_, i) => {
    const expected = fixture.stages[i].hunt;
    const built = buildWordSearch(STAGES[i].hunt, i + 15);
    expect(built.grid.join('')).toBe(expected.grid);
    expect(built.placed.map(({ word, coords }) => ({ word, coords }))).toEqual(expected.placed);
  });

  it('linePath igual ao original', () => {
    const n = 16;
    expect([linePath(0, 0, n), linePath(0, 3, n), linePath(0, 51, n), linePath(17, 15, n), linePath(0, 20, n)]).toEqual(
      fixture.linePaths
    );
  });
});
