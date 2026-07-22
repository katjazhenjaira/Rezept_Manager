// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { DataContext, type DataState } from '@/app/providers/DataContext';
import { UserProfileContext } from '@/app/providers/UserProfileContext';
import { RepositoryContext } from '@/app/providers/RepositoryContext';
import { FakeRecipesRepository } from '@/infrastructure/testing/FakeRecipesRepository';
import { FakePlannerRepository } from '@/infrastructure/testing/FakePlannerRepository';
import { FakeCartRepository } from '@/infrastructure/testing/FakeCartRepository';
import { FakeProgramsRepository } from '@/infrastructure/testing/FakeProgramsRepository';
import { FakeUserProfileRepository } from '@/infrastructure/testing/FakeUserProfileRepository';
import { FakeNutritionPlanRepository } from '@/infrastructure/testing/FakeNutritionPlanRepository';
import type { ActiveNutritionPlan, Program, Subfolder, UserProfile } from '@/shared/domain/types';
import { ProgramSelectionModal } from '../ProgramSelectionModal';

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

const fakeRepos = {
  recipes: new FakeRecipesRepository(),
  planner: new FakePlannerRepository(),
  cart: new FakeCartRepository(),
  programs: new FakeProgramsRepository(),
  userProfile: new FakeUserProfileRepository(),
  nutritionPlan: new FakeNutritionPlanRepository(),
};

function makeProgram(overrides: Partial<Program> = {}): Program {
  return {
    id: 'p1',
    name: 'Сушка',
    description: '',
    creator: 'Я',
    link: '',
    recipeIds: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeSubfolder(overrides: Partial<Subfolder> = {}): Subfolder {
  return {
    id: 's1',
    name: 'Неделя 1',
    description: '',
    recipeIds: [],
    ...overrides,
  };
}

type RenderOptions = {
  programs?: Program[];
  profile?: UserProfile | null;
  activePlan?: ActiveNutritionPlan | null;
};

function renderModal(options: RenderOptions = {}) {
  const { programs = [], profile = mockProfile, activePlan = null } = options;
  const onClose = vi.fn<() => void>();
  const data: DataState = { recipes: [], plannerEntries: [], cartItems: [], programs };

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <RepositoryContext.Provider value={fakeRepos}>
        <UserProfileContext.Provider
          value={{
            userProfile: profile,
            saveUserProfile: mockSaveUserProfile,
            activeNutritionPlan: activePlan,
            setActivePlan: mockSetActivePlan,
          }}
        >
          <DataContext.Provider value={data}>{children}</DataContext.Provider>
        </UserProfileContext.Provider>
      </RepositoryContext.Provider>
    );
  }

  render(
    <Wrapper>
      <ProgramSelectionModal isOpen onClose={onClose} />
    </Wrapper>,
  );

  return { onClose };
}

/** Последний план, переданный в setActivePlan (constraint №3 — active program overrides profile). */
function lastActivePlan(): ActiveNutritionPlan | null {
  const calls = mockSetActivePlan.mock.calls;
  const last = calls[calls.length - 1];
  if (!last) throw new Error('setActivePlan не вызывался');
  return last[0] as ActiveNutritionPlan | null;
}

describe('ProgramSelectionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('alert', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('не рендерит содержимое, пока isOpen=false', () => {
    render(
      <RepositoryContext.Provider value={fakeRepos}>
        <UserProfileContext.Provider
          value={{
            userProfile: mockProfile,
            saveUserProfile: mockSaveUserProfile,
            activeNutritionPlan: null,
            setActivePlan: mockSetActivePlan,
          }}
        >
          <DataContext.Provider
            value={{ recipes: [], plannerEntries: [], cartItems: [], programs: [] }}
          >
            <ProgramSelectionModal isOpen={false} onClose={vi.fn()} />
          </DataContext.Provider>
        </UserProfileContext.Provider>
      </RepositoryContext.Provider>,
    );

    expect(screen.queryByText('Выбрать программу питания')).toBeNull();
  });

  it('сбрасывает активный план на «По умолчанию»', async () => {
    const { onClose } = renderModal({
      programs: [makeProgram()],
      activePlan: {
        name: 'Сушка',
        calories: 1400,
        proteins: 120,
        fats: 40,
        carbs: 120,
        isCustom: false,
        programId: 'p1',
      },
    });

    fireEvent.click(screen.getByText('По умолчанию'));

    await waitFor(() => expect(mockSetActivePlan).toHaveBeenCalledOnce());
    expect(lastActivePlan()).toBeNull();
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  describe('выбор программы', () => {
    it('берёт КБЖУ из самой программы, когда они заданы', async () => {
      const { onClose } = renderModal({
        programs: [
          makeProgram({
            targetCalories: 1400,
            targetProteins: 120,
            targetFats: 40,
            targetCarbs: 120,
            allowedProducts: ['Курица'],
            forbiddenProducts: ['Сахар'],
          }),
        ],
      });

      fireEvent.click(screen.getByText('Сушка'));

      await waitFor(() => expect(mockSetActivePlan).toHaveBeenCalledOnce());
      expect(lastActivePlan()).toEqual({
        name: 'Сушка',
        calories: 1400,
        proteins: 120,
        fats: 40,
        carbs: 120,
        isCustom: false,
        programId: 'p1',
        allowedProducts: ['Курица'],
        forbiddenProducts: ['Сахар'],
      });
      await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    });

    it('падает на цели профиля, когда у программы КБЖУ не заданы', async () => {
      renderModal({ programs: [makeProgram()] });

      expect(screen.getByText('КБЖУ не заданы (будут взяты из настроек)')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Сушка'));

      await waitFor(() => expect(mockSetActivePlan).toHaveBeenCalledOnce());
      expect(lastActivePlan()).toMatchObject({
        calories: mockProfile.targetCalories,
        proteins: mockProfile.targetProteins,
        fats: mockProfile.targetFats,
        carbs: mockProfile.targetCarbs,
      });
    });

    it('падает на нули, когда нет ни КБЖУ программы, ни профиля', async () => {
      renderModal({ programs: [makeProgram()], profile: null });

      fireEvent.click(screen.getByText('Сушка'));

      await waitFor(() => expect(mockSetActivePlan).toHaveBeenCalledOnce());
      expect(lastActivePlan()).toMatchObject({ calories: 0, proteins: 0, fats: 0, carbs: 0 });
    });
  });

  describe('выбор подпапки — цепочка наследования КБЖУ', () => {
    it('приоритет у собственных целей подпапки', async () => {
      renderModal({
        programs: [
          makeProgram({
            targetCalories: 1400,
            targetProteins: 120,
            targetFats: 40,
            targetCarbs: 120,
            allowedProducts: ['Курица'],
            forbiddenProducts: ['Сахар'],
            subfolders: [
              makeSubfolder({
                targetCalories: 1200,
                targetProteins: 110,
                targetFats: 35,
                targetCarbs: 100,
                allowedProducts: ['Индейка'],
                forbiddenProducts: ['Мёд'],
              }),
            ],
          }),
        ],
      });

      fireEvent.click(screen.getByText('Неделя 1'));

      await waitFor(() => expect(mockSetActivePlan).toHaveBeenCalledOnce());
      expect(lastActivePlan()).toEqual({
        name: 'Сушка',
        subfolderName: 'Неделя 1',
        calories: 1200,
        proteins: 110,
        fats: 35,
        carbs: 100,
        isCustom: false,
        programId: 'p1',
        subfolderId: 's1',
        allowedProducts: ['Индейка'],
        forbiddenProducts: ['Мёд'],
      });
    });

    it('наследует цели и списки продуктов программы, когда у подпапки их нет', async () => {
      renderModal({
        programs: [
          makeProgram({
            targetCalories: 1400,
            targetProteins: 120,
            targetFats: 40,
            targetCarbs: 120,
            allowedProducts: ['Курица'],
            forbiddenProducts: ['Сахар'],
            subfolders: [makeSubfolder()],
          }),
        ],
      });

      fireEvent.click(screen.getByText('Неделя 1'));

      await waitFor(() => expect(mockSetActivePlan).toHaveBeenCalledOnce());
      expect(lastActivePlan()).toMatchObject({
        calories: 1400,
        proteins: 120,
        fats: 40,
        carbs: 120,
        allowedProducts: ['Курица'],
        forbiddenProducts: ['Сахар'],
        subfolderId: 's1',
      });
    });

    it('наследует цели профиля, когда их нет ни у подпапки, ни у программы', async () => {
      renderModal({ programs: [makeProgram({ subfolders: [makeSubfolder()] })] });

      fireEvent.click(screen.getByText('Неделя 1'));

      await waitFor(() => expect(mockSetActivePlan).toHaveBeenCalledOnce());
      expect(lastActivePlan()).toMatchObject({
        calories: mockProfile.targetCalories,
        proteins: mockProfile.targetProteins,
        fats: mockProfile.targetFats,
        carbs: mockProfile.targetCarbs,
      });
    });

    it('падает на нули, когда целей нет нигде в цепочке', async () => {
      renderModal({ programs: [makeProgram({ subfolders: [makeSubfolder()] })], profile: null });

      fireEvent.click(screen.getByText('Неделя 1'));

      await waitFor(() => expect(mockSetActivePlan).toHaveBeenCalledOnce());
      expect(lastActivePlan()).toMatchObject({ calories: 0, proteins: 0, fats: 0, carbs: 0 });
    });
  });

  it('создаёт свой план питания и сразу делает его активным', async () => {
    const addSpy = vi.spyOn(fakeRepos.programs, 'add');
    const { onClose } = renderModal();

    fireEvent.change(screen.getByPlaceholderText('Название плана (напр. Сушка)'), {
      target: { value: 'Мой план' },
    });
    fireEvent.change(screen.getByPlaceholderText('Ккал'), { target: { value: '1500' } });
    fireEvent.change(screen.getByPlaceholderText('Белки (г)'), { target: { value: '130' } });
    fireEvent.click(screen.getByText('Применить свой план'));

    await waitFor(() => expect(addSpy).toHaveBeenCalledOnce());
    expect(addSpy.mock.calls[0]?.[0]).toMatchObject({
      name: 'Мой план',
      targetCalories: 1500,
      targetProteins: 130,
    });
    await waitFor(() => expect(mockSetActivePlan).toHaveBeenCalledOnce());
    expect(lastActivePlan()).toMatchObject({
      name: 'Мой план',
      calories: 1500,
      proteins: 130,
      isCustom: true,
    });
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    addSpy.mockRestore();
  });
});
