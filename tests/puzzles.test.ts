import { STAGES, STUDY, FAMILIES } from '../src/core/content';
import { buildCrossword, covers, positionIn } from '../src/core/crossword';
import { buildWordSearch, linePath, matchSelection } from '../src/core/wordSearch';
import { normalize } from '../src/core/text';
import { existsSync } from 'fs';
import { join } from 'path';

const publicDir = join(__dirname, '..', 'public');

describe('normalize', () => {
  it('remove acentos, espaços e símbolos', () => {
    expect(normalize('Adsorção')).toBe('ADSORCAO');
    expect(normalize('febre aftosa!')).toBe('FEBREAFTOSA');
    expect(normalize(null)).toBe('');
  });
});

describe('conteúdo', () => {
  it.each(STAGES.map((s) => [s.id, s] as const))('%s tem dados, revisão e arquivos', (_, s) => {
    expect(s.title && s.short && s.tag && s.description && s.review).toBeTruthy();
    // Frase de abertura: uma frase completa, tirada do texto do e-book.
    expect(s.intro).toMatch(/^[A-ZÁÉÍÓÚ].+\.$/);
    expect(s.cross.length).toBeGreaterThanOrEqual(5);
    expect(s.hunt.length).toBeGreaterThanOrEqual(5);
    expect(existsSync(join(publicDir, 'assets', `${s.image}.webp`))).toBe(true);
    const study = STUDY[s.id];
    expect(study.images.length).toBe(study.pages.length);
    study.images.forEach((img) => expect(existsSync(join(publicDir, img))).toBe(true));
  });

  it('ids únicos e famílias ordenadas', () => {
    expect(new Set(STAGES.map((s) => s.id)).size).toBe(STAGES.length);
    expect(FAMILIES).toEqual([...FAMILIES].sort((a, b) => a.localeCompare(b, 'pt-BR')));
  });
});

describe('palavras-cruzadas', () => {
  it.each(STAGES.map((s) => [s.id, s] as const))('%s: grade conectada e consistente', (_, s) => {
    const cw = buildCrossword(s.cross);
    expect(cw.entries).toHaveLength(s.cross.length);
    // Cada letra de cada palavra está na casa certa da grade.
    const at = new Map(cw.cells.map((c) => [`${c.x},${c.y}`, c]));
    for (const e of cw.entries) {
      for (let i = 0; i < e.word.length; i++) {
        const x = e.d === 'H' ? e.x + i : e.x;
        const y = e.d === 'V' ? e.y + i : e.y;
        const cell = at.get(`${x},${y}`)!;
        expect(cell.ch).toBe(e.word[i]);
        expect(cell.belongs).toContain(e.index);
        expect(covers(e, x, y)).toBe(true);
        expect(positionIn(e, x, y)).toBe(i);
      }
    }
    // Todas as palavras cruzam com pelo menos outra.
    for (const e of cw.entries) {
      expect(cw.cells.some((c) => c.belongs.includes(e.index) && c.belongs.length > 1)).toBe(true);
    }
  });

  it('acusa palavras que não se cruzam', () => {
    expect(() => buildCrossword([['ABC', 'x'], ['XYZ', 'y']])).toThrow(/cruzar/);
  });
});

describe('caça-palavras', () => {
  it.each(STAGES.map((s, i) => [s.id, s, i] as const))('%s: todas as palavras estão no quadro', (_, s, i) => {
    const ws = buildWordSearch(s.hunt, i + 15);
    expect(ws.grid).toHaveLength(ws.n * ws.n);
    ws.placed.forEach((p, j) => {
      expect(p.word).toBe(normalize(s.hunt[j][0]));
      expect(p.coords.map((c) => ws.grid[c]).join('')).toBe(p.word);
    });
  });

  it('é sempre o mesmo quadro para a mesma semente', () => {
    expect(buildWordSearch(STAGES[3].hunt, 7).grid).toEqual(buildWordSearch(STAGES[3].hunt, 7).grid);
  });

  it('linePath aceita retas e diagonais e recusa o resto', () => {
    expect(linePath(0, 3, 16)).toEqual([0, 1, 2, 3]);
    expect(linePath(0, 34, 16)).toEqual([0, 17, 34]);
    expect(linePath(0, 20, 16)).toEqual([]);
  });

  it('matchSelection reconhece a palavra nos dois sentidos e ignora as já encontradas', () => {
    const ws = buildWordSearch(STAGES[0].hunt, 15);
    const coords = ws.placed[2].coords;
    expect(matchSelection(ws, coords, [])).toBe(2);
    expect(matchSelection(ws, [...coords].reverse(), [])).toBe(2);
    expect(matchSelection(ws, coords, [2])).toBe(-1);
    expect(matchSelection(ws, coords.slice(1), [])).toBe(-1);
  });
});
