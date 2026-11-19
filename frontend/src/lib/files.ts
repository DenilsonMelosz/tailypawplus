/** Fotos aceitas: JPG, PNG e WEBP. GIF e outros formatos sao recusados. */
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
export const MAX_IMAGE_MB = 12;

const MSG = "Envie uma foto JPG, PNG ou WEBP.";

/** Confere o conteudo do arquivo (nao so a extensao). Devolve a mensagem de erro, ou null se esta tudo certo. */
export async function checkImage(file: File): Promise<string | null> {
  if (file.size === 0) return `"${file.name}" está vazio.`;
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) return `"${file.name}" tem mais de ${MAX_IMAGE_MB} MB.`;
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const is = (...b: number[]) => b.every((v, i) => head[i] === v);
  const jpeg = is(0xff, 0xd8, 0xff);
  const png = is(0x89, 0x50, 0x4e, 0x47);
  const webp = is(0x52, 0x49, 0x46, 0x46) && head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50;
  if (is(0x47, 0x49, 0x46)) return `"${file.name}" é um GIF. GIF não é aceito. ${MSG}`;
  if (!jpeg && !png && !webp) return `"${file.name}" não é uma imagem aceita. ${MSG}`;
  return null;
}
