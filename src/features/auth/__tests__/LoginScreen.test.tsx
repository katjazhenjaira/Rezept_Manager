// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginScreen } from '../LoginScreen';

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: vi.fn(),
}));
vi.mock('@/infrastructure/firebaseAuth', () => ({
  auth: {},
}));

import { signInWithEmailAndPassword } from 'firebase/auth';

describe('LoginScreen', () => {
  const onGoToSignup = vi.fn();
  const onBack = vi.fn();

  beforeEach(() => vi.clearAllMocks());

  it('calls signInWithEmailAndPassword with correct credentials on submit', async () => {
    vi.mocked(signInWithEmailAndPassword).mockResolvedValueOnce({} as never);
    render(<LoginScreen onGoToSignup={onGoToSignup} onBack={onBack} />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));

    await waitFor(() => {
      expect(signInWithEmailAndPassword).toHaveBeenCalledWith({}, 'test@test.com', 'password123');
    });
  });

  it('shows Russian error message for wrong password', async () => {
    const error = Object.assign(new Error('wrong password'), { code: 'auth/wrong-password' });
    vi.mocked(signInWithEmailAndPassword).mockRejectedValueOnce(error);
    render(<LoginScreen onGoToSignup={onGoToSignup} onBack={onBack} />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));

    await waitFor(() => {
      expect(screen.getByText('Неверный пароль')).toBeInTheDocument();
    });
  });

  it('disables submit button while request is in flight', async () => {
    vi.mocked(signInWithEmailAndPassword).mockImplementation(() => new Promise(() => {}));
    render(<LoginScreen onGoToSignup={onGoToSignup} onBack={onBack} />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));

    expect(screen.getByRole('button', { name: 'Войти' })).toBeDisabled();
  });
});
