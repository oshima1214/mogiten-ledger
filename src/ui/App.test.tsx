import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { saveData } from '../storage/repository';
import { emptySummary } from '../domain/types';
import type { Receipt } from '../domain/types';

vi.mock('../pdf/exportPdf', () => ({ exportPdf: vi.fn(() => Promise.resolve()) }));
import { exportPdf } from '../pdf/exportPdf';

beforeEach(() => {
  localStorage.clear();
  vi.mocked(exportPdf).mockReset().mockResolvedValue(undefined);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

const btn = (name: string | RegExp) => screen.getByRole('button', { name });

async function fillItem(user: ReturnType<typeof userEvent.setup>, panelIndex: number, name: string, price: string, rate?: '8%' | '10%') {
  const panel = screen.getByRole('region', { name: `購入品 ${panelIndex}` });
  const w = within(panel);
  await user.type(w.getByLabelText('商品名'), name);
  await user.type(w.getByLabelText('金額'), price);
  if (rate) await user.click(w.getByRole('button', { name: rate }));
}

test('初回: グループ情報 → 店 → 購入品 → ホームに表示', async () => {
  const user = userEvent.setup();
  render(<App />);
  expect(screen.getByText('まだレシートがありません。')).toBeInTheDocument();
  expect(btn('PDF出力')).toBeDisabled();

  await user.click(btn('＋ レシートを記録'));
  // グループ情報（両方必須）
  await user.click(btn('次へ（購入した店）'));
  expect(screen.getByText('グループ名を入力してください')).toBeInTheDocument();
  await user.type(screen.getByLabelText('グループ名'), '3年A組');
  await user.type(screen.getByLabelText('代表者名'), '見本 海');
  await user.click(btn('次へ（購入した店）'));

  // 店: 税表示は未選択だと進めない
  await user.type(screen.getByLabelText('店名'), 'Seria');
  await user.click(btn('次へ（購入品）'));
  expect(screen.getByText('外税か内税かを選んでください')).toBeInTheDocument();
  await user.click(btn('外税'));
  await user.click(btn('次へ（購入品）'));

  // 購入品: 1つ目は開いている、税率は未選択
  const first = screen.getByRole('region', { name: '購入品 1' });
  expect(within(first).getByRole('button', { name: '8%' })).toHaveAttribute('aria-pressed', 'false');
  expect(within(first).getByRole('button', { name: '10%' })).toHaveAttribute('aria-pressed', 'false');
  await fillItem(user, 1, '竹串', '100');
  await user.click(btn('入力を終える'));
  expect(screen.getByText('税率（8% か 10%）を選んでください')).toBeInTheDocument();
  await user.click(within(first).getByRole('button', { name: '10%' }));

  await user.click(btn('＋ 購入品を追加する'));
  await fillItem(user, 2, '木製スティック', '200', '10%');
  // 外税10% = floor(300 * 0.1) = 30、8%の行は出ない
  expect(screen.getByText('消費税 10%')).toBeInTheDocument();
  expect(screen.queryByText('消費税 8%')).not.toBeInTheDocument();
  expect(within(screen.getByLabelText('このレシートの合計')).getByText('¥330')).toBeInTheDocument();

  await user.click(btn('入力を終える'));
  // ホーム
  expect(screen.getByText('3年A組')).toBeInTheDocument();
  const card = screen.getByRole('listitem');
  expect(within(card).getByText('Seria')).toBeInTheDocument();
  expect(within(card).getByText('外税')).toBeInTheDocument();
  expect(within(card).getByText('竹串、木製スティック')).toBeInTheDocument();
  expect(within(card).getByText('¥330')).toBeInTheDocument();
});

test('閉じた欄でも商品名・税率・金額が見える', async () => {
  const user = userEvent.setup();
  saveData({ group: { groupName: 'G', representative: 'R' }, receipts: [], summary: emptySummary() });
  render(<App />);
  await user.click(btn('＋ レシートを記録'));
  await user.click(btn('次へ（購入した店）')); // 既存のグループ情報が入っている
  await user.type(screen.getByLabelText('店名'), 'TRIAL');
  await user.click(btn('内税'));
  await user.click(btn('次へ（購入品）'));
  await fillItem(user, 1, 'あじわい便り', '378', '8%');
  const toggle = within(screen.getByRole('region', { name: '購入品 1' })).getByRole('button', { expanded: true });
  await user.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(toggle).toHaveTextContent('あじわい便り');
  expect(toggle).toHaveTextContent('8%');
  expect(toggle).toHaveTextContent('¥378');
  expect(screen.queryByLabelText('商品名')).not.toBeInTheDocument();
  // 内税は税額の行が出ない
  expect(screen.queryByText(/消費税/)).not.toBeInTheDocument();
});

const receipt = (over: Partial<Receipt> = {}): Receipt => ({
  id: 'r1',
  storeName: 'イオン駅前',
  taxMode: 'exclusive',
  createdAt: '',
  items: [
    { id: 'a', name: 'たまご', price: 178, taxRate: 8 },
    { id: 'b', name: '牛乳', price: 376, taxRate: 8 },
    { id: 'c', name: 'ミックス', price: 328, taxRate: 8 },
    { id: 'd', name: 'レジ袋', price: 3, taxRate: 10 },
  ],
  ...over,
});

test('ホームのカードは商品3つまで、残りは「…ほかN点」', () => {
  saveData({ group: null, receipts: [receipt()], summary: emptySummary() });
  render(<App />);
  const card = screen.getByRole('listitem');
  expect(card).toHaveTextContent('たまご、牛乳、ミックス');
  expect(card).toHaveTextContent('…ほか1点');
  expect(card).not.toHaveTextContent('レジ袋');
  // 882 * 8% = 70, 3 * 10% = 0 → 955（見本と同じ）
  expect(within(card).getByText('¥955')).toBeInTheDocument();
});

test('編集: 内容が入った状態で開き、追加と税表示の切替ができる', async () => {
  const user = userEvent.setup();
  saveData({ group: { groupName: 'G', representative: 'R' }, receipts: [receipt()], summary: emptySummary() });
  render(<App />);
  await user.click(btn('イオン駅前を編集'));
  expect(screen.getByLabelText('店名')).toHaveValue('イオン駅前');
  expect(btn('外税')).toHaveAttribute('aria-pressed', 'true');
  await user.click(btn('内税'));
  await user.click(btn('次へ（購入品）'));
  // 既存の4件は閉じた状態で見える
  expect(screen.getAllByRole('button', { expanded: false })).toHaveLength(4);
  await user.click(btn('＋ 購入品を追加する'));
  await fillItem(user, 5, 'ホイップ', '218', '8%');
  expect(screen.queryByText(/消費税/)).not.toBeInTheDocument();
  await user.click(btn('入力を終える'));
  const card = screen.getByRole('listitem');
  expect(card).toHaveTextContent('内税');
  expect(card).toHaveTextContent('…ほか2点');
  expect(within(card).getByText('¥1,103')).toBeInTheDocument();
});

test('編集からレシートを削除できる', async () => {
  const user = userEvent.setup();
  saveData({ group: null, receipts: [receipt()], summary: emptySummary() });
  render(<App />);
  await user.click(btn('イオン駅前を編集'));
  await user.click(btn('このレシートを削除'));
  expect(screen.getByText('まだレシートがありません。')).toBeInTheDocument();
});

test('2件目以降はグループ情報を聞かずに店の入力から始まる', async () => {
  const user = userEvent.setup();
  saveData({ group: { groupName: 'G', representative: 'R' }, receipts: [receipt()], summary: emptySummary() });
  render(<App />);
  await user.click(btn('＋ レシートを記録'));
  expect(screen.getByLabelText('店名')).toHaveValue('');
  expect(screen.queryByLabelText('グループ名')).not.toBeInTheDocument();
});

test('集計画面: 入力は保存され、メニューを増やせる', async () => {
  const user = userEvent.setup();
  saveData({ group: null, receipts: [receipt()], summary: emptySummary() });
  const { unmount } = render(<App />);
  await user.click(btn('集計'));
  await user.type(screen.getByLabelText('受け取った金券の枚数'), '170');
  await user.type(screen.getByLabelText('予算'), '4000');
  await user.click(btn('総費用に入れる'));
  expect(screen.getByLabelText('総費用')).toHaveValue('955');
  await user.click(btn('残金に入れる'));
  expect(screen.getByLabelText('残金')).toHaveValue('3045');
  await user.type(screen.getByLabelText('予算'), 'x');
  expect(screen.getByText('0以上の整数で入力してください')).toBeInTheDocument();

  await user.click(btn('＋ メニューを追加'));
  await user.click(btn('＋ メニューを追加'));
  await user.type(screen.getByLabelText('メニュー 1'), 'ワッフル');
  await user.type(screen.getAllByLabelText('売上個数')[0], '64');
  await user.click(btn('メニュー 2 を削除'));

  unmount();
  render(<App />);
  await user.click(btn('集計'));
  expect(screen.getByLabelText('受け取った金券の枚数')).toHaveValue('170');
  expect(screen.getByLabelText('予算')).toHaveValue('4000');
  expect(screen.getByLabelText('残金')).toHaveValue('3045');
  expect(screen.getByLabelText('メニュー 1')).toHaveValue('ワッフル');
  expect(screen.getByLabelText('売上個数')).toHaveValue('64');
  expect(screen.queryByLabelText('メニュー 2')).not.toBeInTheDocument();
});

test('PDF出力ボタン', async () => {
  const user = userEvent.setup();
  saveData({ group: null, receipts: [receipt()], summary: emptySummary() });
  render(<App />);
  await user.click(btn('PDF出力'));
  expect(exportPdf).toHaveBeenCalledTimes(1);
  expect(vi.mocked(exportPdf).mock.calls[0][0].receipts[0].storeName).toBe('イオン駅前');

  vi.mocked(exportPdf).mockRejectedValueOnce(new Error('x'));
  await user.click(btn('PDF出力'));
  expect(await screen.findByText(/PDFの作成に失敗しました/)).toBeInTheDocument();
});
