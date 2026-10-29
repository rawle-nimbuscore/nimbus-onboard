import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { briefLines, type AnswerMap } from "./questions";

const INK = rgb(0.125, 0.161, 0.263);
const MUTED = rgb(0.4, 0.443, 0.541);
const COPPER = rgb(0.192, 0.373, 0.91);
const RULE = rgb(0.906, 0.918, 0.949);
const PAPER = rgb(0.965, 0.973, 0.988);

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const paragraphs = text.split(/\n/);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
  }
  return lines.length > 0 ? lines : [""];
}

export async function buildBriefPdf(answers: AnswerMap): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const width = 612;
  const height = 792;
  const margin = 56;
  const contentWidth = width - margin * 2;

  let page = doc.addPage([width, height]);
  let y = height - margin;

  const newPage = () => {
    page = doc.addPage([width, height]);
    y = height - margin;
    paintPaper(page, width, height);
  };

  const ensure = (needed: number) => {
    if (y - needed < 48) newPage();
  };

  paintPaper(page, width, height);
  page.drawRectangle({ x: 0, y: height - 8, width, height: 8, color: COPPER });

  page.drawText("NIMBUSCORE", { x: margin, y: y - 4, size: 10, font: bold, color: COPPER });
  y -= 28;
  page.drawText("Client project brief", { x: margin, y, size: 22, font: bold, color: INK });
  y -= 18;
  const stamp = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const title = answers.projectName?.trim() || answers.projectId?.trim() || "Untitled project";
  page.drawText(`${title}  ·  ${stamp}`, {
    x: margin,
    y,
    size: 10,
    font,
    color: MUTED,
  });
  y -= 16;
  page.drawRectangle({ x: margin, y, width: contentWidth, height: 0.6, color: RULE });
  y -= 22;

  let chapter = "";
  for (const row of briefLines(answers)) {
    if (row.chapter !== chapter) {
      chapter = row.chapter;
      ensure(36);
      page.drawText(chapter.toUpperCase(), { x: margin, y, size: 9, font: bold, color: COPPER });
      y -= 16;
    }
    ensure(32);
    page.drawText(row.label, { x: margin, y, size: 9, font, color: MUTED });
    y -= 13;
    const lines = wrap(row.value || "—", font, 11, contentWidth);
    for (const line of lines) {
      ensure(16);
      page.drawText(line, { x: margin, y, size: 11, font: bold, color: INK });
      y -= 14;
    }
    y -= 8;
  }

  const pages = doc.getPages();
  pages.forEach((item, index) => {
    item.drawText(`nimbus-core.com  ·  ${index + 1} / ${pages.length}`, {
      x: margin,
      y: 32,
      size: 8,
      font,
      color: MUTED,
    });
  });

  doc.setTitle(`NimbusCore brief — ${answers.projectName?.trim() || "Client"}`);
  doc.setAuthor("Nimbus Core");
  doc.setSubject("Client project intake");
  return doc.save();
}

function paintPaper(page: PDFPage, width: number, height: number) {
  page.drawRectangle({ x: 0, y: 0, width, height, color: PAPER });
}

export function briefFilename(answers: AnswerMap): string {
  const slug = (answers.projectId || answers.projectName || "project")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const day = new Date().toISOString().slice(0, 10);
  return `nimbuscore-brief-${slug || "project"}-${day}.pdf`;
}
