/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { __CLASS__Page } from './__KEBAB__-page';

describe('__CLASS__Page', () => {
  it('renderiza o título do módulo', () => {
    render(<__CLASS__Page />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('__CLASS__');
  });
});
