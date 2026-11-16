import { createApp } from './app';

// Servidor da competição. No Render, PORT e ALLOWED_ORIGINS vêm das variáveis de ambiente (render.yaml).

const port = Number(process.env.PORT) || 3001;
const production = process.env.NODE_ENV === 'production';
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (production && !allowedOrigins.length) {
  console.warn('ALLOWED_ORIGINS vazio: qualquer site poderá se conectar a este servidor.');
}

const app = createApp({ allowedOrigins, log: (m) => console.log(`[competição] ${m}`) });

app.http.listen(port, () => {
  console.log(`[competição] servidor ouvindo na porta ${port}`);
});

const stop = () => {
  console.log('[competição] encerrando');
  app.close().then(() => process.exit(0));
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
