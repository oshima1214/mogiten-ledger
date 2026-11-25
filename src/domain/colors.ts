/** 店（レシート）ごとの色。PDFとホーム画面で同じ順に使う。 */
export interface StoreColor {
  /** 店の合計セル・カードの帯 */
  solid: [number, number, number];
  /** 商品行の薄い背景 */
  tint: [number, number, number];
}

export const STORE_COLORS: StoreColor[] = [
  { solid: [255, 230, 0], tint: [255, 251, 214] }, // 黄
  { solid: [0, 176, 240], tint: [224, 245, 253] }, // 青
  { solid: [255, 102, 255], tint: [255, 230, 255] }, // 桃
  { solid: [112, 173, 71], tint: [233, 244, 225] }, // 緑
  { solid: [255, 192, 0], tint: [255, 242, 204] }, // 橙
  { solid: [155, 120, 230], tint: [238, 232, 252] }, // 紫
  { solid: [255, 110, 110], tint: [255, 232, 232] }, // 赤
  { solid: [0, 200, 180], tint: [220, 247, 243] }, // 青緑
];

export const storeColor = (index: number): StoreColor => STORE_COLORS[index % STORE_COLORS.length];

export const rgb = ([r, g, b]: [number, number, number]) => `rgb(${r} ${g} ${b})`;
