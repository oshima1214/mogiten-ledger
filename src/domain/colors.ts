export type RGB = [number, number, number];

/** 店（レシート）ごとの色。PDFの表・店名・店の合計と、ホーム画面のカードで同じ色を使う。 */
export const STORE_COLORS: RGB[] = [
  [255, 241, 150], // 黄
  [180, 228, 250], // 青
  [255, 200, 240], // 桃
  [205, 232, 185], // 緑
  [255, 218, 170], // 橙
  [220, 208, 250], // 紫
  [255, 200, 200], // 赤
  [175, 235, 225], // 青緑
];

export const storeColor = (index: number): RGB => STORE_COLORS[index % STORE_COLORS.length];

export const rgb = ([r, g, b]: RGB) => `rgb(${r} ${g} ${b})`;
