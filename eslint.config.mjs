import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'coverage/', 'Virologia_em_Jogo_V5/', '*.js', 'src/sw.template.js'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended
);
