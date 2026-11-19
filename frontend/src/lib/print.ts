import QRCode from "qrcode";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

function openPrint(title: string, body: string) {
  const w = window.open("", "_blank");
  if (!w) { alert("Permita pop-ups para imprimir."); return; }
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>@page{size:A4;margin:12mm}body{font-family:"Segoe UI",Arial,sans-serif;color:#0B2A30;margin:0}
.c{display:flex;flex-direction:column;align-items:center;text-align:center}img{display:block}</style></head><body>${body}
<script>window.onload=()=>{setTimeout(()=>{window.print()},300)}<\/script></body></html>`);
  w.document.close();
}

export async function printTag(name: string, url: string) {
  const qr = await QRCode.toDataURL(url, { width: 500, margin: 1 });
  const tag = (s: number) => `<div class="c" style="width:${s}mm;height:${s}mm;border:${s / 18}mm solid #159EAD;border-radius:50%;justify-content:center;box-sizing:border-box">
    <img src="${qr}" style="width:${s * 0.55}mm"><b style="font-size:${s / 9}mm;margin-top:1mm">${esc(name)}</b>
    <span style="font-size:${s / 16}mm">Me achou? Leia o QR</span></div>`;
  openPrint(`Plaquinha de ${name}`, `<div class="c"><h2>Plaquinha de ${esc(name)}</h2>
  <p>Recorte no tamanho que caber na coleira. Para pendurar, use um porta-plaquinha transparente.</p>
  <div style="display:flex;gap:10mm;align-items:center;margin-top:6mm">${tag(60)}${tag(40)}${tag(30)}</div>
  <p style="font-size:10pt;color:#555;margin-top:8mm">${esc(url)}</p></div>`);
}

export async function printPoster(p: {
  title: string; photo: string; type: "perdido" | "avistado"; details: string; where: string; reward?: string | null; phone?: string; url: string; extra?: string;
}) {
  const qr = await QRCode.toDataURL(p.url, { width: 500, margin: 1 });
  const head = p.type === "perdido" ? "PROCURA-SE" : "PET ENCONTRADO";
  const color = p.type === "perdido" ? "#DC2626" : "#0F7F8C";
  openPrint(`Cartaz - ${p.title}`, `<div class="c" style="height:270mm;justify-content:space-between">
  <div style="background:${color};color:#fff;width:100%;padding:6mm 0;font-size:34pt;font-weight:900;letter-spacing:2px">${head}</div>
  <img src="${p.photo}" style="width:150mm;height:110mm;object-fit:cover;border-radius:6mm;margin-top:5mm">
  <div style="font-size:30pt;font-weight:900;margin-top:4mm">${esc(p.title)}</div>
  <div style="font-size:15pt">${esc(p.details)}</div>
  <div style="font-size:14pt;margin-top:2mm">${esc(p.where)}</div>
  ${p.extra ? `<div style="font-size:13pt;margin-top:2mm;max-width:170mm">${esc(p.extra)}</div>` : ""}
  ${p.reward ? `<div style="font-size:18pt;font-weight:800;color:#C2410C;margin-top:3mm">Recompensa: ${esc(p.reward)}</div>` : ""}
  <div style="display:flex;align-items:center;gap:8mm;margin-top:5mm;border-top:2px solid #eee;padding-top:5mm">
    <img src="${qr}" style="width:45mm">
    <div style="text-align:left;font-size:14pt"><b>Viu este pet? Leia o QR Code</b><br>e avise pelo TailyPaw+, sem expor ninguém.
    ${p.phone ? `<br><span style="font-size:16pt;font-weight:800">Telefone: ${esc(p.phone)}</span>` : ""}</div>
  </div></div>`);
}
