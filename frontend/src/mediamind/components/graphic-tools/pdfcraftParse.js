// Leitura leve da estrutura de um PDF (sem decodificar streams): conta páginas e
// extrai marcadores (outline) quando os objetos não estão comprimidos.
// Reimplementação própria; não substitui um decodificador completo como pdf.js.

function decodeLiteral(raw) {
  let out = "";
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch !== "\\") {
      out += ch;
      continue;
    }
    const next = raw[i + 1];
    i += 1;
    if (next === "n") out += "\n";
    else if (next === "r") out += "\r";
    else if (next === "t") out += "\t";
    else if (/[0-7]/.test(next || "")) {
      const oct = raw.slice(i, i + 3).match(/^[0-7]{1,3}/)[0];
      out += String.fromCharCode(parseInt(oct, 8));
      i += oct.length - 1;
    } else if (next !== undefined && next !== "\n") out += next;
  }
  return out;
}

function decodeText(bytes) {
  if (bytes.charCodeAt(0) === 0xfe && bytes.charCodeAt(1) === 0xff) {
    let out = "";
    for (let i = 2; i + 1 < bytes.length; i += 2) {
      out += String.fromCharCode((bytes.charCodeAt(i) << 8) | bytes.charCodeAt(i + 1));
    }
    return out;
  }
  return bytes;
}

function readTitle(body) {
  const literal = body.match(/\/Title\s*\(((?:\\[\s\S]|[^\\)])*)\)/);
  if (literal) return decodeText(decodeLiteral(literal[1])).trim();
  const hex = body.match(/\/Title\s*<([0-9A-Fa-f\s]*)>/);
  if (hex) {
    const clean = hex[1].replace(/\s+/g, "");
    let bytes = "";
    for (let i = 0; i + 1 < clean.length; i += 2) bytes += String.fromCharCode(parseInt(clean.slice(i, i + 2), 16));
    return decodeText(bytes).trim();
  }
  return "";
}

/** @param {string} text conteúdo do PDF decodificado como latin1 */
export function parsePdfInfo(text) {
  if (typeof text !== "string" || !text.startsWith("%PDF")) return { valid: false, pages: 0, outline: [] };
  const objects = [...text.matchAll(/(\d+)\s+\d+\s+obj\b([\s\S]*?)endobj/g)].map((m) => ({ num: m[1], body: m[2] }));
  const pageNums = objects
    .filter((obj) => /\/Type\s*\/Page(?![a-zA-Z])/.test(obj.body))
    .map((obj) => obj.num);
  let pages = pageNums.length;
  if (!pages) {
    const counts = [...text.matchAll(/\/Type\s*\/Pages[\s\S]{0,400}?\/Count\s+(\d+)/g)].map((m) => +m[1]);
    pages = counts.length ? Math.max(...counts) : 0;
  }
  const outline = objects
    .filter((obj) => /\/Parent\s+\d+\s+\d+\s+R/.test(obj.body) && /\/Title\s*[(<]/.test(obj.body) && !/\/Type\s*\/Page/.test(obj.body))
    .map((obj) => {
      const dest = obj.body.match(/\/D(?:est)?\s*\[\s*(\d+)\s+\d+\s+R/);
      const index = dest ? pageNums.indexOf(dest[1]) : -1;
      return { title: readTitle(obj.body), page: index >= 0 ? index + 1 : 0 };
    })
    .filter((item) => item.title);
  return { valid: true, pages, outline };
}

export async function readPdfInfo(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("PDF indisponível");
  const buffer = await response.arrayBuffer();
  return parsePdfInfo(new TextDecoder("latin1").decode(buffer));
}
