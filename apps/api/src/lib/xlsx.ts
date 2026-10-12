import ExcelJS from "exceljs";

export type XlsxColumn<T> = {
  header: string;
  key: string;
  width?: number;
  value: (row: T) => string | number | Date | null | undefined | boolean;
  /** Excel number format, e.g. '#,##0' or 'dd.mm.yyyy' */
  numFmt?: string;
};

/**
 * Styled Excel workbook: gold header row, frozen header, autofilter, zebra rows, proper number/date formats,
 * a title row with the report name and generation time.
 */
export async function buildWorkbook<T>(sheets: { name: string; title: string; columns: XlsxColumn<T>[]; rows: T[] }[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "EKA BUILD";
  wb.created = new Date();
  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.name.slice(0, 31), { views: [{ state: "frozen", ySplit: 3 }] });
    ws.mergeCells(1, 1, 1, Math.max(1, sheet.columns.length));
    const title = ws.getCell(1, 1);
    title.value = sheet.title;
    title.font = { bold: true, size: 14, color: { argb: "FF111215" } };
    ws.getRow(1).height = 24;
    const sub = ws.getCell(2, 1);
    sub.value = `EKA BUILD · ${new Date().toLocaleString("ru-RU", { timeZone: "Asia/Tashkent" })} · ${sheet.rows.length} ta yozuv`;
    sub.font = { size: 9, color: { argb: "FF6B6F7A" } };

    const header = ws.getRow(3);
    sheet.columns.forEach((c, i) => {
      const cell = header.getCell(i + 1);
      cell.value = c.header;
      cell.font = { bold: true, color: { argb: "FF111215" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE9D5A8" } };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border = { bottom: { style: "thin", color: { argb: "FFB08A4E" } } };
      ws.getColumn(i + 1).width = c.width ?? Math.min(40, Math.max(12, c.header.length + 4));
      if (c.numFmt) ws.getColumn(i + 1).numFmt = c.numFmt;
    });
    header.height = 22;

    sheet.rows.forEach((row, ri) => {
      const r = ws.getRow(4 + ri);
      sheet.columns.forEach((c, ci) => {
        const v = c.value(row);
        r.getCell(ci + 1).value = v === undefined ? null : (v as ExcelJS.CellValue);
      });
      if (ri % 2 === 1) r.eachCell((cell) => (cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAF8F3" } }));
    });
    ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3 + sheet.rows.length, column: sheet.columns.length } };
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
