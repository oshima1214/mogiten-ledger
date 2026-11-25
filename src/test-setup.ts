import '@testing-library/jest-dom/vitest';

// jsdom は scrollTo を実装していない
window.scrollTo = () => {};
