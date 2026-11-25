# mogiten-ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 模擬店で購入した商品を店ごとに記録し、外税・内税と税率8%/10%を踏まえて集計し、表形式のPDFで出力するスマホ優先のWebアプリを作る。

**Architecture:** 計算・検証・PDFの表データ作りは React に依存しない純粋な TypeScript 関数（`src/domain`, `src/pdf/buildTable.ts`）にまとめ、単体テストで固める。保存は localStorage を包む小さな repository。UI は React の数コンポーネントで、状態は `App` に1つだけ持つ。PDF は jsPDF + jspdf-autotable で、日本語フォントを出力時に読み込んで埋め込む。

**Tech Stack:** Vite 6, React 18.3, TypeScript 5, Vitest 2 + @testing-library/react + jsdom, jsPDF 2.5.2, jspdf-autotable 3.8.4, BIZ UDPGothic（OFL, 静的TTF）

**Spec:** `docs/superpowers/specs/2026-11-25-mogiten-ledger-design.md`

## Global Constraints

- データは端末内（localStorage）のみ。サーバー・外部API・解析ツールは使わない。
- 金額は**円の整数**。内部で小数を持たない。
- 税率の型は `8 | 10 | null`。商品フォームの初期値は `null`（未選択）で、`null` のままでは登録できない。
- 外税の税額 = `Math.floor(税率ごとの小計 * rate / 100)`。店ごと・税率ごとに1回だけ計算（商品ごとに丸めない）。
- 税額が0円の税率の行は、画面にもPDFにも出さない。内税の店には税額の行を出さない。
- 表示の文言：「外税」「内税」「消費税 8%」「消費税 10%」「店の合計」「総合計」。金額表示は `¥1,234` 形式。
- スマホ幅（360px）で横スクロールが出ないこと。PC幅でも崩れないこと。
- localStorage のキーは `mogiten-ledger/v1`。

## Review Focus

1. **金額欄に不正な値**（空、`0`、負の数、`120.5`、全角数字`３００`、9桁超）→ 全角は半角に直して受け付け、それ以外は登録を拒否してエラー文を出す。→ Task 2 のテストで固定。
2. **登録後に店の外税/内税を切り替える** → 既存の商品はそのまま、合計と税額行が即座に再計算される。→ Task 7 のテストで固定。
3. **localStorage が壊れている・使えない**（不正JSON、別形式、プライベートモードで例外）→ 起動は止まらず空の状態で始まる。→ Task 3 のテストで固定。
4. **商品が0件の店をPDFに出す** → 見出し行と「店の合計 ¥0」だけを出し、エラーにしない。→ Task 4 のテストで固定。
5. **長い店名・商品名がPDFで切れる** → セル内で折り返して全文が見える。→ Task 5 の目視確認手順で固定。

---

### Task 1: プロジェクト雛形と型・集計ロジック

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`（`App` を描画するだけ）, `src/App.tsx`（仮：見出しのみ）
- Create: `src/domain/types.ts`
- Create: `src/domain/calc.ts`
- Test: `src/domain/calc.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // types.ts
  export type TaxRate = 8 | 10;
  export type TaxMode = 'exclusive' | 'inclusive'; // 外税 | 内税
  export interface Item { id: string; name: string; price: number; taxRate: TaxRate }
  export interface Store { id: string; name: string; taxMode: TaxMode; items: Item[] }
  export interface StoreTotals {
    subtotal8: number; subtotal10: number;
    tax8: number; tax10: number;   // 内税の店では常に 0
    total: number;
  }
  // calc.ts
  export function calcStoreTotals(store: Store): StoreTotals;
  export function calcGrandTotal(stores: Store[]): number;
  export function formatYen(n: number): string; // 1234 -> "¥1,234"
  ```

- [ ] **Step 1: 雛形を作る**
  `npm create vite@latest . -- --template react-ts` 相当の構成を手で置く（生成物の不要なサンプルは削除）。devDependencies に `vitest@2`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom` を入れ、`vite.config.ts` の `test` に `environment: 'jsdom'`, `globals: true`, `setupFiles: ['src/test-setup.ts']`（jest-dom を import）。`package.json` の scripts に `"test": "vitest run"`。

- [ ] **Step 2: 失敗するテストを書く** `src/domain/calc.test.ts`
  ```ts
  const item = (price: number, taxRate: 8 | 10) => ({ id: crypto.randomUUID(), name: 'x', price, taxRate });
  test('外税: 税率ごとに小計から切り捨てで税額を出す', () => {
    const s = { id: 's', name: 'A', taxMode: 'exclusive' as const,
      items: [item(150, 8), item(155, 8), item(300, 10), item(105, 10)] };
    expect(calcStoreTotals(s)).toEqual({ subtotal8: 305, subtotal10: 405, tax8: 24, tax10: 40, total: 774 });
  });
  test('外税: 商品ごとではなく小計で丸める', () => {
    const s = { id: 's', name: 'A', taxMode: 'exclusive' as const, items: [item(10, 8), item(10, 8)] };
    expect(calcStoreTotals(s).tax8).toBe(1); // 0+0 ではなく floor(20*0.08)=1
  });
  test('内税: 税額は0で合計は金額の和', () => {
    const s = { id: 's', name: 'B', taxMode: 'inclusive' as const, items: [item(300, 8), item(500, 10)] };
    expect(calcStoreTotals(s)).toEqual({ subtotal8: 300, subtotal10: 500, tax8: 0, tax10: 0, total: 800 });
  });
  test('商品0件', () => {
    expect(calcStoreTotals({ id: 's', name: 'C', taxMode: 'exclusive', items: [] }).total).toBe(0);
  });
  test('総合計', () => { /* 上の外税774の店 + 内税800の店 → 1574 */ });
  test('formatYen', () => { expect(formatYen(1234)).toBe('¥1,234'); expect(formatYen(0)).toBe('¥0'); });
  ```

- [ ] **Step 3: 失敗を確認** — Run: `npx vitest run src/domain/calc.test.ts` / Expected: FAIL（`calcStoreTotals` が未定義）

- [ ] **Step 4: `types.ts` と `calc.ts` を実装** — `formatYen` は `'¥' + n.toLocaleString('ja-JP')`。

- [ ] **Step 5: 成功を確認** — Run: `npx vitest run src/domain/calc.test.ts` / Expected: 6 passed。`npx tsc --noEmit` もエラーなし。

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: scaffold app and add tax calculation"`（`node_modules` は `.gitignore` に入れる）

---

### Task 2: 商品入力の検証

**Files:**
- Create: `src/domain/validate.ts`
- Test: `src/domain/validate.test.ts`

**Interfaces:**
- Consumes: `TaxRate`, `Item`（Task 1）
- Produces:
  ```ts
  export interface ItemDraft { name: string; price: string; taxRate: TaxRate | null }
  export type ValidationResult =
    | { ok: true; value: Omit<Item, 'id'> }
    | { ok: false; errors: Partial<Record<'name' | 'price' | 'taxRate', string>> };
  export function validateItemDraft(d: ItemDraft): ValidationResult;
  export function validateStoreName(name: string): string | null; // エラー文 or null
  ```

- [ ] **Step 1: 失敗するテストを書く** — エラー文は以下で固定：
  - 名前が空白のみ → `errors.name === '商品名を入力してください'`
  - 金額 `''` → `errors.price === '金額を入力してください'`
  - 金額 `'0'`, `'-5'`, `'120.5'`, `'abc'` → `errors.price === '1円以上の整数で入力してください'`
  - 金額 `'1000000000'`（10桁）→ `errors.price === '金額が大きすぎます'`（上限 `99_999_999`）
  - 金額 `'３００'`（全角）→ ok で `price === 300`
  - `taxRate: null` → `errors.taxRate === '税率（8% か 10%）を選んでください'`
  - 名前・金額・税率がすべて正しい → `{ ok: true, value: { name: 'たこ焼き', price: 300, taxRate: 8 } }`（名前は前後空白を除去）
  - `validateStoreName('  ')` → `'店名を入力してください'`、`validateStoreName('3年A組')` → `null`

- [ ] **Step 2: 失敗を確認** — Run: `npx vitest run src/domain/validate.test.ts` / Expected: FAIL

- [ ] **Step 3: 実装** — 全角数字は `String.prototype.normalize('NFKC')` で半角化してから `/^\d+$/` で判定。複数のエラーは同時に返す。

- [ ] **Step 4: 成功を確認** — Run: 同上 / Expected: all passed

- [ ] **Step 5: Commit** — `git commit -m "feat: validate item and store input"`

---

### Task 3: localStorage への保存

**Files:**
- Create: `src/storage/repository.ts`
- Test: `src/storage/repository.test.ts`

**Interfaces:**
- Consumes: `Store`（Task 1）
- Produces:
  ```ts
  export const STORAGE_KEY = 'mogiten-ledger/v1';
  export function loadStores(storage?: Storage): Store[];        // 既定は window.localStorage
  export function saveStores(stores: Store[], storage?: Storage): boolean; // 失敗時 false
  ```
  保存形式: `{ "version": 1, "stores": Store[] }`

- [ ] **Step 1: 失敗するテストを書く**
  - 保存して読み込むと同じ配列が返る（往復）
  - キーが無い → `[]`
  - 値が `'{broken'` → `[]`（例外を投げない）
  - 値が `{"version":2,...}` や `{"stores":"x"}` → `[]`
  - `taxRate` が 8/10 以外の商品、`price` が整数でない商品を含む店 → その商品だけ捨てて残りは読む
  - `getItem`/`setItem` が例外を投げる Storage を渡す → `loadStores` は `[]`、`saveStores` は `false`

- [ ] **Step 2: 失敗を確認** — Run: `npx vitest run src/storage` / Expected: FAIL

- [ ] **Step 3: 実装** — 読み込み時に形を手で検査する（ライブラリは入れない）。

- [ ] **Step 4: 成功を確認** — Run: 同上 / Expected: all passed

- [ ] **Step 5: Commit** — `git commit -m "feat: persist stores in localStorage"`

---

### Task 4: PDF用の表データを組み立てる

**Files:**
- Create: `src/pdf/buildTable.ts`
- Test: `src/pdf/buildTable.test.ts`

**Interfaces:**
- Consumes: `Store`, `calcStoreTotals`, `calcGrandTotal`, `formatYen`（Task 1）
- Produces:
  ```ts
  export type RowKind = 'storeHeader' | 'item' | 'tax' | 'storeTotal' | 'grandTotal';
  export interface TableRow { kind: RowKind; cells: [string, string, string] } // [店名/商品名, 税率, 金額]
  export const TABLE_HEAD: [string, string, string] = ['店名 / 商品名', '税率', '金額'];
  export function buildTableRows(stores: Store[]): TableRow[];
  ```

- [ ] **Step 1: 失敗するテストを書く** — 外税の店A（たこ焼き ¥300 8%、ラムネ ¥150 10%）と内税の店B（クレープ ¥400 8%）で、`buildTableRows([A, B])` が次と一致：
  ```ts
  [
    { kind: 'storeHeader', cells: ['店A（外税）', '', ''] },
    { kind: 'item',        cells: ['たこ焼き', '8%', '¥300'] },
    { kind: 'item',        cells: ['ラムネ', '10%', '¥150'] },
    { kind: 'tax',         cells: ['消費税 8%', '', '¥24'] },
    { kind: 'tax',         cells: ['消費税 10%', '', '¥15'] },
    { kind: 'storeTotal',  cells: ['店の合計', '', '¥489'] },
    { kind: 'storeHeader', cells: ['店B（内税）', '', ''] },
    { kind: 'item',        cells: ['クレープ', '8%', '¥400'] },
    { kind: 'storeTotal',  cells: ['店の合計', '', '¥400'] },
    { kind: 'grandTotal',  cells: ['総合計', '', '¥889'] },
  ]
  ```
  追加テスト：外税で10%の商品だけの店 → `消費税 8%` の行が無い。外税で `¥10` 8%が1つだけ（税額0円）→ 税の行が1つも無い。商品0件の店 → 見出しと `店の合計 ¥0` の2行だけ。`buildTableRows([])` → `総合計 ¥0` の1行。

- [ ] **Step 2: 失敗を確認** — Run: `npx vitest run src/pdf/buildTable.test.ts` / Expected: FAIL

- [ ] **Step 3: 実装**

- [ ] **Step 4: 成功を確認** — Expected: all passed

- [ ] **Step 5: Commit** — `git commit -m "feat: build PDF table rows"`

---

### Task 5: PDFを描画して保存する

**Files:**
- Create: `public/fonts/BIZUDPGothic-Regular.ttf`, `public/fonts/OFL.txt`
- Create: `src/pdf/exportPdf.ts`
- Test: `src/pdf/exportPdf.test.ts`

**Interfaces:**
- Consumes: `buildTableRows`, `TABLE_HEAD`, `TableRow`（Task 4）
- Produces:
  ```ts
  export async function createPdf(stores: Store[], fontBase64: string, now?: Date): Promise<jsPDF>;
  export async function exportPdf(stores: Store[]): Promise<void>; // フォント取得 → createPdf → save
  export function pdfFileName(now: Date): string; // "mogiten-ledger_2026-11-25.pdf"
  ```

- [ ] **Step 1: フォントを置く** — `https://github.com/google/fonts/raw/main/ofl/bizudpgothic/BIZUDPGothic-Regular.ttf` と同じフォルダの `OFL.txt` を `public/fonts/` に置く。`npm i jspdf@2.5.2 jspdf-autotable@3.8.4`。

- [ ] **Step 2: 失敗するテストを書く**
  - `pdfFileName(new Date(2026, 10, 25))` → `'mogiten-ledger_2026-11-25.pdf'`
  - テスト用にフォントファイルを `fs` で読み base64 化し、`createPdf([店A, 店B], font)` の結果 `doc.getNumberOfPages()` が `1` 以上で、`doc.output('arraybuffer').byteLength > 0`
  - 商品60件の店 → ページ数 `>= 2`（自動改ページ）

- [ ] **Step 3: 失敗を確認** — Run: `npx vitest run src/pdf/exportPdf.test.ts` / Expected: FAIL

- [ ] **Step 4: 実装** — `doc.addFileToVFS` + `addFont(..., 'BIZUDPGothic', 'normal')` + `setFont`。A4縦、上部にタイトル「模擬店 購入記録」と出力日（`YYYY/MM/DD`）。`autoTable` に `head: [TABLE_HEAD]`, `body: rows.map(r => r.cells)`, `styles: { font: 'BIZUDPGothic', overflow: 'linebreak' }`、金額列は右寄せ。`didParseCell` で `kind` ごとに見た目を変える：`storeHeader` は背景色付き、`tax` は文字を灰色、`storeTotal`/`grandTotal` は背景色付き（`grandTotal` は濃い色）。jsPDF は太字ウェイトを埋め込まないので強調は背景色で行う。`exportPdf` は `fetch('/fonts/BIZUDPGothic-Regular.ttf')` を初回だけ読み、モジュール内に覚えておく。

- [ ] **Step 5: 成功を確認** — Run: 同上 / Expected: all passed

- [ ] **Step 6: 目視確認** — 長い店名（40文字）と長い商品名（60文字）を含む店で一時スクリプトからPDFを書き出し、日本語が文字化けせず、セル内で折り返して全文が見えることを確認する（Review Focus 5）。

- [ ] **Step 7: Commit** — `git commit -m "feat: export table PDF with Japanese font"`

---

### Task 6: 店の一覧と追加・削除のUI

**Files:**
- Modify: `src/App.tsx`
- Create: `src/ui/StoreList.tsx`, `src/ui/AddStoreForm.tsx`, `src/styles.css`
- Test: `src/ui/App.test.tsx`

**Interfaces:**
- Consumes: `loadStores`, `saveStores`（Task 3）, `validateStoreName`（Task 2）, `calcStoreTotals`, `calcGrandTotal`, `formatYen`（Task 1）
- Produces:
  - `App` が `stores: Store[]` を持ち、変更のたびに `saveStores` を呼ぶ。
  - `AddStoreForm` の props: `{ onAdd(name: string, taxMode: TaxMode): void }`。税表示は「外税」「内税」のラジオで、**こちらも初期値は未選択**にして選ばないと追加できない（エラー文 `'外税か内税かを選んでください'`）。
  - `StoreList` の props: `{ stores: Store[]; onSelect(id: string): void; onDelete(id: string): void }`。各行に店名・「外税/内税」のバッジ・店の合計を出す。画面下に総合計。

- [ ] **Step 1: 失敗するテストを書く**（@testing-library/react、各テスト前に `localStorage.clear()`）
  - 店名「3年A組」と「外税」を選んで追加 → 一覧に「3年A組」「外税」「¥0」が出る
  - 店名だけで追加ボタン → `'外税か内税かを選んでください'` が出て一覧は増えない
  - 追加後に `render(<App />)` し直す → 店が残っている
  - 削除ボタン → `window.confirm` を `true` にスタブすると消える、`false` なら残る

- [ ] **Step 2: 失敗を確認** — Run: `npx vitest run src/ui` / Expected: FAIL

- [ ] **Step 3: 実装** — スマホ優先のCSS：本文は1カラム、ボタンとタップ領域は高さ44px以上、`max-width: 720px` で中央寄せ（PC対応）。

- [ ] **Step 4: 成功を確認** — Expected: all passed

- [ ] **Step 5: Commit** — `git commit -m "feat: add store list UI"`

---

### Task 7: 店の詳細画面（商品入力・税額表示・税表示の切替）

**Files:**
- Create: `src/ui/StoreDetail.tsx`, `src/ui/ItemForm.tsx`, `src/ui/TotalsBlock.tsx`
- Modify: `src/App.tsx`（選択中の店IDを持ち、一覧と詳細を切り替える）
- Test: `src/ui/StoreDetail.test.tsx`

**Interfaces:**
- Consumes: `validateItemDraft`, `ItemDraft`（Task 2）, `calcStoreTotals`, `formatYen`（Task 1）
- Produces:
  - `StoreDetail` の props: `{ store: Store; onChange(store: Store): void; onBack(): void }`
  - `ItemForm` の props: `{ onAdd(item: Omit<Item, 'id'>): void }`。税率は「8%」「10%」の2つのトグルボタンで、初期状態はどちらも未選択。登録成功後は名前・金額・税率をすべて初期状態（税率は未選択）に戻す。金額欄は `inputMode="numeric"`。
  - `TotalsBlock` の props: `{ store: Store }`。外税なら「小計」「消費税 8%」「消費税 10%」（0円の行は出さない）「店の合計」、内税なら「店の合計」と「(税込)」の表記だけ。

- [ ] **Step 1: 失敗するテストを書く**
  - 税率を選ばずに登録 → `'税率（8% か 10%）を選んでください'` が出て商品は増えない
  - 「たこ焼き」「300」「8%」で登録 → 一覧に出て、フォームの税率がどちらも未選択（`aria-pressed="false"`）に戻る
  - 外税の店に 8% ¥300 だけ → 「消費税 8%」`¥24` が出て「消費税 10%」の行は無い
  - 同じ店を「内税」に切り替える → 「消費税」の行が消え、店の合計が `¥324` から `¥300` に変わる（Review Focus 2）
  - 商品の削除ボタン → 消えて合計が再計算される

- [ ] **Step 2: 失敗を確認** — Run: `npx vitest run src/ui/StoreDetail.test.tsx` / Expected: FAIL

- [ ] **Step 3: 実装** — 税表示の切替は詳細画面上部のセグメントボタン。

- [ ] **Step 4: 成功を確認** — Expected: all passed

- [ ] **Step 5: Commit** — `git commit -m "feat: item entry and tax display per store"`

---

### Task 8: PDF出力ボタンと仕上げ

**Files:**
- Modify: `src/App.tsx`, `src/ui/StoreList.tsx`
- Create: `README.md`（使い方、フォントのライセンス表記）
- Test: `src/ui/App.test.tsx`（追記）

**Interfaces:**
- Consumes: `exportPdf`（Task 5）

- [ ] **Step 1: 失敗するテストを書く** — `vi.mock('../pdf/exportPdf')` して、一覧画面の「PDFで出力」ボタンを押すと `exportPdf` が現在の `stores` で1回呼ばれる。店が0件のときボタンは `disabled`。`exportPdf` が reject したら `'PDFの作成に失敗しました'` が出る。

- [ ] **Step 2: 失敗を確認** — Run: `npx vitest run src/ui/App.test.tsx` / Expected: FAIL

- [ ] **Step 3: 実装** — 出力中はボタンを `disabled` にして文言を「作成中…」に。

- [ ] **Step 4: 全体確認** — Run: `npm test && npx tsc --noEmit && npm run build` / Expected: すべて成功。`npm run preview` を Playwright で 360×740 と 1280×800 で開き、横スクロールが無いこと（`document.documentElement.scrollWidth <= innerWidth`）と、店追加→商品追加→PDF出力が通ることを確認する。

- [ ] **Step 5: Commit** — `git commit -m "feat: PDF export button and README"`
