/**
 * Converte uma tecla em letra A-Z do jogo, removendo acentos ("ç" -> "C", "á" -> "A").
 * Retorna null para qualquer coisa que não seja uma letra.
 */
export function normalizeLetter(key: string): string | null {
  if (key.length !== 1) return null;
  const letter = key.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  return /^[A-Z]$/.test(letter) ? letter : null;
}
