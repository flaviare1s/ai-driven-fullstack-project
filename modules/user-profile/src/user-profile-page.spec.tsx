/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { UserProfilePage } from './user-profile-page';

describe('UserProfilePage', () => {
  it('renderiza o título do módulo', () => {
    render(<UserProfilePage />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('UserProfile');
  });
});
