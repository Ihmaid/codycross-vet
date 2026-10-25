const STORAGE_KEY = 'ccvet:levelIndex';

/** Lê o índice do nível salvo. localStorage pode falhar (ex.: modo privado), então tudo é protegido. */
export function loadProgress(levelCount: number): number {
  try {
    const n = parseInt(localStorage.getItem(STORAGE_KEY) ?? '0', 10);
    return Number.isFinite(n) ? Math.min(Math.max(n, 0), levelCount - 1) : 0;
  } catch {
    return 0;
  }
}

export function saveProgress(index: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(index));
  } catch {
    /* progresso apenas não é salvo */
  }
}
