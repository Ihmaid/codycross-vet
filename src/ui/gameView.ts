import { assetPath, STAGES, STUDY } from '../core/content';
import { buildCrossword, Crossword, positionIn } from '../core/crossword';
import { Progress } from '../core/progress';
import { normalize } from '../core/text';
import { Mode, Stage } from '../core/types';
import { buildWordSearch, linePath, matchSelection, WordSearch } from '../core/wordSearch';
import { $, html, Html, replayAnimation, setHtml, show } from './dom';
import { navigate } from './router';
import { WinModal } from './winModal';

type FeedbackKind = '' | 'good' | 'bad';

/** Tela de uma fase: palavras-cruzadas e caça-palavras. */
export class GameView {
  private index = 0;
  private mode: Mode = 'cross';
  private cross: Crossword | null = null;
  /** Respostas digitadas, na ordem das pistas. */
  private inputs: string[] = [];
  private hunt: WordSearch | null = null;
  private selected = 0;
  private showErrors = false;
  private dragStart: number | null = null;
  private dragEnd: number | null = null;
  private selection: number[] = [];
  private hintCell: number | null = null;

  private readonly board = $('cross-board');
  private readonly huntBoard = $('hunt-board');
  private readonly clues = $('clues-list');
  private readonly modal = new WinModal();

  constructor(
    private readonly progress: Progress,
    /** Avisa o app que o progresso mudou (cabeçalho, sumário). */
    private readonly onProgress: (unlockedIndex?: number) => void
  ) {
    $('tab-cross').addEventListener('click', () => this.switchMode('cross'));
    $('tab-hunt').addEventListener('click', () => this.switchMode('hunt'));
    $('check-btn').addEventListener('click', () => this.check());
    $('hint-btn').addEventListener('click', () => this.giveHint());
    $('restart-btn').addEventListener('click', () => this.restart());
    this.bindCrossword();
    this.bindWordSearch();
  }

  private get stage(): Stage {
    return STAGES[this.index];
  }

  /** Abre a fase (chamado pelo roteador). */
  open(index: number, mode: Mode): void {
    const sameStage = index === this.index && this.cross !== null;
    this.index = index;
    this.modal.hide();
    if (!sameStage) this.renderStage();
    if (!sameStage || mode !== this.mode) this.setMode(mode);
    if (!sameStage) window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }

  close(): void {
    this.modal.hide();
  }

  private renderStage(): void {
    const s = this.stage;
    const page = STUDY[s.id]?.pages[0];
    $('crumb-stage').textContent = s.short;
    $('stage-badge').textContent = `Fase ${this.index + 1} de ${STAGES.length}`;
    setHtml($('stage-title'), html`${s.title} <i>${s.tag}</i>`);
    $('stage-desc').textContent = s.intro;
    const art = $<HTMLImageElement>('stage-art');
    art.src = assetPath(s.image);
    art.alt = `Ilustração da equipe: ${s.title}`;
    $('review-title').textContent = `Para revisar: ${s.short}`;
    $('review-body').textContent = s.review;
    $('source-note').textContent = page ? `Capítulo na página ${page} do e-book.` : '';
    $<HTMLAnchorElement>('study-current-btn').href = `#/biblioteca/${s.id}`;
    $('stage-page-number').textContent = page ? String(page) : '';
  }

  private switchMode(mode: Mode): void {
    navigate({ view: 'stage', id: this.stage.id, mode }, { replace: true });
  }

  private setMode(mode: Mode): void {
    this.mode = mode;
    this.selected = 0;
    this.showErrors = false;
    this.dragStart = this.dragEnd = this.hintCell = null;
    this.selection = [];
    const s = this.stage;

    $('tab-cross').setAttribute('aria-selected', String(mode === 'cross'));
    $('tab-hunt').setAttribute('aria-selected', String(mode === 'hunt'));
    show($('cross-view'), mode === 'cross');
    show($('hunt-view'), mode === 'hunt');
    show($('fallback'), mode === 'hunt');
    $('clues-title').textContent = mode === 'cross' ? 'Pistas' : 'Palavras escondidas';
    this.announce(this.progress.isDone(s, mode) ? 'Você já terminou este jogo. Pode jogar de novo se quiser.' : '');

    if (mode === 'cross') {
      this.cross = buildCrossword(s.cross);
      const drafts = this.progress.state.drafts[s.id] ?? [];
      this.inputs = this.cross.entries.map((_, i) => drafts[i] ?? '');
      this.renderCross();
    } else {
      this.hunt = buildWordSearch(s.hunt, this.index + 15);
      this.renderHunt();
    }
    this.updateStageStats();
  }

  private updateStageStats(): void {
    const s = this.stage;
    const modes = this.progress.modesDone(s);
    $('stage-progress').textContent =
      modes === 0 ? 'Nenhum jogo concluído' : modes === 1 ? '1 de 2 jogos concluído' : 'Os 2 jogos concluídos';
    $('stage-points').textContent = `${this.progress.stagePoints(s)} pontos`;
    $('cross-flag').textContent = this.progress.isDone(s, 'cross') ? '✓' : '';
    $('hunt-flag').textContent = this.progress.isDone(s, 'hunt') ? '✓' : '';
  }

  private announce(message: string, kind: FeedbackKind = ''): void {
    const fb = $('feedback');
    fb.textContent = message;
    fb.className = `feedback ${kind}`;
  }

  private setProgressBar(done: number, total: number): void {
    $('solved-count').textContent = `${done} de ${total}`;
    $('progress-bar').style.width = `${(done / total) * 100}%`;
    $('progress-bar').parentElement!.setAttribute('aria-valuenow', String(Math.round((done / total) * 100)));
  }

  // ---------------------------------------------------------------- palavras-cruzadas

  private isCorrect(i: number): boolean {
    return normalize(this.inputs[i]) === this.cross!.entries[i].word;
  }

  private saveDraft(): void {
    this.progress.state.drafts[this.stage.id] = [...this.inputs];
    this.progress.save();
  }

  private renderCross(): void {
    const cw = this.cross!;
    const group = (d: 'H' | 'V', title: string): Html => {
      const items = cw.entries.map((e, i) => ({ e, i })).filter(({ e }) => e.d === d);
      if (!items.length) return html``;
      return html`<h3 class="clue-group">${title}</h3>${items.map(
        ({ e, i }) => html`<div class="clue" data-clue="${i}">
          <label for="answer-${i}"><span class="clue-num">${i + 1}</span> ${e.clue} <span class="clue-len">(${e.word.length})</span></label>
          <input id="answer-${i}" class="clue-input" type="text" spellcheck="false" autocomplete="off" autocapitalize="characters"
            maxlength="${e.word.length}" value="${this.inputs[i]}" style="--len:${e.word.length}">
        </div>`
      )}`;
    };
    setHtml(this.clues, html`${group('H', 'Horizontais')}${group('V', 'Verticais')}`);
    this.board.style.gridTemplateColumns = `repeat(${cw.width}, var(--cell))`;
    this.board.style.gridTemplateRows = `repeat(${cw.height}, var(--cell))`;
    // As casas são criadas uma vez; paintCross só atualiza (assim as animações não são interrompidas).
    setHtml(
      this.board,
      html`${cw.cells.map((c) => {
        const starts = c.belongs.filter((i) => cw.entries[i].x === c.x && cw.entries[i].y === c.y).map((i) => i + 1);
        return html`<button type="button" class="cw-cell" data-x="${c.x}" data-y="${c.y}" style="grid-column:${c.x + 1};grid-row:${c.y + 1}">${
          starts.length ? html`<small>${starts[0]}</small>` : ''
        }<span></span></button>`;
      })}`
    );
    this.cellEls = [...this.board.querySelectorAll<HTMLButtonElement>('.cw-cell')];
    this.paintCross();
  }

  private cellEls: HTMLButtonElement[] = [];

  /** Atualiza grade e pistas. `inked` = palavra que acabou de ficar certa (as letras "secam" em sequência). */
  private paintCross(inked?: number): void {
    const cw = this.cross!;
    const correct = cw.entries.map((_, i) => this.isCorrect(i));
    this.setProgressBar(correct.filter(Boolean).length, cw.entries.length);

    cw.entries.forEach((_, i) => {
      const item = this.clues.querySelector(`.clue[data-clue="${i}"]`);
      if (!item) return;
      item.classList.toggle('active', i === this.selected);
      item.classList.toggle('solved', correct[i]);
      item.classList.toggle('wrong', this.showErrors && !correct[i] && !!this.inputs[i]);
    });

    cw.cells.forEach((c, k) => {
      const el = this.cellEls[k];
      const relations = c.belongs.map((i) => cw.entries[i]);
      // Letra mostrada: prioriza a de uma palavra correta.
      let letter = '';
      for (const e of [...relations].sort((a, b) => Number(correct[b.index]) - Number(correct[a.index]))) {
        const ch = this.inputs[e.index][positionIn(e, c.x, c.y)];
        if (ch) {
          letter = ch;
          break;
        }
      }
      const bad =
        this.showErrors &&
        relations.some((e) => {
          const pos = positionIn(e, c.x, c.y);
          const ch = this.inputs[e.index][pos];
          return !!ch && ch !== e.word[pos];
        });
      el.classList.toggle('solved', c.belongs.some((i) => correct[i]));
      el.classList.toggle('active', c.belongs.includes(this.selected));
      el.classList.toggle('has-error', bad);
      // A animação fica na palavra recém-acertada até a próxima ser acertada.
      if (inked !== undefined) {
        if (c.belongs.includes(inked)) {
          el.style.setProperty('--i', String(positionIn(cw.entries[inked], c.x, c.y)));
          replayAnimation(el, 'ink');
        } else {
          el.classList.remove('ink');
        }
      }
      el.lastElementChild!.textContent = letter;
      el.setAttribute('aria-label', `Linha ${c.y + 1}, coluna ${c.x + 1}, ${letter ? `letra ${letter}` : 'vazia'}`);
    });
  }

  private focusAnswer(i: number): void {
    $<HTMLInputElement>(`answer-${i}`).focus();
  }

  private bindCrossword(): void {
    // Clique numa casa: seleciona a pista (num cruzamento, alterna entre as duas).
    this.board.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.cw-cell');
      if (!btn || !this.cross) return;
      const cell = this.cross.cells.find((c) => c.x === Number(btn.dataset.x) && c.y === Number(btn.dataset.y))!;
      const choices = cell.belongs;
      this.selected = choices.includes(this.selected)
        ? choices.length > 1
          ? choices.find((i) => i !== this.selected)!
          : this.selected
        : choices[0];
      this.paintCross();
      this.focusAnswer(this.selected);
    });

    this.clues.addEventListener('focusin', (e) => {
      const i = this.answerIndex(e.target);
      if (i === null || this.mode !== 'cross') return;
      this.selected = i;
      this.paintCross();
    });

    this.clues.addEventListener('input', (e) => {
      const i = this.answerIndex(e.target);
      if (i === null || this.mode !== 'cross') return;
      const input = e.target as HTMLInputElement;
      const wasCorrect = this.isCorrect(i);
      this.inputs[i] = normalize(input.value).slice(0, this.cross!.entries[i].word.length);
      input.value = this.inputs[i];
      this.showErrors = false;
      this.saveDraft();
      this.afterCrossChange(i, wasCorrect);
    });

    this.clues.addEventListener('keydown', (e) => {
      const i = this.answerIndex(e.target);
      if (i === null || e.key !== 'Enter' || this.mode !== 'cross') return;
      e.preventDefault();
      const next = this.cross!.entries.findIndex((_, j) => j > i && !this.isCorrect(j));
      if (next >= 0) this.focusAnswer(next);
      else this.check();
    });
  }

  private answerIndex(target: EventTarget | null): number | null {
    const el = target as HTMLElement;
    return el?.id?.startsWith('answer-') ? Number(el.id.slice(7)) : null;
  }

  /** Depois de digitar ou revelar letra: marca a palavra certa e conclui se tudo estiver certo. */
  private afterCrossChange(i: number, wasCorrect: boolean): void {
    const nowCorrect = this.isCorrect(i);
    this.paintCross(nowCorrect && !wasCorrect ? i : undefined);
    if (!nowCorrect || wasCorrect) return;

    if (this.cross!.entries.every((_, j) => this.isCorrect(j))) {
      this.finish('cross');
    } else {
      this.announce(`${this.cross!.entries[i].word} está certa.`, 'good');
      // Vai para a próxima pista sem resposta certa.
      const next = this.cross!.entries.findIndex((_, j) => j > i && !this.isCorrect(j));
      if (next >= 0 && document.activeElement?.id === `answer-${i}`) this.focusAnswer(next);
    }
  }

  // ---------------------------------------------------------------- caça-palavras

  private huntFound(): number[] {
    return this.progress.state.huntFound[this.stage.id] ?? [];
  }

  private renderHunt(justFound?: number): void {
    const ws = this.hunt!;
    const found = this.huntFound();
    this.huntBoard.style.setProperty('--n', String(ws.n));
    setHtml(
      this.clues,
      html`<ol class="hunt-list">${ws.placed.map((w, i) => {
        const ok = found.includes(i);
        return html`<li class="clue ${ok ? 'solved' : ''}" data-hunt="${i}" data-pick="${i}" tabindex="0">
          <span class="clue-num">${i + 1}</span> <span class="hunt-clue">${w.clue}</span>
          ${ok ? html`<b class="hunt-word">${w.word}</b>` : html`<span class="clue-len">(${w.word.length})</span>`}
        </li>`;
      })}</ol>`
    );
    this.paintHunt(justFound);
  }

  /** Letras + traços de marca-texto (SVG) sobre as palavras encontradas, a seleção e a dica. */
  private paintHunt(justFound?: number): void {
    const ws = this.hunt!;
    const found = this.huntFound();
    this.setProgressBar(found.length, ws.placed.length);

    const center = (i: number) => ({ x: (i % ws.n) + 0.5, y: Math.floor(i / ws.n) + 0.5 });
    const stroke = (coords: number[], cls: string) => {
      const a = center(coords[0]);
      const b = center(coords[coords.length - 1]);
      return html`<line class="${cls}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" pathLength="1"></line>`;
    };
    const marks = [
      ...found.map((i) => stroke(ws.placed[i].coords, i === justFound ? 'mark is-new' : 'mark')),
      this.selection.length ? stroke(this.selection, 'selecting') : '',
      this.hintCell !== null
        ? html`<circle class="hint-ring" cx="${center(this.hintCell).x}" cy="${center(this.hintCell).y}" r="0.42"></circle>`
        : '',
    ];

    setHtml(
      this.huntBoard,
      html`${ws.grid.map(
        (ch, i) => html`<div class="hunt-cell" data-i="${i}" role="gridcell"
          aria-label="Linha ${Math.floor(i / ws.n) + 1}, coluna ${(i % ws.n) + 1}, letra ${ch}">${ch}</div>`
      )}<svg class="hunt-marks" viewBox="0 0 ${ws.n} ${ws.n}" preserveAspectRatio="none" aria-hidden="true">${marks}</svg>`
    );
  }

  private addFound(index: number): void {
    const s = this.stage;
    const found = this.huntFound();
    if (found.includes(index)) {
      this.announce('Essa você já tinha achado.');
      return;
    }
    this.progress.state.huntFound[s.id] = [...found, index];
    this.progress.save();
    this.selection = [];
    this.hintCell = null;
    this.renderHunt(index);
    if (this.huntFound().length === this.hunt!.placed.length) this.finish('hunt');
    else this.announce(`Achou ${this.hunt!.placed[index].word}.`, 'good');
  }

  private bindWordSearch(): void {
    const board = this.huntBoard;
    const cellAt = (ev: PointerEvent): number | null => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('.hunt-cell');
      return el && board.contains(el) ? Number(el.dataset.i) : null;
    };
    const select = (a: number, b: number) => {
      this.selection = linePath(a, b, this.hunt!.n);
      this.paintHunt();
    };

    board.addEventListener('pointerdown', (e) => {
      if (this.mode !== 'hunt') return;
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
      this.validateSelection();
    });
    board.addEventListener('pointercancel', () => {
      this.dragStart = this.dragEnd = null;
      this.selection = [];
      this.paintHunt();
    });

    // Tocar numa pista mostra o tamanho da palavra.
    this.clues.addEventListener('click', (e) => {
      const row = (e.target as HTMLElement).closest<HTMLElement>('[data-pick]');
      if (!row || this.mode !== 'hunt') return;
      const i = Number(row.dataset.pick);
      const w = this.hunt!.placed[i];
      if (!this.huntFound().includes(i)) this.announce(`Pista ${i + 1}: ${w.clue} Tem ${w.word.length} letras.`);
    });
    this.clues.addEventListener('keydown', (e) => {
      const row = (e.target as HTMLElement).closest<HTMLElement>('[data-pick]');
      if (row && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        row.click();
      }
    });

    // Alternativa sem arrastar: escrever a palavra encontrada.
    $<HTMLFormElement>('fallback-form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (this.mode !== 'hunt') return;
      const input = $<HTMLInputElement>('fallback-input');
      const guess = normalize(input.value);
      const i = this.hunt!.placed.findIndex((w, j) => w.word === guess && !this.huntFound().includes(j));
      if (i < 0) {
        this.announce('Essa palavra não está na lista, ou já foi marcada.', 'bad');
        return;
      }
      input.value = '';
      this.addFound(i);
    });
  }

  private validateSelection(): void {
    if (!this.selection.length) return;
    if (this.selection.length < 2) {
      this.selection = [];
      this.paintHunt();
      this.announce('Arraste da primeira até a última letra.');
      return;
    }
    const hit = matchSelection(this.hunt!, this.selection, this.huntFound());
    if (hit >= 0) {
      this.addFound(hit);
    } else {
      this.announce('Essa sequência não é nenhuma das palavras.', 'bad');
      this.selection = [];
      this.paintHunt();
    }
  }

  // ---------------------------------------------------------------- ações

  private giveHint(): void {
    const s = this.stage;
    this.progress.addHint(s, this.mode);
    if (this.mode === 'cross') {
      const cw = this.cross!;
      if (this.isCorrect(this.selected)) {
        this.selected = cw.entries.findIndex((_, i) => !this.isCorrect(i));
        if (this.selected < 0) {
          this.selected = 0;
          this.announce('Todas as respostas já estão certas.');
          return;
        }
      }
      const i = this.selected;
      const word = cw.entries[i].word;
      const typed = normalize(this.inputs[i]);
      let k = 0;
      while (k < word.length && typed[k] === word[k]) k++;
      const wasCorrect = this.isCorrect(i);
      this.inputs[i] = word.slice(0, k + 1);
      $<HTMLInputElement>(`answer-${i}`).value = this.inputs[i];
      this.saveDraft();
      this.announce(`Revelamos uma letra da pista ${i + 1}.`);
      this.afterCrossChange(i, wasCorrect);
      if (!this.modal.isOpen()) this.focusAnswer(i);
    } else {
      const ws = this.hunt!;
      const i = ws.placed.findIndex((_, j) => !this.huntFound().includes(j));
      if (i < 0) {
        this.announce('Você já achou todas as palavras.');
        return;
      }
      const start = ws.placed[i].coords[0];
      this.hintCell = start;
      this.paintHunt();
      this.announce(
        `A palavra da pista ${i + 1} começa na letra circulada (linha ${Math.floor(start / ws.n) + 1}, coluna ${(start % ws.n) + 1}).`
      );
    }
  }

  private check(): void {
    if (this.mode === 'cross') {
      const cw = this.cross!;
      this.showErrors = true;
      this.paintCross();
      const correct = cw.entries.filter((_, i) => this.isCorrect(i)).length;
      if (correct === cw.entries.length) {
        this.finish('cross');
        return;
      }
      this.progress.addMistake(this.stage, 'cross');
      this.announce(
        `${correct} de ${cw.entries.length} certas. As letras erradas ficaram em vermelho (conferir com erro custa 3 pontos).`,
        'bad'
      );
      this.clues.querySelectorAll('.clue.wrong').forEach((el) => replayAnimation(el, 'shake'));
      const i = cw.entries.findIndex((_, j) => !this.isCorrect(j));
      if (i >= 0) this.focusAnswer(i);
    } else {
      const left = this.hunt!.placed.length - this.huntFound().length;
      if (left === 0) this.finish('hunt');
      else this.announce(left === 1 ? 'Falta 1 palavra.' : `Faltam ${left} palavras.`);
    }
  }

  private finish(mode: Mode): void {
    const s = this.stage;
    const nextIndex = this.index + 1 < STAGES.length ? this.index + 1 : null;
    const wasOpen = nextIndex !== null && this.progress.isAvailable(nextIndex);
    const { award, best, wasDone } = this.progress.finish(s, mode);
    const unlocked = nextIndex !== null && !wasOpen && this.progress.isAvailable(nextIndex);
    this.updateStageStats();
    this.onProgress(unlocked ? nextIndex! : undefined);

    const other: Mode = mode === 'cross' ? 'hunt' : 'cross';
    const otherDone = this.progress.isDone(s, other);
    this.modal.show({
      title: s.title,
      message: mode === 'cross' ? 'Você completou as palavras-cruzadas.' : 'Você achou todas as palavras.',
      points: wasDone ? best : award,
      recordOnly: wasDone,
      unlocked: unlocked ? `Fase ${nextIndex! + 1} liberada: ${STAGES[nextIndex!].title}.` : undefined,
      nextLabel: nextIndex !== null ? 'Próxima fase' : 'Voltar ao sumário',
      otherLabel: otherDone ? null : mode === 'cross' ? 'Jogar o caça-palavras' : 'Jogar as palavras-cruzadas',
      onNext: () =>
        nextIndex !== null ? navigate({ view: 'stage', id: STAGES[nextIndex].id, mode: 'cross' }) : navigate({ view: 'home' }),
      onOther: () => this.switchMode(other),
      onMap: () => navigate({ view: 'home' }),
    });
  }

  private restart(): void {
    if (!confirm('Apagar as respostas deste jogo? Seus pontos e as fases liberadas continuam.')) return;
    this.progress.restart(this.stage, this.mode);
    this.setMode(this.mode);
    this.announce('Jogo recomeçado.');
  }
}
