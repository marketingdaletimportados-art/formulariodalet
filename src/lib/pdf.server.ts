import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";

export type AuthorizationPdfData = {
  protocol: string;
  submittedAt: string; // ISO
  termsAcceptedAt: string; // ISO
  seller: { name: string; department: string | null };
  buyer: { name: string; cpf: string; phone: string; orderNumber: string };
  authorized: { name: string; cpf: string | null };
  products: string;
  notes: string | null;
};

const NAVY = rgb(0.06, 0.24, 0.55); // Dalet blue
const INK = rgb(0.09, 0.11, 0.16);
const MUTED = rgb(0.42, 0.47, 0.55);
const LIGHT = rgb(0.87, 0.9, 0.95);
const PANEL = rgb(0.96, 0.97, 0.99);

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN_X = 50;
const MARGIN_TOP = 50;
const MARGIN_BOTTOM = 60;

function maskCpfDoc(cpf: string) {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function formatDateTimeBR(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// pdf-lib standard fonts use WinAnsi encoding (Latin-1). Strip anything outside
// that range to avoid throwing on unusual characters pasted by users.
function sanitize(text: string) {
  return text.replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "");
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  const paragraphs = sanitize(text).split(/\r?\n/);
  for (const paragraph of paragraphs) {
    if (paragraph.trim() === "") {
      lines.push("");
      continue;
    }
    const words = paragraph.split(/\s+/);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        // Word longer than maxWidth: hard-break by character.
        if (font.widthOfTextAtSize(word, size) > maxWidth) {
          let chunk = "";
          for (const ch of word) {
            const c2 = chunk + ch;
            if (font.widthOfTextAtSize(c2, size) > maxWidth) {
              lines.push(chunk);
              chunk = ch;
            } else {
              chunk = c2;
            }
          }
          line = chunk;
        } else {
          line = word;
        }
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

type Ctx = {
  doc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  y: number;
  protocol: string;
};

function newPage(ctx: Ctx) {
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  ctx.y = PAGE_H - MARGIN_TOP;
  drawFooter(ctx);
}

function ensureSpace(ctx: Ctx, needed: number) {
  if (ctx.y - needed < MARGIN_BOTTOM) newPage(ctx);
}

function drawFooter(ctx: Ctx) {
  const size = 8;
  const text = "Documento gerado eletronicamente pelo sistema de autorização de retirada da Dalet Importados.";
  ctx.page.drawText(text, {
    x: MARGIN_X,
    y: 30,
    size,
    font: ctx.font,
    color: MUTED,
  });
  ctx.page.drawText(ctx.protocol, {
    x: PAGE_W - MARGIN_X - ctx.bold.widthOfTextAtSize(ctx.protocol, size),
    y: 30,
    size,
    font: ctx.bold,
    color: MUTED,
  });
  ctx.page.drawLine({
    start: { x: MARGIN_X, y: 46 },
    end: { x: PAGE_W - MARGIN_X, y: 46 },
    thickness: 0.5,
    color: LIGHT,
  });
}

function drawSectionHeading(ctx: Ctx, title: string) {
  ensureSpace(ctx, 30);
  ctx.y -= 6;
  ctx.page.drawRectangle({
    x: MARGIN_X,
    y: ctx.y - 4,
    width: 3,
    height: 14,
    color: NAVY,
  });
  ctx.page.drawText(title, {
    x: MARGIN_X + 10,
    y: ctx.y,
    size: 11,
    font: ctx.bold,
    color: NAVY,
  });
  ctx.y -= 8;
  ctx.page.drawLine({
    start: { x: MARGIN_X, y: ctx.y },
    end: { x: PAGE_W - MARGIN_X, y: ctx.y },
    thickness: 0.5,
    color: LIGHT,
  });
  ctx.y -= 14;
}

function drawKeyValueGrid(ctx: Ctx, rows: Array<[string, string]>) {
  const colWidth = (PAGE_W - MARGIN_X * 2) / 2;
  const rowHeight = 30;
  for (let i = 0; i < rows.length; i += 2) {
    ensureSpace(ctx, rowHeight);
    const pair = [rows[i], rows[i + 1]].filter(Boolean) as Array<[string, string]>;
    pair.forEach(([label, value], idx) => {
      const x = MARGIN_X + idx * colWidth;
      ctx.page.drawText(sanitize(label.toUpperCase()), {
        x,
        y: ctx.y,
        size: 7.5,
        font: ctx.bold,
        color: MUTED,
      });
      ctx.page.drawText(sanitize(value), {
        x,
        y: ctx.y - 13,
        size: 11,
        font: ctx.font,
        color: INK,
      });
    });
    ctx.y -= rowHeight;
  }
}

function drawParagraph(ctx: Ctx, text: string, opts?: { size?: number; color?: ReturnType<typeof rgb>; bold?: boolean; leading?: number }) {
  const size = opts?.size ?? 10.5;
  const color = opts?.color ?? INK;
  const font = opts?.bold ? ctx.bold : ctx.font;
  const leading = opts?.leading ?? size * 1.45;
  const maxWidth = PAGE_W - MARGIN_X * 2;
  const lines = wrapText(text, font, size, maxWidth);
  for (const line of lines) {
    ensureSpace(ctx, leading);
    if (line) {
      ctx.page.drawText(line, { x: MARGIN_X, y: ctx.y, size, font, color });
    }
    ctx.y -= leading;
  }
}

function drawPanel(ctx: Ctx, text: string) {
  const size = 10.5;
  const leading = size * 1.5;
  const padding = 12;
  const maxWidth = PAGE_W - MARGIN_X * 2 - padding * 2;
  const lines = wrapText(text, ctx.font, size, maxWidth);
  const height = lines.length * leading + padding * 2;
  ensureSpace(ctx, height + 6);
  const top = ctx.y;
  ctx.page.drawRectangle({
    x: MARGIN_X,
    y: top - height,
    width: PAGE_W - MARGIN_X * 2,
    height,
    color: PANEL,
    borderColor: LIGHT,
    borderWidth: 0.5,
  });
  let y = top - padding - size;
  for (const line of lines) {
    if (line) ctx.page.drawText(line, { x: MARGIN_X + padding, y, size, font: ctx.font, color: INK });
    y -= leading;
  }
  ctx.y = top - height - 6;
}

function drawHeader(ctx: Ctx, data: AuthorizationPdfData) {
  // Logo mark
  ctx.page.drawRectangle({
    x: MARGIN_X,
    y: PAGE_H - MARGIN_TOP - 34,
    width: 40,
    height: 40,
    color: NAVY,
  });
  ctx.page.drawText("D", {
    x: MARGIN_X + 13,
    y: PAGE_H - MARGIN_TOP - 26,
    size: 24,
    font: ctx.bold,
    color: rgb(1, 1, 1),
  });
  ctx.page.drawText("Dalet", {
    x: MARGIN_X + 50,
    y: PAGE_H - MARGIN_TOP - 8,
    size: 14,
    font: ctx.bold,
    color: NAVY,
  });
  ctx.page.drawText("Importados", {
    x: MARGIN_X + 50,
    y: PAGE_H - MARGIN_TOP - 22,
    size: 9,
    font: ctx.font,
    color: MUTED,
  });

  // Right block
  const rightX = PAGE_W - MARGIN_X;
  const protocolLine = `Protocolo: ${data.protocol}`;
  const emittedLine = `Emitido em: ${formatDateTimeBR(data.submittedAt)}`;
  ctx.page.drawText(protocolLine, {
    x: rightX - ctx.bold.widthOfTextAtSize(protocolLine, 10),
    y: PAGE_H - MARGIN_TOP - 8,
    size: 10,
    font: ctx.bold,
    color: INK,
  });
  ctx.page.drawText(emittedLine, {
    x: rightX - ctx.font.widthOfTextAtSize(emittedLine, 9),
    y: PAGE_H - MARGIN_TOP - 22,
    size: 9,
    font: ctx.font,
    color: MUTED,
  });

  ctx.y = PAGE_H - MARGIN_TOP - 60;

  // Divider
  ctx.page.drawLine({
    start: { x: MARGIN_X, y: ctx.y },
    end: { x: PAGE_W - MARGIN_X, y: ctx.y },
    thickness: 1,
    color: NAVY,
  });
  ctx.y -= 20;

  const title = "AUTORIZAÇÃO PARA RETIRADA DE MERCADORIA";
  const titleSize = 15;
  ctx.page.drawText(sanitize(title), {
    x: (PAGE_W - ctx.bold.widthOfTextAtSize(title, titleSize)) / 2,
    y: ctx.y,
    size: titleSize,
    font: ctx.bold,
    color: NAVY,
  });
  ctx.y -= 22;
}

export async function renderAuthorizationPdf(data: AuthorizationPdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Autorização ${data.protocol}`);
  doc.setAuthor("Dalet Importados");
  doc.setSubject("Autorização para retirada de mercadoria");
  doc.setCreator("Dalet Importados");

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const ctx: Ctx = {
    doc,
    page: doc.addPage([PAGE_W, PAGE_H]),
    font,
    bold,
    y: PAGE_H - MARGIN_TOP,
    protocol: data.protocol,
  };
  drawFooter(ctx);
  drawHeader(ctx, data);

  // Seller
  drawSectionHeading(ctx, "VENDEDOR RESPONSÁVEL");
  const sellerRows: Array<[string, string]> = [["Nome", data.seller.name]];
  if (data.seller.department) sellerRows.push(["Setor", data.seller.department]);
  drawKeyValueGrid(ctx, sellerRows);

  // Buyer
  drawSectionHeading(ctx, "DADOS DO COMPRADOR");
  drawKeyValueGrid(ctx, [
    ["Nome completo", data.buyer.name],
    ["CPF", maskCpfDoc(data.buyer.cpf)],
    ["Telefone (WhatsApp)", data.buyer.phone],
    ["Número do pedido", data.buyer.orderNumber],
  ]);

  // Authorized
  drawSectionHeading(ctx, "PESSOA AUTORIZADA PARA RETIRADA");
  drawKeyValueGrid(ctx, [
    ["Nome completo", data.authorized.name],
    ["CPF", maskCpfDoc(data.authorized.cpf)],
  ]);

  // Products
  drawSectionHeading(ctx, "PRODUTOS AUTORIZADOS PARA RETIRADA");
  drawPanel(ctx, data.products);

  // Notes
  if (data.notes && data.notes.trim()) {
    drawSectionHeading(ctx, "OBSERVAÇÕES");
    drawPanel(ctx, data.notes);
  }

  // Authorization text
  drawSectionHeading(ctx, "TERMO DE AUTORIZAÇÃO");
  const buyerCpf = maskCpfDoc(data.buyer.cpf);
  const authCpf = maskCpfDoc(data.authorized.cpf);
  const termo = `Eu, ${data.buyer.name}, inscrito(a) no CPF nº ${buyerCpf}, autorizo ${data.authorized.name}, inscrito(a) no CPF nº ${authCpf}, a retirar em meu nome os produtos descritos neste documento, referentes ao pedido nº ${data.buyer.orderNumber}, adquirido na Dalet Importados.

Declaro que todas as informações prestadas são verdadeiras e assumo total responsabilidade por esta autorização.

Estou ciente de que a pessoa autorizada deverá apresentar documento oficial com foto no momento da retirada, para conferência das informações.`;
  drawParagraph(ctx, termo, { size: 10.5, leading: 15 });

  // Acceptance
  ctx.y -= 6;
  drawSectionHeading(ctx, "REGISTRO DE ACEITE");
  drawParagraph(ctx, "Termo aceito eletronicamente pelo comprador.", { bold: true });
  drawParagraph(ctx, `Data e hora do aceite: ${formatDateTimeBR(data.termsAcceptedAt)}`, { color: MUTED, size: 9.5 });
  drawParagraph(ctx, `Protocolo: ${data.protocol}`, { color: MUTED, size: 9.5 });

  return await doc.save();
}
