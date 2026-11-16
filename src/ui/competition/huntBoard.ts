import { HuntPuzzle } from '../../core/match';
import { YourProgress } from '../../core/protocol';
import { linePath } from '../../core/wordSearch';
import { html, setHtml } from '../dom';

export interface HuntHandlers {
  /** Seleção de uma ponta à outra: o servidor confere. Devolve a palavra encontrada, null ou undefined (erro). */
  select(from: number, to: number): Promise<{ index: number; word: string; coords: number[] } | null | undefined>;
  say(message: string, kind?: '' | 'good' | 'bad'): void;
  progress(done: number, total: number): void;
}

/** Caça-palavras da competição: arrastar marca a palavra; quem confere é o servidor. */
export class HuntBoard {
  private puzzle: HuntPuzzle | null = null;
  private found = new Map<number, { word: string; coords: number[] }>();
  private hintCells = new Map<number, number>();
  private missed: { word: string; coords: number[] }[] = [];
  private justFound: number | null = null;
  private selection: number[] = [];
  private dragStart: number | null = null;
  private dragEnd: number | null = null;
  private locked = false;
  private busy = false;
  /** Pista escolhida (a dica vale para ela). */
  selected = 0;

  constructor(
    private readonly board: HTMLElement,
    private readonly clues: HTMLElement,
    private readonly h: HuntHandlers
  ) {
    this.bind();
  }

  load(puzzle: HuntPuzzle): void {
    this.puzzle = puzzle;
    this.found.clear();
    this.hintCells.clear();
    this.missed = [];
    this.justFound = null;
    this.selection = [];
    this.locked = false;
    this.selected = 0;
    this.board.style.setProperty('--n', String(puzzle.n));
    this.renderList();
    this.paint();
  }

  sync(you: YourProgress): void {
    if (!this.puzzle) return;
    let changed = false;
    for (const [k, coords] of Object.entries(you.found)) {
      const i = Number(k);
      if (!this.found.has(i)) {
        this.found.set(i, { word: you.solved[i] ?? '', coords });
        changed = true;
      }
    }
    for (const [k, cell] of Object.entries(you.hintCells)) {
      if (this.hintCells.get(Number(k)) !== cell) {
        this.hintCells.set(Number(k), cell);
        changed = true;
      }
    }
    if (changed) {
      this.renderList();
      this.paint();
    }
  }

  showSolution(words: string[], coords: number[][]): void {
    this.locked = true;
    this.missed = words.map((word, i) => ({ word, coords: coords[i] })).filter((_, i) => !this.found.has(i));
    this.hintCells.clear();
    this.renderList(words);
    this.paint();
  }

  hint(index: number, cell: number): void {
    this.hintCells.set(index, cell);
    this.paint();
  }

  isSolved(index: number): boolean {
    return this.found.has(index);
  }

  firstOpen(): number {
    if (!this.found.has(this.selected)) return this.selected;
    return this.puzzle!.words.findIndex((_, i) => !this.found.has(i));
  }

  private renderList(solution?: string[]): void {
    const p = this.puzzle!;
    setHtml(
      this.clues,
      html`<ol class="hunt-list">${p.words.map((w) => {
        const hit = this.found.get(w.index);
        const word = hit?.word || solution?.[w.index];
        return html`<li class="clue ${hit ? 'solved' : ''} ${w.index === this.selected && !this.locked ? 'active' : ''}"
          data-pick="${w.index}" tabindex="0">
          <span class="clue-num">${w.index + 1}</span> <span class="hunt-clue">${w.clue}</span>
          ${word ? html`<b class="hunt-word ${hit ? '' : 'is-missed'}">${word}</b>` : html`<span class="clue-len">(${w.length})</span>`}
        </li>`;
      })}</ol>`
    );
  }

  private paint(): void {
    const p = this.puzzle!;
    this.h.progress(this.found.size, p.words.length);
    const center = (i: number) => ({ x: (i % p.n) + 0.5, y: Math.floor(i / p.n) + 0.5 });
    const stroke = (coords: number[], cls: string) => {
      const a = center(coords[0]);
      const b = center(coords[coords.length - 1]);
      return html`<line class="${cls}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" pathLength="1"></line>`;
    };
    const marks = [
      ...[...this.found].map(([i, f]) => stroke(f.coords, i === this.justFound ? 'mark is-new' : 'mark')),
      ...this.missed.map((m) => stroke(m.coords, 'mark is-missed')),
      this.selection.length ? stroke(this.selection, 'selecting') : '',
      ...[...this.hintCells]
        .filter(([i]) => !this.found.has(i))
        .map(([, cell]) => html`<circle class="hint-ring" cx="${center(cell).x}" cy="${center(cell).y}" r="0.42"></circle>`),
    ];
    setHtml(
      this.board,
      html`${p.grid.map(
        (ch, i) => html`<div class="hunt-cell" data-i="${i}" role="gridcell"
          aria-label="Linha ${Math.floor(i / p.n) + 1}, coluna ${(i % p.n) + 1}, letra ${ch}">${ch}</div>`
      )}<svg class="hunt-marks" viewBox="0 0 ${p.n} ${p.n}" preserveAspectRatio="none" aria-hidden="true">${marks}</svg>`
    );
    this.justFound = null;
  }

  private async check(): Promise<void> {
    const sel = this.selection;
    if (sel.length < 2) {
      this.selection = [];
      this.paint();
      if (sel.length) this.h.say('Arraste da primeira até a última letra.');
      return;
    }
    this.busy = true;
    const hit = await this.h.select(sel[0], sel[sel.length - 1]);
    this.busy = false;
    this.selection = [];
    if (this.locked) return;
    if (hit) {
      this.found.set(hit.index, { word: hit.word, coords: hit.coords });
      this.justFound = hit.index;
      if (this.selected === hit.index) this.selected = this.firstOpen();
      this.renderList();
      if (this.found.size < this.puzzle!.words.length) this.h.say(`Achou ${hit.word}.`, 'good');
    } else if (hit === null) {
      this.h.say('Essa sequência não é nenhuma das palavras.', 'bad');
    }
    this.paint();
  }

  private bind(): void {
    const board = this.board;
    const cellAt = (ev: PointerEvent): number | null => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('.hunt-cell');
      return el && board.contains(el) ? Number(el.dataset.i) : null;
    };
    const select = (a: number, b: number) => {
      this.selection = linePath(a, b, this.puzzle!.n);
      this.paint();
    };

    board.addEventListener('pointerdown', (e) => {
      if (!this.puzzle || this.locked || this.busy) return;
      const a = cellAt(e);
      if (a === null) return;
      this.dragStart = this.dragEnd = a;
      board.setPointerCapture(e.pointerId);
      select(a, a);
      e.preventDefault();
    });
    board.addEventListener('pointermove', (e) => {
      if (this.dragStart === null) return;
      const b = cellAt(e);
      if (b !== null && b !== this.dragEnd) {
        this.dragEnd = b;
        select(this.dragStart, b);
      }
    });
    board.addEventListener('pointerup', (e) => {
      if (this.dragStart === null) return;
      const b = cellAt(e);
      if (b !== null) select(this.dragStart, b);
      this.dragStart = this.dragEnd = null;
      void this.check();
    });
    board.addEventListener('pointercancel', () => {
      this.dragStart = this.dragEnd = null;
      this.selection = [];
      this.paint();
    });

    // Tocar numa pista: escolhe a pista (a dica vale para ela) e mostra o tamanho.
    this.clues.addEventListener('click', (e) => {
      const row = (e.target as HTMLElement).closest<HTMLElement>('[data-pick]');
      if (!row || !this.puzzle || this.locked) return;
      const i = Number(row.dataset.pick);
      if (this.found.has(i)) return;
      this.selected = i;
      this.renderList();
      const w = this.puzzle.words[i];
      this.h.say(`Pista ${i + 1}: ${w.clue} Tem ${w.length} letras.`);
    });
    this.clues.addEventListener('keydown', (e) => {
      const row = (e.target as HTMLElement).closest<HTMLElement>('[data-pick]');
      if (row && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        row.click();
      }
    });
  }
}
