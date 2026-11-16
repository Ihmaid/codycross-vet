import { Mode } from '../core/types';

export type LibraryTab = 'acervo' | 'caderno' | 'references';

export type Route =
  | { view: 'home' }
  | { view: 'stage'; id: string; mode: Mode }
  | { view: 'library'; tab: LibraryTab; id?: string }
  | { view: 'competition'; code?: string };

/**
 * Rotas por "#" (funcionam em qualquer hospedagem estática, sem configurar o servidor):
 *   #/                       mapa de fases
 *   #/fase/raiva             palavras-cruzadas da fase
 *   #/fase/raiva/caca-palavras
 *   #/biblioteca[/raiva]     acervo (opcionalmente aberto em um tema)
 *   #/caderno  #/referencias
 *   #/competicao             criar ou entrar numa sala
 *   #/sala/ABC23             link da sala (para a turma entrar)
 */
export function parseRoute(hash: string): Route {
  const [section, id, extra] = decodeURIComponent(hash.replace(/^#\/?/, '')).split('/').filter(Boolean);
  switch (section) {
    case 'fase':
      return id ? { view: 'stage', id, mode: extra === 'caca-palavras' ? 'hunt' : 'cross' } : { view: 'home' };
    case 'biblioteca':
      return { view: 'library', tab: 'acervo', id };
    case 'caderno':
      return { view: 'library', tab: 'caderno' };
    case 'referencias':
      return { view: 'library', tab: 'references' };
    case 'competicao':
      return { view: 'competition' };
    case 'sala':
      return { view: 'competition', code: id };
    default:
      return { view: 'home' };
  }
}

export function routeHref(route: Route): string {
  switch (route.view) {
    case 'home':
      return '#/';
    case 'stage':
      return `#/fase/${route.id}${route.mode === 'hunt' ? '/caca-palavras' : ''}`;
    case 'library':
      if (route.tab === 'caderno') return '#/caderno';
      if (route.tab === 'references') return '#/referencias';
      return route.id ? `#/biblioteca/${route.id}` : '#/biblioteca';
    case 'competition':
      return route.code ? `#/sala/${route.code}` : '#/competicao';
  }
}

/** Vai para a rota. `replace` troca o endereço sem criar entrada no histórico (ex.: trocar de modalidade). */
export function navigate(route: Route, { replace = false } = {}): void {
  const href = routeHref(route);
  if (location.hash === href) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else if (replace) {
    history.replaceState(null, '', href);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    location.hash = href;
  }
}
