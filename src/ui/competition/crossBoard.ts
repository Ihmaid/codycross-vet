import { positionIn } from '../../core/crossword';
import { CrossPuzzle } from '../../core/match';
import { YourProgress } from '../../core/protocol';
import { normalize } from '../../core/text';
import { html, Html, replayAnimation, setHtml } from '../dom';

export interface CrossHandlers {
  /** Palavra completa digitada: o servidor confere. Devolve a palavra certa, null (errada) ou undefined (não deu para conferir). */
  submit(index: number, answer: string): Promise<string | null | undefined>;
  /** Mensagem para o jogador. */
  say(message: string, kind?: '' | 'good' | 'bad'): void;
  /** Progresso mudou (barra e contagem). */
  progress(done: number, total: number): void;
}

/**
 * Palavras-cruzadas da competição: mesma grade e mesmo visual do jogo individual,
 * mas sem as respostas no navegador. Cada palavra completa vai para o servidor conferir.
 */
export class CrossBoard {
  private puzzle: CrossPuzzle | null = null;
  private inputs: string[] = [];
  private solved = new Map<number, string>();
  private wrong = new Set<number>();
  private pending = new Set<number>();
  private solution: string[] | null = null;
  private cellEls: HTMLButtonElement[] = [];
  private locked = false;
  selected = 0;

  constructor(
    private readonly board: HTMLElement,
    private readonly clues: HTMLElement,
    private readonly h: CrossHandlers
  ) {
    this.bind();
  }

  load(puzzle: CrossPuzzle): void {
    this.puzzle = puzzle;
    this.inputs = puzzle.entries.map(() => '');
    this.solved.clear();
    this.wrong.clear();
    this.pending.clear();
    this.solution = null;
    this.locked = false;
    this.selected = 0;
    this.render();
  }

  /** Aplica o que o servidor diz que já foi resolvido ou revelado (ao voltar para a sala). */
  sync(you: YourProgress): void {
    if (!this.puzzle) return;
    let changed = false;
    for (const [k, word] of Object.entries(you.solved)) {
      const i = Number(k);
      if (!this.solved.has(i) && this.puzzle.entries[i]) {
        this.solved.set(i, word);
        this.inputs[i] = word;
        changed = true;
      }
    }
    for (const [k, prefix] of Object.entries(you.revealed)) {
      const i = Number(k);
      if (!this.solved.has(i) && !this.inputs[i].startsWith(prefix)) {
        this.inputs[i] = prefix;
        changed = true;
      }
    }
    if (changed) {
      this.puzzle.entries.forEach((_, i) => this.setInputValue(i));
      this.paint();
    }
  }

  /** Fim da rodada: mostra as respostas e trava a grade. */
  showSolution(words: string[]): void {
    this.solution = words;
    this.locked = true;
    this.clues.querySelectorAll<HTMLInputElement>('.clue-input').forEach((el, i) => {
      el.disabled = true;
      el.value = words[i] ?? el.value;
    });
    this.paint();
  }

  /** Revela o começo da palavra (dica). */
  reveal(index: number, prefix: string): void {
    if (this.solved.has(index)) return;
    this.inputs[index] = prefix + this.inputs[index].slice(prefix.length);
    this.inputs[index] = this.inputs[index].slice(0, this.puzzle!.entries[index].length);
    this.wrong.delete(index);
    this.setInputValue(index);
    this.paint();
    this.focus(index);
    this.maybeSubmit(index);
  }

  isSolved(index: number): boolean {
    return this.solved.has(index);
  }

  typed(index: number): string {
    return this.inputs[index] ?? '';
  }

  /** Primeira pista ainda sem resposta (a selecionada, se for o caso). */
  firstOpen(): number {
    if (!this.solved.has(this.selected)) return this.selected;
    return this.puzzle!.entries.findIndex((_, i) => !this.solved.has(i));
  }

  private render(): void {
    const p = this.puzzle!;
    const group = (d: 'H' | 'V', title: string): Html => {
      const items = p.entries.filter((e) => e.d === d);
      if (!items.length) return html``;
      return html`<h3 class="clue-group">${title}</h3>${items.map(
        (e) => html`<div class="clue" data-clue="${e.index}">
          <label for="comp-answer-${e.index}"><span class="clue-num">${e.index + 1}</span> ${e.clue} <span class="clue-len">(${e.length})</span></label>
          <input id="comp-answer-${e.index}" class="clue-input" type="text" spellcheck="false" autocomplete="off" autocapitalize="characters"
            maxlength="${e.length}" style="--len:${e.length}" data-index="${e.index}">
        </div>`
      )}`;
    };
    setHtml(this.clues, html`${group('H', 'Horizontais')}${group('V', 'Verticais')}`);
    this.board.style.setProperty('--cols', String(p.width));
    this.board.style.gridTemplateColumns = `repeat(${p.width}, var(--cell))`;
    this.board.style.gridTemplateRows = `repeat(${p.height}, var(--cell))`;
    setHtml(
      this.board,
      html`${p.cells.map((c) => {
        const start = c.belongs.find((i) => p.entries[i].x === c.x && p.entries[i].y === c.y);
        return html`<button type="button" class="cw-cell" data-x="${c.x}" data-y="${c.y}" style="grid-column:${c.x + 1};grid-row:${c.y + 1}">${
          start !== undefined ? html`<small>${start + 1}</small>` : ''
        }<span></span></button>`;
      })}`
    );
    this.cellEls = [...this.board.querySelectorAll<HTMLButtonElement>('.cw-cell')];
    this.paint();
  }

  private setInputValue(i: number): void {
    const el = this.input(i);
    if (el && el.value !== this.inputs[i]) el.value = this.inputs[i];
  }

  private input(i: number): HTMLInputElement | null {
    return this.clues.querySelector<HTMLInputElement>(`#comp-answer-${i}`);
  }

  /** Atualiza casas e pistas; `inked` = palavra recém-acertada (as letras "secam" uma a uma). */
  private paint(inked?: number): void {
    const p = this.puzzle!;
    this.h.progress(this.solved.size, p.entries.length);
    p.entries.forEach((_, i) => {
      const item = this.clues.querySelector(`.clue[data-clue="${i}"]`);
      if (!item) return;
      item.classList.toggle('active', i === this.selected && !this.locked);
      item.classList.toggle('solved', this.solved.has(i));
      item.classList.toggle('wrong', this.wrong.has(i));
      const input = this.input(i);
      if (input) input.readOnly = this.solved.has(i);
    });
    p.cells.forEach((c, k) => {
      const el = this.cellEls[k];
      const owners = c.belongs.map((i) => p.entries[i]);
      const solvedBy = owners.find((e) => this.solved.has(e.index));
      let letter = '';
      let missed = false;
      if (solvedBy) letter = this.solved.get(solvedBy.index)![positionIn(solvedBy, c.x, c.y)];
      else if (this.solution) {
        const e = owners[0];
        letter = this.solution[e.index][positionIn(e, c.x, c.y)];
        missed = true;
      } else {
        // Prioriza a letra da pista selecionada; depois a de qualquer pista que passe pela casa.
        const order = [...owners].sort((a, b) => Number(b.index === this.selected) - Number(a.index === this.selected));
        for (const e of order) {
          const ch = this.inputs[e.index][positionIn(e, c.x, c.y)];
          if (ch) {
            letter = ch;
            break;
          }
        }
      }
      el.classList.toggle('solved', !!solvedBy);
      el.classList.toggle('missed', missed);
      el.classList.toggle('active', !this.locked && c.belongs.includes(this.selected));
      el.classList.toggle('has-error', c.belongs.some((i) => this.wrong.has(i)) && !solvedBy);
      if (inked !== undefined) {
        if (c.belongs.includes(inked)) {
          el.style.setProperty('--i', String(positionIn(p.entries[inked], c.x, c.y)));
          replayAnimation(el, 'ink');
        } else el.classList.remove('ink');
      }
      el.lastElementChild!.textContent = letter;
      el.setAttribute('aria-label', `Linha ${c.y + 1}, coluna ${c.x + 1}, ${letter ? `letra ${letter}` : 'vazia'}`);
    });
  }

  focus(i: number): void {
    this.selected = i;
    this.input(i)?.focus();
    this.paint();
  }

  private nextOpen(after: number): number {
    const n = this.puzzle!.entries.length;
    for (let k = 1; k <= n; k++) {
      const j = (after + k) % n;
      if (!this.solved.has(j)) return j;
    }
    return -1;
  }

  private async maybeSubmit(i: number): Promise<void> {
    const entry = this.puzzle!.entries[i];
    const answer = this.inputs[i];
    if (this.locked || this.solved.has(i) || this.pending.has(i) || answer.length !== entry.length) return;
    this.pending.add(i);
    const word = await this.h.submit(i, answer);
    this.pending.delete(i);
    if (word === undefined || this.locked || this.puzzle?.entries[i] !== entry) return;
    if (word) {
      this.solved.set(i, word);
      this.inputs[i] = word;
      this.wrong.delete(i);
      this.setInputValue(i);
      this.paint(i);
      const next = this.nextOpen(i);
      if (next >= 0) {
        this.h.say(`${word} está certa.`, 'good');
        if (document.activeElement === this.input(i)) this.focus(next);
      }
    } else if (this.inputs[i] === answer) {
      this.wrong.add(i);
      this.paint();
      this.h.say('Não é essa. Confira as letras em vermelho.', 'bad');
      const item = this.clues.querySelector(`.clue[data-clue="${i}"]`);
      if (item) replayAnimation(item, 'shake');
    }
  }

  private bind(): void {
    // Clique numa casa: seleciona a pista (num cruzamento, alterna entre as duas).
    this.board.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.cw-cell');
      if (!btn || !this.puzzle || this.locked) return;
      const cell = this.puzzle.cells.find((c) => c.x === Number(btn.dataset.x) && c.y === Number(btn.dataset.y))!;
      const choices = cell.belongs;
      const i = choices.includes(this.selected)
        ? (choices.find((j) => j !== this.selected) ?? this.selected)
        : choices[0];
      this.focus(i);
    });

    const indexOf = (target: EventTarget | null): number | null => {
      const el = target as HTMLElement;
      return el?.classList?.contains('clue-input') ? Number(el.dataset.index) : null;
    };

    this.clues.addEventListener('focusin', (e) => {
      const i = indexOf(e.target);
      if (i === null || i === this.selected) return;
      this.selected = i;
      this.paint();
    });

    this.clues.addEventListener('input', (e) => {
      const i = indexOf(e.target);
      if (i === null || !this.puzzle || this.solved.has(i)) return;
      const input = e.target as HTMLInputElement;
      this.inputs[i] = normalize(input.value).slice(0, this.puzzle.entries[i].length);
      input.value = this.inputs[i];
      this.wrong.delete(i);
      this.paint();
      void this.maybeSubmit(i);
    });

    this.clues.addEventListener('keydown', (e) => {
      const i = indexOf(e.target);
      if (i === null || e.key !== 'Enter') return;
      e.preventDefault();
      if (this.inputs[i].length < this.puzzle!.entries[i].length) {
        this.h.say(`Faltam letras: a resposta tem ${this.puzzle!.entries[i].length}.`);
        return;
      }
      const next = this.nextOpen(i);
      if (next >= 0 && this.solved.has(i)) this.focus(next);
    });
  }
}
