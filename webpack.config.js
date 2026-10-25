const path = require('path');
const crypto = require('crypto');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

/**
 * Gera o service worker (modo offline / app instalável) com a lista de arquivos do build.
 * A versão do cache muda sempre que algum arquivo muda, então os usuários recebem as atualizações.
 */
class ServiceWorkerPlugin {
  apply(compiler) {
    const { Compilation, sources } = compiler.webpack;
    compiler.hooks.thisCompilation.tap('ServiceWorkerPlugin', (compilation) => {
      compilation.hooks.processAssets.tap(
        { name: 'ServiceWorkerPlugin', stage: Compilation.PROCESS_ASSETS_STAGE_REPORT },
        (assets) => {
          // O PDF (~32 MB) não é pré-armazenado: abre direto da internet.
          const files = Object.keys(assets)
            .filter((f) => !/\.(map|pdf)$/i.test(f) && f !== 'sw.js')
            .sort();
          const hash = crypto.createHash('sha256');
          for (const f of files) hash.update(f).update(assets[f].buffer());
          const version = hash.digest('hex').slice(0, 12);
          const template = require('fs').readFileSync(path.join(__dirname, 'src', 'sw.template.js'), 'utf8');
          const source = template
            .replace('__CACHE_VERSION__', version)
            .replace('__PRECACHE__', JSON.stringify(['./', ...files.map((f) => `./${f}`)]));
          compilation.emitAsset('sw.js', new sources.RawSource(source));
        }
      );
    });
  }
}

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    entry: './src/index.ts',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'js/[name].[contenthash].js',
      // 'auto' permite publicar em subpasta (ex.: GitHub Pages)
      publicPath: 'auto',
      clean: true
    },
    devtool: isProduction ? 'source-map' : 'inline-source-map',
    devServer: {
      port: 3000,
      hot: true,
      static: { directory: path.join(__dirname, 'public') }
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/
        },
        {
          test: /\.s[ac]ss$/i,
          use: [
            isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
            'css-loader',
            'sass-loader'
          ]
        }
      ]
    },
    resolve: {
      extensions: ['.ts', '.js', '.json']
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/index.html',
        filename: 'index.html',
        inject: 'body'
      }),
      new MiniCssExtractPlugin({
        filename: isProduction ? 'css/[name].[contenthash].css' : 'css/[name].css'
      }),
      // Imagens, ilustrações, páginas do e-book, ícones, manifesto e PDF (servidos como estão).
      new CopyWebpackPlugin({ patterns: [{ from: 'public', to: '' }] }),
      ...(isProduction ? [new ServiceWorkerPlugin()] : [])
    ],
    performance: {
      // As imagens do e-book (~150 KB cada) e o PDF são carregados sob demanda.
      assetFilter: (file) => /\.(js|css)$/.test(file)
    }
  };
};
