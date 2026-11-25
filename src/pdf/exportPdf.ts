import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import type { CellHookData } from 'jspdf-autotable';
import { storeColor } from '../domain/colors';
import type { AppData } from '../domain/types';
import { buildLedger, buildMenuRows, buildSummaryRows, LEDGER_HEAD } from './ledger';
import type { LedgerRow } from './ledger';

const FONT = 'BIZUDPGothic';
const FONT_FILE = 'BIZUDPGothic-Regular.ttf';
const MARGIN = 10;
const HEAD_FILL: [number, number, number] = [217, 217, 217];
const AMOUNT_FILL: [number, number, number] = [221, 228, 245];
const BORDER: [number, number, number] = [60, 60, 60];

const pad = (n: number) => String(n).padStart(2, '0');

export function pdfFileName(now: Date): string {
  return `模擬店領収書集計_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.pdf`;
}

/** 例: 令和8年11月25日 */
export function japaneseEraDate(now: Date): string {
  return new Intl.DateTimeFormat('ja-JP-u-ca-japanese', { era: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(now);
}

type Doc = jsPDF & { lastAutoTable?: { finalY: number } };

const finalY = (doc: Doc) => doc.lastAutoTable?.finalY ?? MARGIN;

export function createPdf(data: AppData, fontBase64: string, now: Date = new Date()): jsPDF {
  const doc: Doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  doc.addFileToVFS(FONT_FILE, fontBase64);
  doc.addFont(FONT_FILE, FONT, 'normal');
  doc.addFont(FONT_FILE, FONT, 'bold'); // 太字は埋め込まないので同じ字形を使う
  doc.setFont(FONT, 'normal');

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // 見出し
  doc.setFontSize(16);
  doc.text(`${now.getFullYear()}年 模擬店 領収書集計`, MARGIN, 16);
  doc.setFontSize(9);
  doc.text(japaneseEraDate(now), pageW - MARGIN, 12, { align: 'right' });

  doc.setFontSize(10);
  const group = data.group;
  doc.text(`グループ名：${group?.groupName ?? ''}`, MARGIN + 2, 26);
  doc.text(`代表者：${group?.representative ?? ''}`, pageW / 2 + 6, 26);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, 28, pageW / 2 - 4, 28);
  doc.line(pageW / 2 + 4, 28, pageW - MARGIN, 28);

  // 購入記録の表
  const ledger = buildLedger(data.receipts);
  const rowOf = (data: CellHookData): LedgerRow | undefined =>
    data.section === 'body' ? ledger.rows[data.row.index] : undefined;

  autoTable(doc, {
    startY: 34,
    margin: { left: MARGIN, right: MARGIN },
    head: [[...LEDGER_HEAD]],
    body: ledger.rows.map((r) => [r.name, r.c8, r.c10, r.amount, r.side]),
    foot: [['費 用 合 計', ledger.footer.c8, ledger.footer.c10, ledger.footer.total, '']],
    showFoot: 'lastPage',
    theme: 'grid',
    styles: {
      font: FONT,
      fontStyle: 'normal',
      fontSize: 9,
      cellPadding: { top: 1.2, bottom: 1.2, left: 1.5, right: 1.5 },
      overflow: 'linebreak',
      lineColor: BORDER,
      lineWidth: 0.2,
      textColor: [0, 0, 0],
      minCellHeight: 6,
      valign: 'middle',
    },
    headStyles: { fillColor: HEAD_FILL, halign: 'center' },
    footStyles: { fillColor: HEAD_FILL, halign: 'right' },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 24, halign: 'right' },
      2: { cellWidth: 24, halign: 'right' },
      3: { cellWidth: 28, halign: 'right' },
      4: { cellWidth: 24, halign: 'center', fontSize: 7 },
    },
    didParseCell: (d) => {
      if (d.section === 'head' && d.column.index === 4) {
        d.cell.styles.lineWidth = 0;
        d.cell.styles.fillColor = false;
      }
      if (d.section === 'foot') {
        if (d.column.index === 0) d.cell.styles.halign = 'center';
        if (d.column.index === 4) {
          d.cell.styles.lineWidth = 0;
          d.cell.styles.fillColor = false;
        }
      }
      const row = rowOf(d);
      if (!row) return;
      const color = storeColor(row.receiptIndex);
      if (d.column.index < 4) {
        d.cell.styles.fillColor = d.column.index === 3 ? AMOUNT_FILL : color.tint;
        return;
      }
      // 右端の列: 店名は枠なし・小さい文字、店の合計は店の色で塗る
      if (row.kind === 'storeEnd') {
        d.cell.styles.fillColor = color.solid;
        d.cell.styles.fontSize = row.side.includes('\n') ? 7 : 9;
        d.cell.styles.lineWidth = 0.2;
      } else {
        d.cell.styles.fillColor = false;
        d.cell.styles.lineWidth = 0;
        d.cell.styles.valign = 'bottom';
      }
    },
  });

  // 集計・メニュー別売上・印鑑
  const summaryRows = buildSummaryRows(data.summary);
  const menuRows = buildMenuRows(data.summary);
  const blockRows = Math.max(summaryRows.length, menuRows.length + 1, 4);
  let y = finalY(doc) + 8;
  if (y + blockRows * 8 + 4 > pageH - MARGIN) {
    doc.addPage();
    y = MARGIN + 6;
  }

  const smallTable = {
    theme: 'grid' as const,
    styles: {
      font: FONT,
      fontStyle: 'normal' as const,
      fontSize: 9,
      lineColor: BORDER,
      lineWidth: 0.3,
      textColor: [0, 0, 0] as [number, number, number],
      minCellHeight: 8,
      valign: 'middle' as const,
      halign: 'center' as const,
      overflow: 'linebreak' as const,
    },
    headStyles: { fillColor: HEAD_FILL },
    pageBreak: 'avoid' as const,
  };

  if (summaryRows.length > 0) {
    autoTable(doc, {
      ...smallTable,
      startY: y,
      margin: { left: MARGIN },
      tableWidth: 64,
      body: summaryRows,
      columnStyles: { 0: { cellWidth: 26, fillColor: HEAD_FILL }, 1: { cellWidth: 38 } },
      didParseCell: (d) => {
        const label = summaryRows[d.row.index]?.[0];
        if (d.column.index === 1 && (label === '総費用' || label === '残金')) d.cell.styles.fillColor = AMOUNT_FILL;
      },
    });
  }

  if (menuRows.length > 0) {
    autoTable(doc, {
      ...smallTable,
      startY: y,
      margin: { left: MARGIN + 72 },
      tableWidth: 58,
      head: [['メニュー', '売上個数']],
      body: menuRows,
      columnStyles: { 0: { cellWidth: 32, fontSize: 8 }, 1: { cellWidth: 26 } },
    });
  }

  // 印鑑欄
  const stampW = 36;
  const stampX = pageW - MARGIN - stampW;
  const stampY = y + 6;
  doc.setLineWidth(0.4);
  doc.setFillColor(...HEAD_FILL);
  doc.rect(stampX, stampY, stampW, 6, 'FD');
  doc.rect(stampX, stampY + 6, stampW, 6, 'FD');
  doc.rect(stampX, stampY + 12, stampW, 22);
  doc.setFontSize(9);
  doc.text('印鑑', stampX + stampW / 2, stampY + 4.2, { align: 'center' });
  doc.text('職員', stampX + stampW / 2, stampY + 10.2, { align: 'center' });

  return doc;
}

let fontCache: Promise<string> | null = null;

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function loadFont(): Promise<string> {
  fontCache ??= fetch(`${import.meta.env.BASE_URL}fonts/${FONT_FILE}`)
    .then((res) => {
      if (!res.ok) throw new Error(`font ${res.status}`);
      return res.arrayBuffer();
    })
    .then(arrayBufferToBase64)
    .catch((e) => {
      fontCache = null; // 次回やり直せるように
      throw e;
    });
  return fontCache;
}

export async function exportPdf(data: AppData): Promise<void> {
  const font = await loadFont();
  const now = new Date();
  createPdf(data, font, now).save(pdfFileName(now));
}
