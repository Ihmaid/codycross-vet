import { assetPath, FAMILIES, PDF_PATH, REFERENCES, stageIndex, STAGES, STUDY } from '../core/content';
import { createBackup, MAX_BACKUP_BYTES, Notebook, parseBackup } from '../core/notebook';
import { Progress } from '../core/progress';
import { normalize } from '../core/text';
import { $, html, setHtml, show } from './dom';
import { LibraryTab, navigate } from './router';

/** Biblioteca: acervo do e-book, caderno pessoal e referências. */
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

  /** Abre a aba pedida (e o tema, se informado). */
  open(tab: LibraryTab, id?: string): void {
    if (id && stageIndex(id) >= 0) this.active = stageIndex(id);
    for (const name of ['acervo', 'caderno', 'references'] as const) {
      show($(`lib-${name}`), name === tab);
      const link = $(`lib-tab-${name}`);
      if (name === tab) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    $('library-crumb').textContent = tab === 'acervo' ? STAGES[this.active].short : tab === 'caderno' ? 'Meu caderno' : 'Referências';
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
    $('library-count').textContent = `${filtered.length} de ${STAGES.length} temas exibidos`;
    setHtml(
      this.list,
      filtered.length
        ? html`${filtered.map(
            ({ s, i }) => html`<button type="button" class="${i === this.active ? 'active' : ''}" data-lib="${s.id}" aria-current="${i === this.active ? 'page' : 'false'}">
              <img src="${assetPath(s.image)}" alt="" loading="lazy"><span>${s.title}${nb.isFavorite(s.id) ? html` <b aria-label="Favorito">★</b>` : ''}${
                nb.isReviewed(s.id) ? html` <b aria-label="Revisado">✓</b>` : ''
              }</span></button>`
          )}`
        : html`<p class="library-empty">Nenhum resultado. Modifique os filtros.</p>`
    );
  }

  private renderArticle(): void {
    const s = STAGES[this.active];
    const entry = STUDY[s.id];
    const nb = this.notebook;
    if (!entry) {
      this.article.textContent = 'Não foi possível localizar as páginas deste capítulo.';
      return;
    }
    setHtml(
      this.article,
      html`<div class="library-article-head"><img src="${assetPath(s.image)}" alt="Ilustração original de ${s.title}">
          <div><span class="eyebrow">${s.tag}</span><h2>${s.title}</h2><p class="meta">E-book original · ${entry.pages.map((n) => `página ${n}`).join(' e ')}</p></div></div>
        <p class="library-note">As páginas e a transcrição abaixo reproduzem o e-book fornecido pela equipe. As perguntas de revisão reutilizam pistas já presentes no jogo. Este acervo não representa uma atualização científica automática do material.</p>
        <div class="library-actions">
          <button type="button" id="lib-play">✣ Jogar este tema →</button>
          <a class="reference-pdf-link" href="${PDF_PATH}#page=${entry.pages[0]}" target="_blank" rel="noopener">↗ Abrir no PDF original</a>
        </div>
        <div class="study-tools">
          <div><h3>Caderno de revisão</h3><p class="meta">Seu registro pessoal de estudo deste assunto.</p></div>
          <div class="study-toggle-row">
            <button id="lib-favorite" type="button" class="secondary" aria-pressed="${nb.isFavorite(s.id)}">${nb.isFavorite(s.id) ? '★ Remover favorito' : '☆ Salvar favorito'}</button>
            <button id="lib-reviewed" type="button" class="secondary" aria-pressed="${nb.isReviewed(s.id)}">${nb.isReviewed(s.id) ? '✓ Revisado · desfazer' : '○ Marcar revisado'}</button>
          </div>
          <label for="lib-notes">Minhas anotações (somente neste navegador)</label>
          <textarea id="lib-notes" rows="4" maxlength="10000" placeholder="Escreva aqui dúvidas, conceitos para retomar ou observações sobre ${s.short}.">${nb.note(s.id)}</textarea>
          <p id="lib-notes-status" role="status" class="meta">Salvo automaticamente neste dispositivo. Use o backup em Meu caderno para não perder anotações.</p>
        </div>
        <div class="recall-box"><span class="eyebrow">REVISÃO ATIVA</span><h3>Teste sua lembrança</h3>
          <p class="meta">Três pistas já existentes na fase de ${s.short}. Revele cada resposta quando quiser; isto não modifica sua pontuação no jogo.</p>
          ${s.cross.slice(0, 3).map(
            ([answer, clue], i) => html`<div class="recall-item"><p><b>${i + 1}.</b> ${clue}</p>
              <button class="recall-answer" type="button" aria-expanded="false" data-answer="${answer}">Revelar resposta</button></div>`
          )}
        </div>
        <h3>Revisão ilustrada do e-book</h3>
        ${entry.images.map(
          (path, i) => html`<figure><img class="library-image" src="${path}" loading="lazy" alt="Página original ${entry.pages[i]} do e-book: ${s.title}">
            <figcaption class="meta">Página ${entry.pages[i]} do PDF original · ilustração e texto originais</figcaption></figure>`
        )}
        <details><summary>Consultar transcrição pesquisável destas páginas</summary>
          <p class="library-note">Transcrição obtida automaticamente do PDF para facilitar a busca; confira a imagem original acima em caso de divergência.</p>
          <div class="library-text">${entry.text}</div></details>`
    );

    $('lib-play').addEventListener('click', () => {
      // Estudar é livre: se a fase estiver bloqueada, liga o modo exploração para poder jogá-la.
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
      $('lib-notes-status').textContent = 'Anotação salva neste navegador.';
    });
    this.article.querySelectorAll<HTMLButtonElement>('.recall-answer').forEach((btn) =>
      btn.addEventListener('click', () => {
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!expanded));
        btn.textContent = expanded ? 'Revelar resposta' : btn.dataset.answer!;
      })
    );
  }

  private renderNotebook(): void {
    const nb = this.notebook;
    const withNotes = STAGES.filter((s) => nb.hasNote(s.id)).length;
    setHtml(
      $('study-summary'),
      html`${[
        ['Revisados', nb.count(STAGES, 'reviewed')],
        ['Favoritos', nb.count(STAGES, 'favorites')],
        ['Com anotações', withNotes],
        ['Fases concluídas', this.progress.finishedCount()],
      ].map(([label, num]) => html`<div><b>${num}</b><span>${label}</span></div>`)}`
    );
    const saved = STAGES.filter((s) => nb.isFavorite(s.id) || nb.isReviewed(s.id) || nb.hasNote(s.id));
    setHtml(
      $('study-dashboard-list'),
      saved.length
        ? html`${saved.map(
            (s) => html`<button class="study-saved-item" type="button" data-study="${s.id}"><img src="${assetPath(s.image)}" alt="">
              <span><b>${s.title}</b><small>${nb.isFavorite(s.id) ? '★ Favorito · ' : ''}${nb.isReviewed(s.id) ? '✓ Revisado · ' : ''}${nb.hasNote(s.id) ? '✎ Anotação' : ''}</small>
              <small class="note-snippet">${nb.note(s.id).slice(0, 110)}</small></span><strong>Reabrir →</strong></button>`
          )}`
        : html`<div class="library-empty">Seu caderno ainda está vazio. Abra uma revisão, salve um favorito ou faça uma anotação para começar.</div>`
    );
  }

  private renderReferences(): void {
    setHtml(
      $('reference-pages'),
      html`${REFERENCES.map(
        (r) => html`<figure><img class="library-image" src="${r.image}" loading="lazy" alt="Referências bibliográficas do e-book, página ${r.page}">
          <figcaption class="meta">Referências do e-book, página ${r.page} do PDF</figcaption></figure>`
      )}`
    );
    $('references-text').textContent = REFERENCES.map((r) => `PÁGINA ${r.page} DO PDF\n${r.text}`).join('\n\n');
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
      if (file.size > MAX_BACKUP_BYTES) throw new Error('Arquivo muito grande.');
      const { game, caderno } = parseBackup(await file.text());
      if (!confirm('Importar este backup substituirá as notas e o progresso atuais neste navegador. Deseja continuar?')) return;
      this.progress.state = game;
      this.notebook.state = caderno;
      this.progress.save();
      this.notebook.save();
      this.onProgressReplaced();
      this.renderNotebook();
      alert('Backup restaurado. Seu progresso e caderno estão disponíveis.');
    } catch (e) {
      alert(`Não foi possível importar: ${(e as Error).message}`);
    }
  }
}
