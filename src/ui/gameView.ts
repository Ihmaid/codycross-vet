import { assetPath, STAGES } from '../core/content';
import { buildCrossword, Crossword, CrossEntry, positionIn } from '../core/crossword';
import { Progress, starsFor } from '../core/progress';
import { normalize } from '../core/text';
import { Mode, Stage } from '../core/types';
import { buildWordSearch, linePath, matchSelection, WordSearch } from '../core/wordSearch';
import { $, html, replayAnimation, setHtml, show } from './dom';
import { navigate } from './router';
import { WinModal } from './winModal';

type FeedbackKind = '' | 'good' | 'bad';

const MODE_TEXT = {
  cross: {
    kicker: 'CONEXÕES LIVRES',
    title: 'Palavras-cruzadas',
    icon: '✣',
    desc: 'As palavras se cruzam em diferentes pontos. O nome da doença não limita a quantidade de questões.',
    clues: 'Responda às perguntas',
    check: 'Conferir respostas',
  },
  hunt: {
    kicker: 'ENCONTRE OS TERMOS',
    title: 'Caça-palavras',
    icon: '▦',
    desc: 'Procure os termos relacionados ao tema e marque cada palavra no tabuleiro.',
    clues: 'Encontre as palavras',
    check: 'Conferir progresso',
  },
};

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
  private readonly modal: WinModal;

  constructor(
    private readonly progress: Progress,
    /** Avisa o app que o progresso mudou (cabeçalho, mapa). */
    private readonly onProgress: (unlockedIndex?: number) => void
  ) {
    this.modal = new WinModal();
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
    $('crumb-stage').textContent = s.short;
    $('stage-badge').textContent = `FASE ${String(this.index + 1).padStart(2, '0')} · ${s.tag.toUpperCase()}`;
    $('stage-title').textContent = s.title;
    $('stage-desc').textContent = s.description;
    const art = $<HTMLImageElement>('stage-art');
    art.src = assetPath(s.image);
    art.alt = `Ilustração autoral: ${s.title}`;
    $('review-title').textContent = `O que revisar: ${s.short}`;
    $('review-body').textContent = s.review;
    $('source-note').textContent = s.source;
    $<HTMLAnchorElement>('study-current-btn').href = `#/biblioteca/${s.id}`;
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
    const text = MODE_TEXT[mode];

    $('tab-cross').setAttribute('aria-selected', String(mode === 'cross'));
    $('tab-hunt').setAttribute('aria-selected', String(mode === 'hunt'));
    show($('cross-view'), mode === 'cross');
    show($('hunt-view'), mode === 'hunt');
    show($('fallback'), mode === 'hunt');
    $('mode-kicker').textContent = text.kicker;
    $('mode-title').textContent = text.title;
    $('mode-icon').textContent = text.icon;
    $('mode-desc').textContent = text.desc;
    $('clues-title').textContent = text.clues;
    $('check-btn').textContent = text.check;
    this.announce(
      this.progress.isDone(s, mode)
        ? 'Você já concluiu esta modalidade. Pode revisá-la ou reiniciar para jogar novamente.'
        : 'Selecione uma pista e comece a jogar.'
    );

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
    $('stage-progress').textContent = `${this.progress.modesDone(s)} / 2 modalidades`;
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
    $('solved-count').textContent = `${done} / ${total}`;
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
    setHtml(
      this.clues,
      html`${cw.entries.map(
        (e, i) => html`<div class="clue" data-clue="${i}">
          <div class="clue-header"><span class="clue-num">${i + 1}</span><p class="clue-text">${e.clue}</p></div>
          <div class="clue-meta">${e.d === 'H' ? '→ HORIZONTAL' : '↓ VERTICAL'} · ${e.word.length} letras</div>
          <input id="answer-${i}" class="clue-input" type="text" spellcheck="false" autocomplete="off" autocapitalize="characters"
            maxlength="${e.word.length}" aria-label="Resposta da pista ${i + 1}" value="${this.inputs[i]}" placeholder="Digite a resposta">
        </div>`
      )}`
    );
    this.board.style.gridTemplateColumns = `repeat(${cw.width}, var(--cell))`;
    this.board.style.gridTemplateRows = `repeat(${cw.height}, var(--cell))`;
    this.paintCross();
  }

  /** Atualiza grade e pistas. `celebrate` = índice da palavra que acabou de ficar correta. */
  private paintCross(celebrate?: number): void {
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

    setHtml(
      this.board,
      html`${cw.cells.map((c) => {
        const relations = c.belongs.map((i) => cw.entries[i]);
        const good = c.belongs.some((i) => correct[i]);
        const chosen = c.belongs.includes(this.selected);
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
            return ch && ch !== e.word[pos];
          });
        const starts = relations.filter((e) => e.x === c.x && e.y === c.y).map((e) => e.index + 1);
        const pop = celebrate !== undefined && c.belongs.includes(celebrate);
        const order = pop ? positionIn(cw.entries[celebrate!], c.x, c.y) : 0;
        const classes = [
          'cw-cell',
          good ? 'solved' : letter ? 'has-letter' : '',
          chosen && 'active',
          bad && 'has-error',
          pop && 'pop',
        ].filter(Boolean).join(' ');
        return html`<button type="button" class="${classes}" data-x="${c.x}" data-y="${c.y}"
          aria-label="Casa ${c.y + 1}, ${c.x + 1}${letter ? `, letra ${letter}` : ''}"
          style="grid-column:${c.x + 1};grid-row:${c.y + 1};--i:${order}">${starts.length ? html`<small>${starts[0]}</small>` : ''}${letter}</button>`;
      })}`
    );
  }

  private focusAnswer(i: number): void {
    $<HTMLInputElement>(`answer-${i}`).focus();
  }

  private bindCrossword(): void {
    // Clique numa casa: seleciona a pista (alternando entre as duas num cruzamento).
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

  /** Depois de digitar ou revelar letra: comemora a palavra certa e conclui se tudo estiver certo. */
  private afterCrossChange(i: number, wasCorrect: boolean): void {
    const nowCorrect = this.isCorrect(i);
    this.paintCross(nowCorrect && !wasCorrect ? i : undefined);
    if (!nowCorrect || wasCorrect) return;

    const entry: CrossEntry = this.cross!.entries[i];
    const clue = this.clues.querySelector(`.clue[data-clue="${i}"]`);
    if (clue) replayAnimation(clue, 'pop');
    if (this.cross!.entries.every((_, j) => this.isCorrect(j))) {
      this.finish('cross');
    } else {
      this.announce(`✓ ${entry.word} — resposta correta!`, 'good');
    }
  }

  // ---------------------------------------------------------------- caça-palavras

  private huntFound(): number[] {
    return this.progress.state.huntFound[this.stage.id] ?? [];
  }

  private renderHunt(celebrate?: number): void {
    const ws = this.hunt!;
    const found = this.huntFound();
    this.huntBoard.style.setProperty('--n', String(ws.n));
    setHtml(
      this.clues,
      html`${ws.placed.map((w, i) => {
        const ok = found.includes(i);
        return html`<div class="clue ${ok ? 'solved' : ''}" data-hunt="${i}">
          <div class="hunt-row" role="button" tabindex="0" data-pick="${i}"><span class="clue-num">${i + 1}</span>
            <div class="clue-text">${w.clue}<div class="hunt-answer">
              <span class="hunt-word ${ok ? '' : 'hidden-word'}">${ok ? w.word : '• '.repeat(w.word.length)}</span>
              <span class="found-check">${ok ? '✓' : ''}</span></div></div>
          </div></div>`;
      })}`
    );
    this.paintHunt(celebrate);
  }

  private paintHunt(celebrate?: number): void {
    const ws = this.hunt!;
    const found = this.huntFound();
    const foundCells = new Set(found.flatMap((i) => ws.placed[i].coords));
    const popCells = celebrate !== undefined ? ws.placed[celebrate].coords : [];
    this.setProgressBar(found.length, ws.placed.length);
    setHtml(
      this.huntBoard,
      html`${ws.grid.map((ch, i) => {
        const pop = popCells.indexOf(i);
        const classes = [
          'hunt-cell',
          foundCells.has(i) && 'found',
          this.selection.includes(i) && 'path',
          this.hintCell === i && 'hinted',
          pop >= 0 && 'pop',
        ].filter(Boolean).join(' ');
        return html`<div class="${classes}" data-i="${i}" role="gridcell" style="--i:${Math.max(0, pop)}"
          aria-label="Linha ${Math.floor(i / ws.n) + 1}, coluna ${(i % ws.n) + 1}, letra ${ch}">${ch}</div>`;
      })}`
    );
  }

  private addFound(index: number): void {
    const s = this.stage;
    const found = this.huntFound();
    if (found.includes(index)) {
      this.announce('Essa palavra já foi encontrada.');
      return;
    }
    this.progress.state.huntFound[s.id] = [...found, index];
    this.progress.save();
    this.selection = [];
    this.hintCell = null;
    this.renderHunt(index);
    const clue = this.clues.querySelector(`.clue[data-hunt="${index}"]`);
    if (clue) replayAnimation(clue, 'pop');
    if (this.huntFound().length === this.hunt!.placed.length) this.finish('hunt');
    else this.announce(`✓ Palavra encontrada: ${this.hunt!.placed[index].word}!`, 'good');
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

    // Tocar numa pista mostra a definição completa.
    this.clues.addEventListener('click', (e) => {
      const row = (e.target as HTMLElement).closest<HTMLElement>('[data-pick]');
      if (!row || this.mode !== 'hunt') return;
      const i = Number(row.dataset.pick);
      const w = this.hunt!.placed[i];
      this.announce(`Pista ${i + 1}: ${w.clue} · ${w.word.length} letras.`);
    });
    this.clues.addEventListener('keydown', (e) => {
      const row = (e.target as HTMLElement).closest<HTMLElement>('[data-pick]');
      if (row && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        row.click();
      }
    });

    // Alternativa acessível: digitar a palavra encontrada.
    $<HTMLFormElement>('fallback-form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (this.mode !== 'hunt') return;
      const input = $<HTMLInputElement>('fallback-input');
      const guess = normalize(input.value);
      const i = this.hunt!.placed.findIndex((w, j) => w.word === guess && !this.huntFound().includes(j));
      if (i < 0) {
        this.announce('Palavra não encontrada ou já marcada. Confira as pistas e tente novamente.', 'bad');
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
      this.announce('Arraste da primeira até a última letra da palavra, em linha reta.');
      return;
    }
    const hit = matchSelection(this.hunt!, this.selection, this.huntFound());
    if (hit >= 0) {
      this.addFound(hit);
    } else {
      this.announce('Essa sequência não corresponde a uma das palavras procuradas. Tente outra direção.', 'bad');
      this.selection = [];
      this.paintHunt();
      replayAnimation(this.huntBoard, 'shake');
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
          this.announce('Todas as respostas já estão corretas.');
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
      this.announce(`Dica: uma letra da pista ${i + 1} foi revelada.`);
      this.afterCrossChange(i, wasCorrect);
      if (!this.modal.isOpen()) this.focusAnswer(i);
    } else {
      const ws = this.hunt!;
      const i = ws.placed.findIndex((_, j) => !this.huntFound().includes(j));
      if (i < 0) {
        this.announce('Você já encontrou todas as palavras.');
        return;
      }
      const start = ws.placed[i].coords[0];
      this.hintCell = start;
      this.paintHunt();
      this.announce(
        `Dica: a palavra da pista ${i + 1} começa na linha ${Math.floor(start / ws.n) + 1}, coluna ${(start % ws.n) + 1}.`
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
      this.announce(`${correct} de ${cw.entries.length} respostas corretas. Revise as pistas e tente novamente.`, 'bad');
      this.clues.querySelectorAll('.clue.wrong').forEach((el) => replayAnimation(el, 'shake'));
      const i = cw.entries.findIndex((_, j) => !this.isCorrect(j));
      if (i >= 0) this.focusAnswer(i);
    } else {
      const n = this.huntFound().length;
      const total = this.hunt!.placed.length;
      if (n === total) this.finish('hunt');
      else this.announce(`Você encontrou ${n} de ${total} palavras. Continue procurando!`);
    }
  }

  private finish(mode: Mode): void {
    const s = this.stage;
    const nextUnlockedBefore = this.index + 1 < STAGES.length && this.progress.isAvailable(this.index + 1);
    const { award, best, wasDone } = this.progress.finish(s, mode);
    const nextIndex = this.index + 1 < STAGES.length ? this.index + 1 : null;
    const unlocked = nextIndex !== null && !nextUnlockedBefore && this.progress.isAvailable(nextIndex);
    this.updateStageStats();
    this.onProgress(unlocked ? nextIndex! : undefined);

    const other: Mode = mode === 'cross' ? 'hunt' : 'cross';
    this.modal.show({
      title: `Você concluiu ${s.short}!`,
      message:
        mode === 'cross'
          ? 'Todas as respostas foram resolvidas e conectadas corretamente.'
          : 'Você encontrou todos os termos escondidos no tabuleiro.',
      points: wasDone ? best : award,
      pointsLabel: wasDone ? 'Recorde nesta modalidade' : 'Pontos conquistados',
      stars: starsFor(award),
      unlocked: unlocked ? STAGES[nextIndex!].title : undefined,
      otherLabel: mode === 'cross' ? 'Experimentar caça-palavras' : 'Experimentar palavras-cruzadas',
      nextLabel: nextIndex !== null ? 'Próxima fase →' : 'Voltar ao mapa →',
      onOther: () => this.switchMode(other),
      onNext: () =>
        nextIndex !== null ? navigate({ view: 'stage', id: STAGES[nextIndex].id, mode: 'cross' }) : navigate({ view: 'home' }),
      onMap: () => navigate({ view: 'home' }),
    });
  }

  private restart(): void {
    if (!confirm('Limpar as respostas desta modalidade? A pontuação conquistada e o desbloqueio das fases serão mantidos.')) return;
    this.progress.restart(this.stage, this.mode);
    this.setMode(this.mode);
    this.announce('Atividade reiniciada. Seu recorde anterior foi preservado.');
  }
}
