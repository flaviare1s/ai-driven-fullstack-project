/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { AuthPage } from './auth-page';

describe('AuthPage', () => {
  it('renderiza o título do módulo', () => {
    render(<AuthPage />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Auth');
  });
});
