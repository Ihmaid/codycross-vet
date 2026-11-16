import qrcode from 'qrcode-generator';
import { html, Html } from '../dom';

/** QR code em SVG (para a turma entrar na sala apontando a câmera para a tela). */
export function qrSvg(text: string): Html {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return html`<svg viewBox="-2 -2 ${n + 4} ${n + 4}" shape-rendering="crispEdges" role="img" aria-label="QR code com o link da sala">
    <rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"></rect><path d="${d}" fill="#000"></path></svg>`;
}
