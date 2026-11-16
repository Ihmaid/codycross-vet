import { STAGES } from '../src/core/content';
import { buildCrossword } from '../src/core/crossword';
import {
  buildRound,
  cleanCode,
  cleanName,
  cleanSettings,
  finishBonus,
  hintPrefix,
  rank,
  RANDOM_STAGE,
  resolveStages,
  roundScore,
} from '../src/core/match';
import { originMatcher } from '../server/app';

describe('grades da competição', () => {
  it.each(STAGES.map((s) => [s.id] as const))('%s: a grade enviada não contém as respostas', (id) => {
    for (const mode of ['cross', 'hunt'] as const) {
      const round = buildRound(id, mode);
      const json = JSON.stringify(round.puzzle);
      if (mode === 'cross') {
        // Nenhuma palavra aparece no que vai para o navegador.
        for (const e of round.cross!.entries) expect(json).not.toContain(`"${e.word}"`);
        expect(json).not.toMatch(/"ch"|"word"/);
      } else {
        expect(json).not.toMatch(/"word"|"coords"/);
      }
    }
  });

  it('as grades são as mesmas do jogo individual', () => {
    const round = buildRound('raiva', 'cross');
    const solo = buildCrossword(STAGES.find((s) => s.id === 'raiva')!.cross);
    expect(round.cross).toEqual(solo);
    expect(round.total).toBe(solo.entries.length);
  });
});

describe('regras', () => {
  it('apelido limpo e com tamanho máximo', () => {
    expect(cleanName('  Ana   Clara ')).toBe('Ana Clara');
    expect(cleanName('a\u0000b')).toBe('ab');
    expect(cleanName('')).toBeNull();
    expect(cleanName('x'.repeat(17))).toBeNull();
    expect(cleanName(42)).toBeNull();
  });

  it('código da sala', () => {
    expect(cleanCode(' ab-c2d ')).toBe('ABC2D');
  });

  it('configurações válidas e inválidas', () => {
    const ok = { mode: 'hunt', stages: ['raiva', RANDOM_STAGE], seconds: 180, hints: false };
    expect(cleanSettings(ok)).toEqual(ok);
    expect(cleanSettings({ ...ok, stages: [] })).toBeNull();
    expect(cleanSettings({ ...ok, stages: ['raiva', 'raiva', 'raiva', 'raiva', 'raiva', 'raiva'] })).toBeNull();
    expect(cleanSettings({ ...ok, stages: ['nao-existe'] })).toBeNull();
    expect(cleanSettings({ ...ok, seconds: 7 })).toBeNull();
    expect(cleanSettings({ ...ok, mode: 'outro' })).toBeNull();
    expect(cleanSettings(null)).toBeNull();
  });

  it('sorteio não repete fases', () => {
    const stages = resolveStages(['raiva', RANDOM_STAGE, RANDOM_STAGE, RANDOM_STAGE, RANDOM_STAGE]);
    expect(stages[0]).toBe('raiva');
    expect(new Set(stages).size).toBe(5);
  });

  it('cada dica revela uma letra além do começo certo ou já revelado', () => {
    expect(hintPrefix('VIRUS', '')).toBe('V');
    expect(hintPrefix('VIRUS', 'VIX')).toBe('VIR');
    expect(hintPrefix('VIRUS', '', 3)).toBe('VIRU');
    expect(hintPrefix('VIRUS', 'VIRUS')).toBe('VIRUS');
  });

  it('pontuação: palavras, bônus e desconto das dicas', () => {
    expect(roundScore(3, 0, 0)).toBe(300);
    expect(roundScore(3, 40, 2)).toBe(290);
    expect(roundScore(0, 0, 3)).toBe(0);
    expect(finishBonus(12_300)).toBe(13);
    expect(finishBonus(-5)).toBe(0);
  });

  it('classificação: mais pontos; no empate, quem chegou antes', () => {
    const p = (id: string, score: number, scoredAt: number) => ({ id, name: id, score, scoredAt, joinedAt: 0 });
    expect(rank([p('a', 100, 5), p('b', 200, 9), p('c', 100, 2)]).map((x) => x.id)).toEqual(['b', 'c', 'a']);
  });

  it('origens permitidas aceitam curinga', () => {
    const allowed = originMatcher(['https://codycross-vet.vercel.app', 'https://codycross-*-time.vercel.app']);
    expect(allowed('https://codycross-vet.vercel.app')).toBe(true);
    expect(allowed('https://codycross-vet-git-x-time.vercel.app')).toBe(true);
    expect(allowed('https://evil.com')).toBe(false);
    expect(allowed('https://codycross-vet.vercel.app.evil.com')).toBe(false);
    expect(allowed(undefined)).toBe(true);
    expect(originMatcher([])('https://qualquer.um')).toBe(true);
  });
});
