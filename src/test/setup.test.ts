import { describe, it, expect } from 'vitest';

describe('test setup', () => {
  it('registers @testing-library/jest-dom matchers', () => {
    const el = document.createElement('div');
    el.textContent = 'Yejin';
    document.body.appendChild(el);
    // toBeInTheDocument is provided by jest-dom via setupFiles
    expect(el).toBeInTheDocument();
  });
});
