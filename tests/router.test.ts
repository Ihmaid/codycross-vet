import { parseRoute, routeHref } from '../src/ui/router';

describe('rotas', () => {
  test('a capa é o início; o sumário de fases fica em #/fases', () => {
    expect(parseRoute('')).toEqual({ view: 'cover' });
    expect(parseRoute('#/')).toEqual({ view: 'cover' });
    expect(parseRoute('#/qualquer-coisa')).toEqual({ view: 'cover' });
    expect(parseRoute('#/fases')).toEqual({ view: 'home' });
    expect(routeHref({ view: 'cover' })).toBe('#/');
    expect(routeHref({ view: 'home' })).toBe('#/fases');
  });

  test('as outras rotas continuam iguais', () => {
    expect(parseRoute('#/fase/raiva/caca-palavras')).toEqual({ view: 'stage', id: 'raiva', mode: 'hunt' });
    expect(parseRoute('#/fase')).toEqual({ view: 'home' });
    expect(parseRoute('#/caderno')).toEqual({ view: 'library', tab: 'caderno' });
    expect(parseRoute('#/sala/ABC23')).toEqual({ view: 'competition', code: 'ABC23' });
    for (const hash of ['#/fase/raiva', '#/biblioteca/raiva', '#/referencias', '#/competicao', '#/sala/ABC23']) {
      expect(routeHref(parseRoute(hash))).toBe(hash);
    }
  });
});
