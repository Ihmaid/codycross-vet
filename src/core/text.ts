/** Remove acentos, espaços e símbolos: "Adsorção" -> "ADSORCAO". */
export function normalize(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}
