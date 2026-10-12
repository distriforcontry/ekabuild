import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

/**
 * Converts the contract markdown (headings, paragraphs, lists, **bold**, pipe tables) into a styled DOCX,
 * with the contract hash and signatures appended as an evidence block.
 */
function runs(text: string, base: { size?: number; bold?: boolean } = {}) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map(
    (p) =>
      new TextRun({
        text: p.startsWith("**") ? p.slice(2, -2) : p,
        bold: base.bold || p.startsWith("**"),
        size: base.size ?? 22,
        font: "Arial",
      }),
  );
}

function table(lines: string[]) {
  const rows = lines
    .filter((l) => !/^\|\s*-/.test(l))
    .map((l) =>
      l
        .trim()
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((c) => c.trim()),
    );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      (cells, ri) =>
        new TableRow({
          children: cells.map(
            (c) =>
              new TableCell({
                shading: ri === 0 ? { type: ShadingType.CLEAR, color: "auto", fill: "E9D5A8" } : undefined,
                children: [new Paragraph({ children: runs(c, { bold: ri === 0, size: 20 }) })],
              }),
          ),
        }),
    ),
  });
}

export type DocxSignature = { role: string; signerName: string | null; signerTin: string | null; signerPinfl: string | null; method: string; certSerial: string | null; signedAt: Date };

export async function contractDocx(input: { title: string; number: string; body: string; bodyHash: string; signatures: DocxSignature[]; note?: string }): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];
  const lines = input.body.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith("|")) {
      const block: string[] = [];
      while (i < lines.length && lines[i]!.startsWith("|")) block.push(lines[i++]!);
      i--;
      children.push(table(block));
      continue;
    }
    if (/^#\s/.test(line)) children.push(new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: runs(line.slice(2), { size: 30, bold: true }) }));
    else if (/^##\s/.test(line)) children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 }, children: runs(line.slice(3), { size: 24, bold: true }) }));
    else if (/^[-*]\s/.test(line)) children.push(new Paragraph({ bullet: { level: 0 }, children: runs(line.slice(2)) }));
    else if (line.trim() === "") children.push(new Paragraph({ children: [] }));
    else children.push(new Paragraph({ spacing: { after: 80 }, alignment: AlignmentType.JUSTIFIED, children: runs(line.replace(/^>\s?/, "")) }));
  }

  children.push(new Paragraph({ spacing: { before: 400 }, children: runs("Elektron imzolar va yaxlitlik", { bold: true, size: 24 }) }));
  children.push(
    new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 6, color: "B08A4E", space: 4 } },
      children: [new TextRun({ text: `SHA-256: ${input.bodyHash}`, font: "Consolas", size: 18 })],
    }),
  );
  for (const s of input.signatures) {
    children.push(
      new Paragraph({
        children: runs(
          `${s.role === "BUYER" ? "Xaridor" : s.role === "SELLER" ? "Sotuvchi" : s.role}: ${s.signerName ?? "—"}${s.signerTin ? `, STIR ${s.signerTin}` : ""}${s.signerPinfl ? `, JShShIR ${s.signerPinfl}` : ""} — ${s.method === "EIMZO" ? "E-IMZO" : "demo imzo"}${s.certSerial ? ` (sertifikat ${s.certSerial})` : ""}, ${s.signedAt.toISOString().replace("T", " ").slice(0, 16)} UTC`,
          { size: 20 },
        ),
      }),
    );
  }
  if (input.note) children.push(new Paragraph({ children: runs(input.note, { size: 20 }) }));
  else if (!input.signatures.length) children.push(new Paragraph({ children: runs("Imzolar hali qo'yilmagan.", { size: 20 }) }));

  const doc = new Document({
    creator: "EKA BUILD",
    title: input.title,
    styles: { default: { document: { run: { font: "Arial", size: 22 } } } },
    sections: [
      {
        properties: { page: { margin: { top: 1000, bottom: 1000, left: 1200, right: 1000 } } },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: `EKA BUILD · ${input.number} · `, size: 16, color: "6B6F7A" }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "6B6F7A" }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
  return Packer.toBuffer(doc);
}
