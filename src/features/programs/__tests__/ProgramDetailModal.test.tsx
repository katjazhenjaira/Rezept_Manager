// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { createRef } from 'react';
import { RepositoryContext, type Repositories } from '@/app/providers/RepositoryContext';
import { FakeRecipesRepository } from '@/infrastructure/testing/FakeRecipesRepository';
import { FakePlannerRepository } from '@/infrastructure/testing/FakePlannerRepository';
import { FakeCartRepository } from '@/infrastructure/testing/FakeCartRepository';
import { FakeProgramsRepository } from '@/infrastructure/testing/FakeProgramsRepository';
import { FakeUserProfileRepository } from '@/infrastructure/testing/FakeUserProfileRepository';
import { FakeNutritionPlanRepository } from '@/infrastructure/testing/FakeNutritionPlanRepository';
import type { Program, Recipe, Subfolder, UserProfile } from '@/shared/domain/types';
import { ProgramDetailModal, type ProgramDetailModalProps } from '../ProgramDetailModal';

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

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'r1',
    title: 'Омлет',
    time: '10 мин',
    servings: 1,
    categories: ['Завтрак'],
    ingredients: ['Яйца 2 шт'],
    steps: ['Взбить'],
    macros: { calories: 200, proteins: 14, fats: 15, carbs: 2 },
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

function makeProgram(overrides: Partial<Program> = {}): Program {
  return {
    id: 'p1',
    name: 'Сушка',
    description: 'Программа на месяц',
    creator: 'Я',
    link: '',
    recipeIds: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeRepositories(): Repositories {
  return {
    recipes: new FakeRecipesRepository(),
    planner: new FakePlannerRepository(),
    cart: new FakeCartRepository(),
    programs: new FakeProgramsRepository(),
    userProfile: new FakeUserProfileRepository(),
    nutritionPlan: new FakeNutritionPlanRepository(),
  };
}

type RenderOptions = {
  program?: Program;
  recipes?: Recipe[];
  profile?: UserProfile;
};

function renderModal(options: RenderOptions = {}) {
  const { program = makeProgram(), recipes = [], profile = mockProfile } = options;
  const repos = makeRepositories();
  const onSelectRecipe = vi.fn<(recipe: Recipe) => void>();
  const onClose = vi.fn<() => void>();

  const props: ProgramDetailModalProps = {
    program,
    recipes,
    userProfile: profile,
    availableCategories: ['Завтрак'],
    programRecipeFilter: 'Все',
    onProgramRecipeFilterChange: vi.fn(),
    onClose,
    onDeleteProgram: vi.fn(),
    onStartRecipeSelection: vi.fn(),
    onRecipeTargetSet: vi.fn(),
    recipeTarget: null,
    onRecipeTargetCleared: vi.fn(),
    photoInputRef: createRef<HTMLInputElement>(),
    isAddingManual: false,
    onIsAddingManualChange: vi.fn(),
    isAddingLink: false,
    onIsAddingLinkChange: vi.fn(),
    isAddingPDF: false,
    onIsAddingPDFChange: vi.fn(),
    isScanning: false,
    onIsScanningChange: vi.fn(),
    onSelectRecipe,
  };

  const view = render(
    <RepositoryContext.Provider value={repos}>
      <ProgramDetailModal {...props} />
    </RepositoryContext.Provider>,
  );

  return { ...view, repos, onSelectRecipe, onClose };
}

/** Карточка подпапки — она же drop-зона: кнопка-переключатель лежит прямо в ней. */
function subfolderCard(name: string): HTMLElement {
  const toggle = screen.getByText(name).closest('button');
  const card = toggle?.parentElement;
  if (!card) throw new Error(`Карточка подпапки "${name}" не найдена`);
  return card;
}

/** Секция «Загруженные рецепты» — drop-зона корня программы (subfolderId === 'main'). */
function mainRecipesCard(): HTMLElement {
  const toggle = screen.getByText('Загруженные рецепты').closest('button');
  const card = toggle?.parentElement;
  if (!card) throw new Error('Секция «Загруженные рецепты» не найдена');
  return card;
}

/**
 * Иконочные кнопки подпапки (редактировать / удалить) не имеют доступного имени —
 * отбираем их как единственные кнопки карточки без текста, первая из них — «редактировать».
 */
function subfolderEditButton(name: string): HTMLElement {
  const iconButtons = within(subfolderCard(name))
    .getAllByRole('button')
    .filter((button) => button.textContent === '');
  const editButton = iconButtons[0];
  if (!editButton) throw new Error(`Кнопка редактирования подпапки "${name}" не найдена`);
  return editButton;
}

/** Нативный drop с подменённым dataTransfer — RTL не умеет эмулировать полный drag-n-drop. */
function dropRecipe(target: Element, recipeId: string, sourceSubfolderId: string) {
  const payload: Record<string, string> = { recipeId, sourceSubfolderId };
  fireEvent.drop(target, {
    dataTransfer: { getData: (key: string) => payload[key] ?? '' },
  });
}

describe('ProgramDetailModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('alert', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('рендерит название программы, подпапки и рецепты', () => {
    renderModal({
      program: makeProgram({
        recipeIds: ['r1'],
        subfolders: [makeSubfolder({ recipeIds: ['r2'] })],
      }),
      recipes: [makeRecipe(), makeRecipe({ id: 'r2', title: 'Творог' })],
    });

    expect(screen.getByText('Программа: Сушка')).toBeInTheDocument();
    expect(screen.getByText('Неделя 1')).toBeInTheDocument();
    expect(screen.getByText('Загруженные рецепты')).toBeInTheDocument();
    expect(screen.getByText('Омлет')).toBeInTheDocument();
  });

  describe('handleDropRecipe — перенос рецептов между подпапками', () => {
    it('переносит рецепт из корня программы в подпапку', async () => {
      const { repos } = renderModal({
        program: makeProgram({ recipeIds: ['r1'], subfolders: [makeSubfolder()] }),
        recipes: [makeRecipe()],
      });
      const update = vi.spyOn(repos.programs, 'update');

      dropRecipe(subfolderCard('Неделя 1'), 'r1', 'main');

      await waitFor(() => expect(update).toHaveBeenCalledOnce());
      expect(update).toHaveBeenCalledWith('p1', {
        recipeIds: [],
        subfolders: [expect.objectContaining({ id: 's1', recipeIds: ['r1'] })],
      });
    });

    it('переносит рецепт из подпапки в корень программы', async () => {
      const { repos } = renderModal({
        program: makeProgram({
          recipeIds: [],
          subfolders: [makeSubfolder({ recipeIds: ['r1'] })],
        }),
        recipes: [makeRecipe()],
      });
      const update = vi.spyOn(repos.programs, 'update');

      dropRecipe(mainRecipesCard(), 'r1', 's1');

      await waitFor(() => expect(update).toHaveBeenCalledOnce());
      expect(update).toHaveBeenCalledWith('p1', {
        recipeIds: ['r1'],
        subfolders: [expect.objectContaining({ id: 's1', recipeIds: [] })],
      });
    });

    it('переносит рецепт между двумя подпапками', async () => {
      const { repos } = renderModal({
        program: makeProgram({
          recipeIds: [],
          subfolders: [
            makeSubfolder({ recipeIds: ['r1'] }),
            makeSubfolder({ id: 's2', name: 'Неделя 2' }),
          ],
        }),
        recipes: [makeRecipe()],
      });
      const update = vi.spyOn(repos.programs, 'update');

      dropRecipe(subfolderCard('Неделя 2'), 'r1', 's1');

      await waitFor(() => expect(update).toHaveBeenCalledOnce());
      expect(update).toHaveBeenCalledWith('p1', {
        recipeIds: [],
        subfolders: [
          expect.objectContaining({ id: 's1', recipeIds: [] }),
          expect.objectContaining({ id: 's2', recipeIds: ['r1'] }),
        ],
      });
    });

    it('ничего не пишет, когда источник и цель совпадают', async () => {
      const { repos } = renderModal({
        program: makeProgram({ subfolders: [makeSubfolder({ recipeIds: ['r1'] })] }),
        recipes: [makeRecipe()],
      });
      const update = vi.spyOn(repos.programs, 'update');

      dropRecipe(subfolderCard('Неделя 1'), 'r1', 's1');

      await Promise.resolve();
      expect(update).not.toHaveBeenCalled();
    });

    it('не дублирует рецепт, уже лежащий в корне программы', async () => {
      const { repos } = renderModal({
        program: makeProgram({ recipeIds: ['r1'], subfolders: [makeSubfolder()] }),
        recipes: [makeRecipe()],
      });
      const update = vi.spyOn(repos.programs, 'update');

      dropRecipe(mainRecipesCard(), 'r1', 's1');

      await waitFor(() => expect(update).toHaveBeenCalledOnce());
      expect(update.mock.calls[0]?.[1]).toMatchObject({ recipeIds: ['r1'] });
    });
  });

  describe('handleSaveEdit — редактирование целей', () => {
    function openProgramEditor() {
      fireEvent.click(screen.getByTitle('Редактировать программу'));
    }

    function fillTargets(values: [string, string, string, string]) {
      const numbers = screen.getAllByRole('spinbutton');
      values.forEach((value, index) => {
        const input = numbers[index];
        if (!input) throw new Error(`Числовое поле №${index} не найдено`);
        fireEvent.change(input, { target: { value } });
      });
    }

    it('сохраняет цели и ограничения программы', async () => {
      const { repos } = renderModal({ program: makeProgram({ targetCalories: 2000 }) });
      const update = vi.spyOn(repos.programs, 'update');

      openProgramEditor();
      fireEvent.change(screen.getByPlaceholderText('Название'), {
        target: { value: 'Сушка v2' },
      });
      fireEvent.change(screen.getByPlaceholderText('Курица, овощи...'), {
        target: { value: 'Курица, Индейка' },
      });
      fireEvent.change(screen.getByPlaceholderText('Сахар, мучное...'), {
        target: { value: 'Сахар' },
      });
      fillTargets(['1400', '120', '40', '120']);
      fireEvent.click(screen.getByText('Сохранить'));

      await waitFor(() => expect(update).toHaveBeenCalledOnce());
      expect(update).toHaveBeenCalledWith('p1', {
        name: 'Сушка v2',
        description: 'Программа на месяц',
        targetCalories: 1400,
        targetProteins: 120,
        targetFats: 40,
        targetCarbs: 120,
        resources: [],
        allowedProducts: ['Курица', 'Индейка'],
        forbiddenProducts: ['Сахар'],
      });
      await waitFor(() => expect(screen.queryByText('Сохранить')).toBeNull());
    });

    it('сохраняет цели подпапки, не трогая остальные подпапки', async () => {
      const { repos } = renderModal({
        program: makeProgram({
          subfolders: [makeSubfolder(), makeSubfolder({ id: 's2', name: 'Неделя 2' })],
        }),
      });
      const update = vi.spyOn(repos.programs, 'update');

      fireEvent.click(subfolderEditButton('Неделя 1'));
      fillTargets(['1200', '110', '35', '100']);
      fireEvent.click(screen.getByText('Сохранить'));

      await waitFor(() => expect(update).toHaveBeenCalledOnce());
      expect(update).toHaveBeenCalledWith('p1', {
        subfolders: [
          expect.objectContaining({
            id: 's1',
            targetCalories: 1200,
            targetProteins: 110,
            targetFats: 35,
            targetCarbs: 100,
          }),
          makeSubfolder({ id: 's2', name: 'Неделя 2' }),
        ],
      });
    });

    it('сообщает об ошибке и оставляет форму открытой, если запись не удалась', async () => {
      const { repos } = renderModal({ program: makeProgram() });
      vi.spyOn(repos.programs, 'update').mockRejectedValue(new Error('offline'));
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      fireEvent.click(screen.getByTitle('Редактировать программу'));
      fireEvent.click(screen.getByText('Сохранить'));

      await waitFor(() => expect(globalThis.alert).toHaveBeenCalledWith('Ошибка при сохранении'));
      expect(screen.getByText('Сохранить')).toBeInTheDocument();
      consoleError.mockRestore();
    });
  });

  describe('addProductsToCart — добавление продуктов в корзину', () => {
    const programWithProducts = () =>
      makeProgram({
        allowedProducts: ['Куриная грудка 500г', 'Соль'],
        forbiddenProducts: ['Сахар'],
      });

    it('раскладывает продукты на название и количество и помечает базовые', async () => {
      const { repos } = renderModal({ program: programWithProducts() });
      const add = vi.spyOn(repos.cart, 'add');

      fireEvent.click(screen.getByText('Добавить в корзину'));

      await waitFor(() => expect(add).toHaveBeenCalledTimes(3));
      expect(add.mock.calls[0]?.[0]).toMatchObject({
        name: 'Куриная грудка',
        amount: '500г',
        isBasic: false,
        sourceDishes: ['Из программы'],
        checked: false,
      });
      expect(add.mock.calls[1]?.[0]).toMatchObject({ name: 'Соль', amount: '', isBasic: true });
      expect(add.mock.calls[2]?.[0]).toMatchObject({ name: 'Сахар', isBasic: true });
      expect(globalThis.alert).toHaveBeenCalledWith('Продукты добавлены в корзину!');
    });

    it('пропускает пустые строки', async () => {
      const { repos } = renderModal({
        program: makeProgram({ allowedProducts: ['Творог', '   '], forbiddenProducts: [] }),
      });
      const add = vi.spyOn(repos.cart, 'add');

      fireEvent.click(screen.getByText('Добавить в корзину'));

      await waitFor(() => expect(add).toHaveBeenCalledOnce());
      expect(add.mock.calls[0]?.[0]).toMatchObject({ name: 'Творог' });
    });

    it('сообщает об ошибке, если запись в корзину не удалась', async () => {
      const { repos } = renderModal({ program: programWithProducts() });
      vi.spyOn(repos.cart, 'add').mockRejectedValue(new Error('offline'));
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      fireEvent.click(screen.getByText('Добавить в корзину'));

      await waitFor(() =>
        expect(globalThis.alert).toHaveBeenCalledWith('Ошибка при добавлении в корзину'),
      );
      expect(globalThis.alert).not.toHaveBeenCalledWith('Продукты добавлены в корзину!');
      consoleError.mockRestore();
    });
  });

  describe('handleSubfolderPdfUpload — прикрепление документа', () => {
    function fileInput(container: HTMLElement): HTMLInputElement {
      const input = container.querySelector<HTMLInputElement>('input[type="file"]');
      if (!input) throw new Error('Скрытый file-input не найден');
      return input;
    }

    it('кладёт документ в форму редактирования, ничего не записывая в репозиторий', async () => {
      const { container, repos } = renderModal({ program: makeProgram() });
      const update = vi.spyOn(repos.programs, 'update');

      fireEvent.click(screen.getByTitle('Редактировать программу'));
      fireEvent.change(fileInput(container), {
        target: { files: [new File(['%PDF'], 'plan.pdf', { type: 'application/pdf' })] },
      });

      expect(await screen.findByText('plan.pdf')).toBeInTheDocument();
      expect(update).not.toHaveBeenCalled();
    });

    it('игнорирует выбор файла, когда форма редактирования закрыта', async () => {
      const { container, repos } = renderModal({ program: makeProgram() });
      const update = vi.spyOn(repos.programs, 'update');

      fireEvent.change(fileInput(container), {
        target: { files: [new File(['%PDF'], 'plan.pdf', { type: 'application/pdf' })] },
      });

      await Promise.resolve();
      expect(update).not.toHaveBeenCalled();
      expect(globalThis.alert).not.toHaveBeenCalled();
    });
  });
});
