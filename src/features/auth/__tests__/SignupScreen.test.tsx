// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SignupScreen } from '../SignupScreen';

vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: vi.fn(),
}));
vi.mock('@/infrastructure/firebaseAuth', () => ({
  auth: {},
}));

import { createUserWithEmailAndPassword } from 'firebase/auth';

describe('SignupScreen', () => {
  const onGoToLogin = vi.fn();
  const onBack = vi.fn();

  beforeEach(() => vi.clearAllMocks());

  function fillForm(email: string, password: string, confirm: string) {
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: password } });
    fireEvent.change(screen.getByLabelText('Подтвердите пароль'), { target: { value: confirm } });
  }

  it('calls createUserWithEmailAndPassword with correct credentials', async () => {
    vi.mocked(createUserWithEmailAndPassword).mockResolvedValueOnce({} as never);
    render(<SignupScreen onGoToLogin={onGoToLogin} onBack={onBack} />);

    fillForm('new@test.com', 'secret123', 'secret123');
    fireEvent.click(screen.getByRole('button', { name: 'Зарегистрироваться' }));

    await waitFor(() => {
      expect(createUserWithEmailAndPassword).toHaveBeenCalledWith({}, 'new@test.com', 'secret123');
    });
  });

  it('shows error when passwords do not match — no Firebase call', () => {
    render(<SignupScreen onGoToLogin={onGoToLogin} onBack={onBack} />);
    fillForm('a@b.com', 'pass123', 'mismatch');
    fireEvent.click(screen.getByRole('button', { name: 'Зарегистрироваться' }));

    expect(screen.getByText('Пароли не совпадают')).toBeInTheDocument();
    expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it('shows error when password is shorter than 6 chars — no Firebase call', () => {
    render(<SignupScreen onGoToLogin={onGoToLogin} onBack={onBack} />);
    fillForm('a@b.com', '12', '12');
    fireEvent.click(screen.getByRole('button', { name: 'Зарегистрироваться' }));

    expect(screen.getByText('Пароль должен содержать не менее 6 символов')).toBeInTheDocument();
    expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it('shows Russian error for email-already-in-use', async () => {
    const error = Object.assign(new Error(), { code: 'auth/email-already-in-use' });
    vi.mocked(createUserWithEmailAndPassword).mockRejectedValueOnce(error);
    render(<SignupScreen onGoToLogin={onGoToLogin} onBack={onBack} />);

    fillForm('existing@test.com', 'pass123', 'pass123');
    fireEvent.click(screen.getByRole('button', { name: 'Зарегистрироваться' }));

    await waitFor(() => {
      expect(screen.getByText('Аккаунт с таким email уже существует')).toBeInTheDocument();
    });
  });
});
