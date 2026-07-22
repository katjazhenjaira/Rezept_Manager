// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
// Side-effect import: initializes the global i18next instance (ru resources) —
// SettingsModal is one of the three i18n-подключённых файлов и вызывает useTranslation().
import i18n, { changeLanguage, STORAGE_KEY } from '@/app/providers/i18nConfig';
import { UserProfileContext } from '@/app/providers/UserProfileContext';
import type { UserProfile } from '@/shared/domain/types';
import { SettingsModal } from '../SettingsModal';

vi.mock('firebase/auth', () => ({
  signOut: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/infrastructure/firebaseAuth', () => ({
  auth: {},
}));

import { signOut } from 'firebase/auth';

// Значения намеренно уникальны — позволяют находить поля по отображаемому значению.
const mockProfile: UserProfile = {
  name: 'Тест',
  age: 30,
  gender: 'female',
  currentWeight: 61,
  targetWeight: 55,
  targetCalories: 1800,
  targetProteins: 101,
  targetFats: 62,
  targetCarbs: 203,
  waterGoal: 2100,
  allergies: [],
};

const mockSaveUserProfile = vi.fn().mockResolvedValue(undefined);
const mockSetActivePlan = vi.fn().mockResolvedValue(undefined);

function makeWrapper(profile: UserProfile | null = mockProfile) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <UserProfileContext.Provider
        value={{
          userProfile: profile,
          saveUserProfile: mockSaveUserProfile,
          activeNutritionPlan: null,
          setActivePlan: mockSetActivePlan,
        }}
      >
        {children}
      </UserProfileContext.Provider>
    );
  };
}

type RenderOptions = {
  profile?: UserProfile | null;
  availableCategories?: string[];
};

function renderModal(options: RenderOptions = {}) {
  const { profile = mockProfile, availableCategories = ['Завтрак', 'Обед'] } = options;
  const setAvailableCategories = vi.fn<(setter: (prev: string[]) => string[]) => void>();
  const onCategoryRemoved = vi.fn<(cat: string) => void>();
  const onClose = vi.fn<() => void>();
  const Wrapper = makeWrapper(profile);

  render(
    <Wrapper>
      <SettingsModal
        isOpen
        onClose={onClose}
        availableCategories={availableCategories}
        setAvailableCategories={setAvailableCategories}
        onCategoryRemoved={onCategoryRemoved}
      />
    </Wrapper>,
  );

  return { setAvailableCategories, onCategoryRemoved, onClose };
}

/** Порядок числовых полей в DOM — он же порядок полей профиля в форме. */
const NUMERIC_FIELDS = [
  'age',
  'currentWeight',
  'targetWeight',
  'targetCalories',
  'targetProteins',
  'targetFats',
  'targetCarbs',
] as const;

function numericInput(field: (typeof NUMERIC_FIELDS)[number]): HTMLElement {
  const input = screen.getAllByRole('spinbutton')[NUMERIC_FIELDS.indexOf(field)];
  if (!input) throw new Error(`Числовое поле "${field}" не найдено`);
  return input;
}

function saveSettings() {
  fireEvent.click(screen.getByText('Сохранить настройки'));
}

/** «Добавить» встречается дважды (аллергии и категории) — берём кнопку рядом с полем ввода. */
function addAllergyButton(): HTMLButtonElement {
  const input = screen.getByPlaceholderText('Добавить свою...');
  const button = input.parentElement?.querySelector('button');
  if (!button) throw new Error('Кнопка добавления аллергии не найдена');
  return button;
}

function addCategoryButton(): HTMLButtonElement {
  const button = screen.getByText('Управление категориями').parentElement?.querySelector('button');
  if (!button) throw new Error('Кнопка добавления категории не найдена');
  return button;
}

/** Последний профиль, переданный в saveUserProfile. */
function lastSavedProfile(): UserProfile {
  const calls = mockSaveUserProfile.mock.calls;
  const last = calls[calls.length - 1];
  if (!last) throw new Error('saveUserProfile не вызывался');
  return last[0] as UserProfile;
}

describe('SettingsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('alert', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('не рендерит содержимое, пока isOpen=false', () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <SettingsModal
          isOpen={false}
          onClose={vi.fn()}
          availableCategories={[]}
          setAvailableCategories={vi.fn()}
          onCategoryRemoved={vi.fn()}
        />
      </Wrapper>,
    );

    expect(screen.queryByText('Настройки профиля')).toBeNull();
  });

  describe('аллергии (safety-critical constraint №1)', () => {
    it('добавляет пресетную аллергию и сохраняет её в профиль', async () => {
      renderModal();

      fireEvent.click(screen.getByText('Глютен'));
      saveSettings();

      await waitFor(() => expect(mockSaveUserProfile).toHaveBeenCalledOnce());
      expect(lastSavedProfile().allergies).toEqual(['Глютен']);
    });

    it('снимает уже отмеченную аллергию и сохраняет профиль без неё', async () => {
      renderModal({ profile: { ...mockProfile, allergies: ['Глютен', 'Орехи'] } });

      fireEvent.click(screen.getByText('Глютен'));
      saveSettings();

      await waitFor(() => expect(mockSaveUserProfile).toHaveBeenCalledOnce());
      expect(lastSavedProfile().allergies).toEqual(['Орехи']);
    });

    it('добавляет свою аллергию из текстового поля', async () => {
      renderModal();

      const input = screen.getByPlaceholderText('Добавить свою...');
      fireEvent.change(input, { target: { value: 'Гречка' } });
      fireEvent.click(addAllergyButton());
      saveSettings();

      await waitFor(() => expect(mockSaveUserProfile).toHaveBeenCalledOnce());
      expect(lastSavedProfile().allergies).toEqual(['Гречка']);
    });

    it('не дублирует уже существующую аллергию', async () => {
      renderModal({ profile: { ...mockProfile, allergies: ['Гречка'] } });

      const input = screen.getByPlaceholderText('Добавить свою...');
      fireEvent.change(input, { target: { value: 'Гречка' } });
      fireEvent.click(addAllergyButton());
      saveSettings();

      await waitFor(() => expect(mockSaveUserProfile).toHaveBeenCalledOnce());
      expect(lastSavedProfile().allergies).toEqual(['Гречка']);
    });
  });

  describe('сохранение профиля', () => {
    it('сохраняет изменённые поля и закрывает модалку', async () => {
      const { onClose } = renderModal();

      fireEvent.change(screen.getByPlaceholderText('Ваше имя'), { target: { value: 'Новое имя' } });
      fireEvent.change(numericInput('targetCalories'), { target: { value: '2000' } });
      saveSettings();

      await waitFor(() => expect(mockSaveUserProfile).toHaveBeenCalledOnce());
      expect(lastSavedProfile()).toMatchObject({ name: 'Новое имя', targetCalories: 2000 });
      await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    });

    it('показывает alert и не закрывает модалку, если сохранение упало', async () => {
      mockSaveUserProfile.mockRejectedValueOnce(new Error('offline'));
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { onClose } = renderModal();

      saveSettings();

      await waitFor(() => expect(alert).toHaveBeenCalledWith('Не удалось сохранить настройки'));
      expect(onClose).not.toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it('устанавливает цель по воде из калькулятора', async () => {
      renderModal();

      fireEvent.click(screen.getByText('Установить как цель'));
      saveSettings();

      await waitFor(() => expect(mockSaveUserProfile).toHaveBeenCalledOnce());
      expect(lastSavedProfile().waterGoal).toBe(Math.round(mockProfile.currentWeight * 35));
    });
  });

  describe('категории', () => {
    it('добавляет новую категорию', () => {
      const { setAvailableCategories } = renderModal();

      fireEvent.click(addCategoryButton());
      fireEvent.change(screen.getByPlaceholderText('Например: Праздничное'), {
        target: { value: 'Праздничное' },
      });
      fireEvent.click(screen.getByText('Создать'));

      expect(setAvailableCategories).toHaveBeenCalledOnce();
      const setter = setAvailableCategories.mock.calls[0]?.[0] as (prev: string[]) => string[];
      expect(setter(['Завтрак'])).toEqual(['Завтрак', 'Праздничное']);
    });

    it('удаляет только кастомную категорию после подтверждения', () => {
      const { setAvailableCategories, onCategoryRemoved } = renderModal({
        availableCategories: ['Завтрак', 'Праздничное'],
      });

      // У дефолтных категорий кнопки удаления нет вовсе.
      const defaultChip = screen.getByText('Завтрак').closest('div');
      expect(defaultChip?.querySelector('button')).toBeNull();

      const customChip = screen.getByText('Праздничное').closest('div');
      const deleteButton = customChip?.querySelector('button');
      expect(deleteButton).not.toBeNull();
      fireEvent.click(deleteButton as HTMLButtonElement);

      expect(screen.getByText('Удалить категорию?')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Удалить'));

      const setter = setAvailableCategories.mock.calls[0]?.[0] as (prev: string[]) => string[];
      expect(setter(['Завтрак', 'Праздничное'])).toEqual(['Завтрак']);
      expect(onCategoryRemoved).toHaveBeenCalledWith('Праздничное');
    });
  });

  describe('язык интерфейса', () => {
    afterEach(() => {
      changeLanguage('ru');
    });

    it('переключает язык и запоминает выбор', () => {
      renderModal();

      fireEvent.click(screen.getByText('🇩🇪 DE'));

      expect(i18n.language).toBe('de');
      expect(localStorage.getItem(STORAGE_KEY)).toBe('de');
    });
  });

  it('выходит из аккаунта и закрывает модалку', async () => {
    const { onClose } = renderModal();

    fireEvent.click(screen.getByText('Выйти из аккаунта'));

    await waitFor(() => expect(signOut).toHaveBeenCalledOnce());
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });
});
