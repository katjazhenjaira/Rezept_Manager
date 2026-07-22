// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LandingPage } from '../LandingPage';

describe('LandingPage', () => {
  it('renders the heading and CTA buttons', () => {
    render(<LandingPage onGoToLogin={vi.fn()} onGoToSignup={vi.fn()} />);

    expect(screen.getByText('Rezept Manager')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Зарегистрироваться' })).toBeInTheDocument();
  });

  it('fires onGoToLogin and onGoToSignup when the respective buttons are clicked', () => {
    const onGoToLogin = vi.fn();
    const onGoToSignup = vi.fn();
    render(<LandingPage onGoToLogin={onGoToLogin} onGoToSignup={onGoToSignup} />);

    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));
    expect(onGoToLogin).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Зарегистрироваться' }));
    expect(onGoToSignup).toHaveBeenCalledTimes(1);
  });
});
