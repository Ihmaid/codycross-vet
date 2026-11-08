import { assetPath, FAMILIES, PDF_PATH, REFERENCES, stageIndex, STAGES, STUDY } from '../core/content';
import { createBackup, MAX_BACKUP_BYTES, Notebook, parseBackup } from '../core/notebook';
import { Progress } from '../core/progress';
import { normalize } from '../core/text';
import { $, html, setHtml, show } from './dom';
import { LibraryTab, navigate } from './router';

/** Junta itens em português: "a", "a e b", "a, b e c". */
function joinPt(items: string[]): string {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Biblioteca: capítulos do e-book, caderno pessoal e referências. */
export class LibraryView {
  private active = 0;
  private readonly search = $<HTMLInputElement>('library-search');
  private readonly family = $<HTMLSelectElement>('library-family');
  private readonly onlyFavorites = $<HTMLInputElement>('library-only-favorites');
  private readonly onlyPending = $<HTMLInputElement>('library-only-pending');
  private readonly list = $('library-list');
  private readonly article = $('library-article');

  constructor(
    private readonly progress: Progress,
    private readonly notebook: Notebook,
    /** Avisa o app que o progresso foi substituído (importação). */
    private readonly onProgressReplaced: () => void
  ) {
    for (const name of FAMILIES) this.family.add(new Option(name, name));
    for (const el of [this.search, this.family, this.onlyFavorites, this.onlyPending]) {
      el.addEventListener(el === this.search ? 'input' : 'change', () => this.renderList());
    }
    this.list.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-lib]');
      if (btn) navigate({ view: 'library', tab: 'acervo', id: btn.dataset.lib }, { replace: true });
    });
    $('study-dashboard-list').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-study]');
      if (btn) navigate({ view: 'library', tab: 'acervo', id: btn.dataset.study });
    });
    $('study-export').addEventListener('click', () => this.exportBackup());
    $<HTMLInputElement>('study-import').addEventListener('change', (e) => {
      const input = e.target as HTMLInputElement;
      this.importBackup(input.files?.[0]).finally(() => (input.value = ''));
    });
  }

  /** Abre a aba pedida (e o capítulo, se informado). */
  open(tab: LibraryTab, id?: string): void {
    if (id && stageIndex(id) >= 0) this.active = stageIndex(id);
    for (const name of ['acervo', 'caderno', 'references'] as const) {
      show($(`lib-${name}`), name === tab);
      const link = $(`lib-tab-${name}`);
      if (name === tab) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    $('library-crumb').textContent =
      tab === 'acervo' ? STAGES[this.active].short : tab === 'caderno' ? 'Meu caderno' : 'Referências';
    if (tab === 'acervo') {
      this.renderList();
      this.renderArticle();
    } else if (tab === 'caderno') {
      this.renderNotebook();
    } else {
      this.renderReferences();
    }
  }

  private renderList(): void {
    const q = normalize(this.search.value);
    const family = this.family.value;
    const nb = this.notebook;
    const filtered = STAGES.map((s, i) => ({ s, i })).filter(
      ({ s }) =>
        (!family || s.tag === family) &&
        (!this.onlyFavorites.checked || nb.isFavorite(s.id)) &&
        (!this.onlyPending.checked || !nb.isReviewed(s.id)) &&
        (!q || normalize([s.title, s.short, s.tag, STUDY[s.id]?.text ?? ''].join(' ')).includes(q))
    );
    $('library-count').textContent =
      filtered.length === STAGES.length ? `${STAGES.length} capítulos` : `${filtered.length} de ${STAGES.length} capítulos`;
    setHtml(
      this.list,
      filtered.length
        ? html`${filtered.map(
            ({ s, i }) => html`<button type="button" class="${i === this.active ? 'active' : ''}" data-lib="${s.id}" aria-current="${i === this.active ? 'page' : 'false'}">
              <img src="${assetPath(s.image)}" alt="" loading="lazy"><span>${s.title}</span>${
                nb.isFavorite(s.id) ? html`<b title="Favorito" aria-label="favorito">★</b>` : ''
              }${nb.isReviewed(s.id) ? html`<b title="Revisado" aria-label="revisado">✓</b>` : ''}</button>`
          )}`
        : html`<p class="library-empty">Nenhum capítulo com esses filtros.</p>`
    );
  }

  private renderArticle(): void {
    const s = STAGES[this.active];
    const entry = STUDY[s.id];
    const nb = this.notebook;
    if (!entry) {
      this.article.textContent = 'Não encontramos as páginas deste capítulo.';
      return;
    }
    const pages = joinPt(entry.pages.map(String));
    setHtml(
      this.article,
      html`<header class="article-head">
          <img src="${assetPath(s.image)}" alt="">
          <div><h2>${s.title} <i>${s.tag}</i></h2><p>${entry.pages.length > 1 ? 'Páginas' : 'Página'} ${pages} do e-book</p></div>
        </header>
        <div class="article-actions">
          <button type="button" class="button" id="lib-play">Jogar esta fase</button>
          <a href="${PDF_PATH}#page=${entry.pages[0]}" target="_blank" rel="noopener">Abrir no PDF</a>
        </div>
        ${entry.images.map(
          (path, i) => html`<figure class="ebook-page"><img src="${path}" loading="lazy" alt="Página ${entry.pages[i]} do e-book: ${s.title}"></figure>`
        )}
        <section class="study-tools">
          <h3>Seu estudo</h3>
          <div class="study-toggle-row">
            <button id="lib-favorite" type="button" class="button button-quiet" aria-pressed="${nb.isFavorite(s.id)}">${nb.isFavorite(s.id) ? '★ Favorito' : '☆ Marcar como favorito'}</button>
            <button id="lib-reviewed" type="button" class="button button-quiet" aria-pressed="${nb.isReviewed(s.id)}">${nb.isReviewed(s.id) ? '✓ Revisado' : 'Marcar como revisado'}</button>
          </div>
          <label for="lib-notes">Anotações</label>
          <textarea id="lib-notes" rows="5" maxlength="10000" placeholder="Dúvidas, coisas para lembrar na prova...">${nb.note(s.id)}</textarea>
          <p id="lib-notes-status" role="status" class="small">Salvo automaticamente neste navegador.</p>
        </section>
        <section class="recall">
          <h3>Teste sua memória</h3>
          <p class="small">Três pistas do jogo desta fase. Tente lembrar antes de ver a resposta.</p>
          <ol>${s.cross.slice(0, 3).map(
            ([answer, clue]) => html`<li><p>${clue}</p>
              <button class="recall-answer" type="button" aria-expanded="false" data-answer="${answer}">Ver resposta</button></li>`
          )}</ol>
        </section>
        <details class="transcript"><summary>Ver o texto destas páginas</summary><div class="library-text">${entry.text}</div></details>`
    );

    $('lib-play').addEventListener('click', () => {
      // Estudar é livre: se a fase estiver bloqueada, libera todas para poder jogá-la.
      if (!this.progress.isAvailable(this.active)) {
        this.progress.state.explore = true;
        this.progress.save();
      }
      navigate({ view: 'stage', id: s.id, mode: 'cross' });
    });
    $('lib-favorite').addEventListener('click', () => {
      nb.toggleFavorite(s.id);
      this.renderList();
      this.renderArticle();
    });
    $('lib-reviewed').addEventListener('click', () => {
      nb.toggleReviewed(s.id);
      this.renderList();
      this.renderArticle();
    });
    $('lib-notes').addEventListener('input', (e) => {
      nb.setNote(s.id, (e.target as HTMLTextAreaElement).value);
      $('lib-notes-status').textContent = 'Salvo.';
    });
    this.article.querySelectorAll<HTMLButtonElement>('.recall-answer').forEach((btn) =>
      btn.addEventListener('click', () => {
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!expanded));
        btn.textContent = expanded ? 'Ver resposta' : btn.dataset.answer!;
      })
    );
  }

  private renderNotebook(): void {
    const nb = this.notebook;
    const reviewed = nb.count(STAGES, 'reviewed');
    const favorites = nb.count(STAGES, 'favorites');
    const withNotes = STAGES.filter((s) => nb.hasNote(s.id)).length;
    const finished = this.progress.finishedCount();

    const parts = [
      reviewed && `revisou ${plural(reviewed, 'capítulo', 'capítulos')}`,
      favorites && `marcou ${plural(favorites, 'favorito', 'favoritos')}`,
      withNotes && `tem anotações em ${plural(withNotes, 'capítulo', 'capítulos')}`,
    ].filter(Boolean) as string[];
    $('study-summary').textContent = parts.length
      ? `Até agora você ${joinPt(parts)}. No jogo, concluiu ${plural(finished, 'fase', 'fases')} de ${STAGES.length}.`
      : 'Seu caderno ainda está vazio. Na biblioteca, marque capítulos como favoritos ou revisados e escreva anotações; eles aparecem aqui.';

    const saved = STAGES.filter((s) => nb.isFavorite(s.id) || nb.isReviewed(s.id) || nb.hasNote(s.id));
    setHtml(
      $('study-dashboard-list'),
      html`${saved.map((s) => {
        const tags = [nb.isFavorite(s.id) && 'favorito', nb.isReviewed(s.id) && 'revisado'].filter(Boolean) as string[];
        return html`<button class="notebook-item" type="button" data-study="${s.id}"><img src="${assetPath(s.image)}" alt="">
          <span><b>${s.title}</b>${tags.length ? html` <small>${joinPt(tags)}</small>` : ''}
          ${nb.hasNote(s.id) ? html`<span class="note-snippet">${nb.note(s.id).slice(0, 140)}</span>` : ''}</span></button>`;
      })}`
    );
  }

  private renderReferences(): void {
    setHtml(
      $('reference-pages'),
      html`${REFERENCES.map(
        (r) => html`<figure class="ebook-page"><img src="${r.image}" loading="lazy" alt="Referências bibliográficas, página ${r.page} do e-book"></figure>`
      )}`
    );
    $('references-text').textContent = REFERENCES.map((r) => `Página ${r.page}\n${r.text}`).join('\n\n');
  }

  private exportBackup(): void {
    const payload = createBackup(this.progress.state, this.notebook.state);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'virologia-em-jogo-meu-estudo.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  private async importBackup(file: File | undefined): Promise<void> {
    if (!file) return;
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('o arquivo é grande demais.');
      const { game, caderno } = parseBackup(await file.text());
      if (!confirm('Importar este arquivo vai substituir o progresso e as anotações deste navegador. Continuar?')) return;
      this.progress.state = game;
      this.notebook.state = caderno;
      this.progress.save();
      this.notebook.save();
      this.onProgressReplaced();
      this.renderNotebook();
      alert('Pronto, progresso e anotações importados.');
    } catch (e) {
      alert(`Não deu para importar: ${(e as Error).message}`);
    }
  }
}
