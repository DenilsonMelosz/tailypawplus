import QRCode from "qrcode";

export const escXml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/**
 * Plaquinha redonda de coleira, desenhada em um quadro de 100 x 100:
 * aro azul-petroleo, disco branco, QR no centro (todos os cantos dentro do disco), nome embaixo.
 * Com guide, desenha a linha tracejada de corte logo fora do aro.
 */
export async function tagSvg(name: string, url: string, opts: { guide?: boolean } = {}): Promise<string> {
  const qr = await QRCode.toDataURL(url, { width: 600, margin: 1, errorCorrectionLevel: "M", color: { dark: "#0B2A30", light: "#FFFFFF" } });
  const shown = name.length > 14 ? `${name.slice(0, 13).trimEnd()}…` : name;
  const fs = Math.min(9.5, 56 / (0.6 * Math.max(shown.length, 1)));
  const pad = opts.guide ? 5 : 0;
  const font = `font-family="Segoe UI, Arial, sans-serif" text-anchor="middle"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${100 + pad * 2} ${100 + pad * 2}" width="100%" height="100%">
  ${opts.guide ? `<circle cx="50" cy="50" r="51.5" fill="none" stroke="#8A8F94" stroke-width="0.5" stroke-dasharray="2.2 1.8"/>
  <text x="14" y="9.5" font-size="5" fill="#8A8F94" font-family="Segoe UI Symbol, Arial">✂</text>` : ""}
  <circle cx="50" cy="50" r="48" fill="#159EAD"/>
  <circle cx="50" cy="50" r="43" fill="#FFFFFF"/>
  <text x="50" y="14.6" ${font} font-size="5" font-weight="800" letter-spacing="0.4" fill="#0B6570">ME ACHOU?</text>
  <image href="${qr}" x="27" y="19" width="46" height="46"/>
  <text x="50" y="${76.5}" ${font} font-size="${fs.toFixed(2)}" font-weight="800" fill="#0B2A30">${escXml(shown)}</text>
  <text x="50" y="87" ${font} font-size="4.8" font-weight="700" fill="#F97316">LEIA O QR CODE</text>
</svg>`;
}

export const svgToDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
