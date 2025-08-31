const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const fs = require('fs');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  // Verificar se a pasta public existe, se não, criar
  const publicDir = path.join(__dirname, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  
  return {
    entry: './src/index.ts',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'js/[name].[contenthash].js',
      publicPath: '/'
    },
    devtool: isProduction ? 'source-map' : 'inline-source-map',
    devServer: {
      static: [
        path.join(__dirname, 'public'),
        path.join(__dirname, 'src/data') // Adicionar pasta de dados para acesso direto
      ],
      port: 3000,
      hot: true,
      historyApiFallback: true
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
        },
        {
          test: /\.(png|svg|jpg|jpeg|gif)$/i,
          type: 'asset/resource',
          generator: {
            filename: 'assets/images/[name].[hash][ext]'
          }
        },
        {
          test: /\.(woff|woff2|eot|ttf|otf)$/i,
          type: 'asset/resource',
          generator: {
            filename: 'assets/fonts/[name].[hash][ext]'
          }
        },
        {
          test: /\.(mp3|wav|ogg)$/i,
          type: 'asset/resource',
          generator: {
            filename: 'assets/sounds/[name].[hash][ext]'
          }
        },
        {
          test: /\.json$/,
          type: 'asset/resource',
          generator: {
            filename: 'data/[name].[hash][ext]'
          }
        }
      ]
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js', '.json'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@assets': path.resolve(__dirname, 'src/assets'),
        '@core': path.resolve(__dirname, 'src/core'),
        '@ui': path.resolve(__dirname, 'src/ui'),
        '@data': path.resolve(__dirname, 'src/data'),
        '@utils': path.resolve(__dirname, 'src/utils'),
        '@config': path.resolve(__dirname, 'src/config')
      }
    },
    plugins: [
      new CleanWebpackPlugin(),
      new HtmlWebpackPlugin({
        template: './src/index.html',
        filename: 'index.html',
        inject: 'body'
      }),
      new MiniCssExtractPlugin({
        filename: isProduction ? 'css/[name].[contenthash].css' : 'css/[name].css'
      }),
      // Condicional para o CopyWebpackPlugin
      ...(fs.readdirSync(publicDir).length > 0 
        ? [new CopyWebpackPlugin({
            patterns: [
              { from: 'public', to: '' }
            ]
          })]
        : []),
      // Copiar arquivos de dados
      new CopyWebpackPlugin({
        patterns: [
          { 
            from: 'src/data',
            to: 'data'
          }
        ]
      })
    ],
    optimization: {
      splitChunks: {
        chunks: 'all'
      }
    }
  };
};
