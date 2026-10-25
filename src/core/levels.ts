import { Level } from './models/Level';

const WORD_PATTERN = /^[A-Z]+$/;

/** Lista os problemas de um nível. Lista vazia = nível válido. */
export function validateLevel(level: Level): string[] {
  const problems: string[] = [];
  const words = level.horizontalWords ?? [];

  if (!level.id) problems.push('nível sem "id"');
  if (words.length === 0) problems.push('nível sem palavras horizontais');
  if (!(level.timeLimit > 0)) problems.push('"timeLimit" deve ser maior que zero');

  words.forEach((w, i) => {
    const label = `palavra "${w.word}"`;
    if (!WORD_PATTERN.test(w.word)) problems.push(`${label}: use apenas letras A-Z, sem acentos ou espaços`);
    if (!w.clue) problems.push(`${label}: sem dica`);
    if (!Number.isInteger(w.intersectionIndex) || w.intersectionIndex < 0) {
      problems.push(`${label}: "intersectionIndex" inválido`);
    }
    if (w.position !== i) problems.push(`${label}: "position" deveria ser ${i}`);
  });

  const vertical = level.verticalWord?.word ?? '';
  if (vertical) {
    const formed = words.map((w) => w.word[0]).join('');
    if (vertical !== formed) {
      problems.push(`palavra vertical "${vertical}" não bate com as iniciais das horizontais ("${formed}")`);
    }
    if (!level.verticalWord.clue) problems.push('palavra vertical sem dica');
  }

  return problems;
}

/** Normaliza (ordena as linhas pela posição) e valida um nível, lançando erro se houver problemas. */
export function prepareLevel(raw: Level): Level {
  const level: Level = {
    ...raw,
    horizontalWords: [...raw.horizontalWords].sort((a, b) => a.position - b.position),
  };
  const problems = validateLevel(level);
  if (problems.length > 0) {
    throw new Error(`Nível "${raw.id}" inválido:\n- ${problems.join('\n- ')}`);
  }
  return level;
}
