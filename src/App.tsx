import { useEffect, useState } from 'react';
import { calcGrandTotal } from './domain/calc';
import type { AppData, Receipt } from './domain/types';
import { loadData, saveData } from './storage/repository';
import { GroupScreen } from './ui/GroupScreen';
import { Home } from './ui/Home';
import { ReceiptEntry } from './ui/ReceiptEntry';
import { SummaryScreen } from './ui/SummaryScreen';

type Screen =
  | { name: 'home' }
  | { name: 'summary' }
  | { name: 'group' }
  | { name: 'entry'; receiptId: string | null; askGroup: boolean };

export function App() {
  const [data, setData] = useState<AppData>(() => loadData());
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [saveError, setSaveError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  useEffect(() => {
    setSaveError(!saveData(data));
  }, [data]);

  useEffect(() => {
    window.scrollTo?.(0, 0);
  }, [screen]);

  const home = () => setScreen({ name: 'home' });

  const upsertReceipt = (r: Receipt) => {
    setData((d) => {
      const exists = d.receipts.some((x) => x.id === r.id);
      return { ...d, receipts: exists ? d.receipts.map((x) => (x.id === r.id ? r : x)) : [...d.receipts, r] };
    });
    home();
  };

  const onExport = async () => {
    setExporting(true);
    setExportError('');
    try {
      // PDFのライブラリは大きいので、出力するときに初めて読み込む
      const { exportPdf } = await import('./pdf/exportPdf');
      await exportPdf(data);
    } catch {
      setExportError('PDFの作成に失敗しました。通信状態を確認して、もう一度お試しください。');
    } finally {
      setExporting(false);
    }
  };

  switch (screen.name) {
    case 'entry': {
      const receipt = screen.receiptId ? (data.receipts.find((r) => r.id === screen.receiptId) ?? null) : null;
      return (
        <ReceiptEntry
          key={screen.receiptId ?? 'new'}
          receipt={receipt}
          askGroup={screen.askGroup}
          group={data.group}
          onSaveGroup={(group) => setData((d) => ({ ...d, group }))}
          onSave={upsertReceipt}
          onDelete={(id) => {
            setData((d) => ({ ...d, receipts: d.receipts.filter((r) => r.id !== id) }));
            home();
          }}
          onClose={home}
        />
      );
    }
    case 'summary':
      return (
        <SummaryScreen
          summary={data.summary}
          receiptTotal={calcGrandTotal(data.receipts)}
          onChange={(summary) => setData((d) => ({ ...d, summary }))}
          onBack={home}
        />
      );
    case 'group':
      return (
        <GroupScreen
          group={data.group}
          onSave={(group) => {
            setData((d) => ({ ...d, group }));
            home();
          }}
          onBack={home}
        />
      );
    default:
      return (
        <Home
          group={data.group}
          receipts={data.receipts}
          exporting={exporting}
          exportError={exportError}
          saveError={saveError}
          onEditGroup={() => setScreen({ name: 'group' })}
          onExport={onExport}
          onSummary={() => setScreen({ name: 'summary' })}
          // レシートが1件も無いときは、グループ情報の入力から始める
          onNewReceipt={() => setScreen({ name: 'entry', receiptId: null, askGroup: data.receipts.length === 0 })}
          onEditReceipt={(id) => setScreen({ name: 'entry', receiptId: id, askGroup: false })}
        />
      );
  }
}
