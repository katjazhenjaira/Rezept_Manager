import React, { useState } from 'react';
import {
  BookOpen,
  Plus,
  Edit3,
  FileText,
  Trash2,
  Share2,
  FolderPlus,
  Users,
  Link as LinkIcon,
  Camera,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useRepositories } from '@/app/providers/RepositoryContext';
import { aiClient } from '@/services/ai/aiClient';
import { extractImageFromPDF, extractTextFromPDF } from '@/shared/utils/pdfUtils';
import { useData } from '@/app/providers/DataContext';
import { ProgramDetailModal } from '@/features/programs/ProgramDetailModal';
import type { Program, Recipe, UserProfile, Subfolder } from '@/shared/domain/types';

function AddRecipeOption({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full px-4 py-3 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-50 flex items-center gap-3 transition-colors"
    >
      {icon}
      {label}
    </button>
  );
}

export type ProgramsViewProps = {
  recipes: Recipe[];
  availableCategories: string[];
  userProfile: UserProfile;
  openProgramId: string | null;
  onOpenProgramIdChange: (id: string | null) => void;
  isRecipeSelectionMode: boolean;
  selectionTarget: { programId: string; subfolderId: string | 'main' } | null;
  selectedRecipeIds: string[];
  onSelectedRecipeIdsChange: (ids: string[]) => void;
  onStartRecipeSelection: (programId: string, subfolderId: string | 'main') => void;
  onAddSelectedRecipes: () => Promise<void>;
  recipeTarget: { programId: string; subfolderId: string | 'main' } | null;
  onRecipeTargetCleared: () => void;
  onRecipeTargetSet: (target: { programId: string; subfolderId: string | 'main' }) => void;
  photoInputRef: React.RefObject<HTMLInputElement | null>;
  isAddingManual: boolean;
  onIsAddingManualChange: (v: boolean) => void;
  isAddingLink: boolean;
  onIsAddingLinkChange: (v: boolean) => void;
  isAddingPDF: boolean;
  onIsAddingPDFChange: (v: boolean) => void;
  isScanning: boolean;
  onIsScanningChange: (v: boolean) => void;
  onSelectRecipe: (recipe: Recipe) => void;
};

const emptyProgramForm = {
  name: '',
  description: '',
  creator: '',
  link: '',
  recipeIds: [] as string[],
  image: '',
  pdfUrl: '',
  subfolders: [] as Subfolder[],
  allowedProducts: [] as string[],
  forbiddenProducts: [] as string[],
};

export function ProgramsView(props: ProgramsViewProps) {
  const {
    recipes,
    availableCategories,
    userProfile,
    openProgramId,
    onOpenProgramIdChange,
    onStartRecipeSelection,
    recipeTarget,
    onRecipeTargetCleared,
    onRecipeTargetSet,
    photoInputRef,
    isAddingManual,
    onIsAddingManualChange,
    isAddingLink,
    onIsAddingLinkChange,
    isAddingPDF,
    onIsAddingPDFChange,
    isScanning,
    onIsScanningChange,
    onSelectRecipe,
  } = props;

  const { programs } = useData();
  const { recipes: recipesRepo, programs: programsRepo } = useRepositories();

  const [programFormData, setProgramFormData] = useState({ ...emptyProgramForm });
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [isCreatingProgram, setIsCreatingProgram] = useState(false);
  const [isCreateProgramDropdownOpen, setIsCreateProgramDropdownOpen] = useState(false);
  const [programToDelete, setProgramToDelete] = useState<Program | null>(null);
  const [programRecipeFilter, setProgramRecipeFilter] = useState('Все');
  const [subfolderRecipeFilters, setSubfolderRecipeFilters] = useState<Record<string, string>>({});
  const [editingSubfolderId, setEditingSubfolderId] = useState<string | null>(null);

  const programPhotoInputRef = React.useRef<HTMLInputElement>(null);
  const programPdfInputRef = React.useRef<HTMLInputElement>(null);
  const subfolderPhotoInputRef = React.useRef<HTMLInputElement>(null);

  const handleProgramPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProgramFormData((prev) => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubfolderPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editingSubfolderId) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProgramFormData((prev) => ({
          ...prev,
          subfolders: prev.subfolders.map((sf) =>
            sf.id === editingSubfolderId ? { ...sf, image: reader.result as string } : sf,
          ),
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProgramPdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onIsScanningChange(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1] ?? '';
      try {
        const isLarge = base64.length > 20_000_000;
        const request = isLarge
          ? { pdfText: await extractTextFromPDF(base64), availableCategories }
          : { pdfBase64: base64, availableCategories };
        const result = await aiClient.importFromPdf(request);
        const recipeIds: string[] = [];
        for (const r of result.recipes) {
          let dishImage: string | null = null;
          if (r.pageNumber && r.dishBoundingBox) {
            const extracted = await extractImageFromPDF(base64, r.pageNumber, r.dishBoundingBox);
            if (extracted) dishImage = extracted;
          }
          if (!dishImage) {
            const generated = await aiClient.generateImage({
              title: r.title,
              ingredients: r.ingredients,
            });
            if (generated?.imageDataUri) dishImage = generated.imageDataUri;
          }
          const id = await recipesRepo.add({
            title: r.title,
            author: r.author ?? '',
            image: dishImage ?? undefined,
            time: r.time,
            servings: r.servings,
            categories: r.categories,
            ingredients: r.ingredients,
            steps: r.steps,
            macros: r.macros,
            isFavorite: false,
            createdAt: new Date().toISOString(),
          });
          recipeIds.push(id);
        }
        const inferredName = file.name.replace(/\.pdf$/i, '');
        setProgramFormData((prev) => ({
          ...prev,
          name: prev.name || inferredName,
          recipeIds,
          pdfUrl: file.name,
        }));
        alert(
          `Извлечено рецептов: ${result.recipes.length}. Проверьте название и сохраните программу.`,
        );
      } catch (error) {
        console.error('Error analyzing PDF for program:', error);
        alert('Не удалось распознать PDF. Попробуйте другой файл.');
      } finally {
        onIsScanningChange(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!programFormData.name) return;
    try {
      if (editingProgramId) {
        await programsRepo.update(editingProgramId, programFormData);
        alert('Программа обновлена');
      } else {
        await programsRepo.add({ ...programFormData, createdAt: new Date().toISOString() });
        alert('Программа создана');
      }
      setIsCreatingProgram(false);
      setEditingProgramId(null);
      setProgramFormData({ ...emptyProgramForm });
    } catch (error) {
      console.error('Error saving program:', error);
      alert('Ошибка при сохранении программы');
    }
  };

  const handleShareProgram = (programId: string) => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?programId=${programId}`;
    navigator.clipboard.writeText(shareUrl);
    alert('Ссылка скопирована в буфер обмена!');
  };

  const openProgram = openProgramId ? (programs.find((p) => p.id === openProgramId) ?? null) : null;

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-zinc-900">Программы</h2>
            <p className="text-zinc-500 mt-1">Создавайте и делитесь своими коллекциями рецептов</p>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={programRecipeFilter}
              onChange={(e) => setProgramRecipeFilter(e.target.value)}
              className="text-xs font-bold text-emerald-600 bg-emerald-50 border-none rounded-lg px-4 py-2.5 outline-none"
            >
              <option value="Все">Все категории</option>
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <div className="relative">
              <button
                onClick={() => setIsCreateProgramDropdownOpen(!isCreateProgramDropdownOpen)}
                className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                <span>Создать папку</span>
              </button>

              <AnimatePresence>
                {isCreateProgramDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsCreateProgramDropdownOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-zinc-100 overflow-hidden z-50"
                    >
                      <AddRecipeOption
                        icon={<Edit3 className="w-4 h-4 text-emerald-500" />}
                        label="Создать вручную"
                        onClick={() => {
                          setEditingProgramId(null);
                          setProgramFormData({
                            name: '',
                            description: '',
                            creator: '',
                            link: '',
                            recipeIds: [],
                            image: '',
                            pdfUrl: '',
                            subfolders: [],
                            allowedProducts: [],
                            forbiddenProducts: [],
                          });
                          setIsCreatingProgram(true);
                          setIsCreateProgramDropdownOpen(false);
                        }}
                      />
                      <AddRecipeOption
                        icon={<FileText className="w-4 h-4 text-emerald-500" />}
                        label="Загрузить PDF"
                        onClick={() => {
                          setEditingProgramId(null);
                          setProgramFormData({
                            name: '',
                            description: '',
                            creator: '',
                            link: '',
                            recipeIds: [],
                            image: '',
                            pdfUrl: '',
                            subfolders: [],
                            allowedProducts: [],
                            forbiddenProducts: [],
                          });
                          setIsCreatingProgram(true);
                          setIsCreateProgramDropdownOpen(false);
                          setTimeout(() => programPdfInputRef.current?.click(), 100);
                        }}
                      />
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {programs.length === 0 ? (
          <div className="bg-white rounded-3xl border border-zinc-100 p-12 text-center">
            <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-10 h-10 text-zinc-300" />
            </div>
            <h3 className="text-xl font-bold text-zinc-900 mb-2">У вас пока нет программ</h3>
            <p className="text-zinc-500 max-w-sm mx-auto">
              Создайте свою первую программу, добавьте в нее рецепты и поделитесь с друзьями.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {programs
              .filter(
                (p) =>
                  programRecipeFilter === 'Все' ||
                  recipes.some(
                    (r) => p.recipeIds.includes(r.id) && r.categories.includes(programRecipeFilter),
                  ) ||
                  (p.subfolders &&
                    p.subfolders.some((sf) =>
                      recipes.some(
                        (r) =>
                          sf.recipeIds.includes(r.id) && r.categories.includes(programRecipeFilter),
                      ),
                    )),
              )
              .map((program) => (
                <div
                  key={program.id}
                  onClick={() => onOpenProgramIdChange(program.id)}
                  className="bg-white rounded-3xl border border-zinc-100 overflow-hidden shadow-sm hover:shadow-md transition-all group flex flex-col cursor-pointer"
                >
                  {program.image && (
                    <div className="aspect-video w-full overflow-hidden">
                      <img
                        src={program.image}
                        alt={program.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}
                  <div className="p-6 flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <FolderPlus className="w-6 h-6" />
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingProgramId(program.id);
                            setProgramFormData({
                              name: program.name,
                              description: program.description,
                              creator: program.creator,
                              link: program.link,
                              recipeIds: program.recipeIds,
                              image: program.image || '',
                              pdfUrl: program.pdfUrl || '',
                              subfolders: program.subfolders || [],
                              allowedProducts: program.allowedProducts || [],
                              forbiddenProducts: program.forbiddenProducts || [],
                            });
                            setIsCreatingProgram(true);
                          }}
                          className="p-2 text-zinc-400 hover:text-emerald-600 transition-colors"
                        >
                          <Edit3 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setProgramToDelete(program);
                          }}
                          className="p-2 text-zinc-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShareProgram(program.id);
                          }}
                          className="p-2 text-zinc-400 hover:text-emerald-600 transition-colors"
                        >
                          <Share2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    <h3 className="text-xl font-bold text-zinc-900 mb-1">{program.name}</h3>
                    <p className="text-sm text-zinc-500 mb-4 line-clamp-2">{program.description}</p>

                    <div className="space-y-2 mb-6">
                      <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase">
                        <Users className="w-3.5 h-3.5" />
                        <span>Автор: {program.creator}</span>
                      </div>
                      {program.link && (
                        <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase">
                          <LinkIcon className="w-3.5 h-3.5" />
                          <a
                            href={
                              program.link.startsWith('http')
                                ? program.link
                                : `https://${program.link}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-600 hover:underline truncate"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {program.link}
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="mt-auto pt-4 border-t border-zinc-50 flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-400 uppercase">
                        {program.recipeIds.length} рецептов
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (confirm('Удалить эту программу?')) {
                              await programsRepo.delete(program.id);
                            }
                          }}
                          className="p-2 text-zinc-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Create/Edit Program Modal */}
        <AnimatePresence>
          {isCreatingProgram && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsCreatingProgram(false)}
                className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden p-8 max-h-[90vh] overflow-y-auto custom-scrollbar"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold">
                    {editingProgramId ? 'Редактировать папку' : 'Создать папку с рецептами'}
                  </h3>
                  <button
                    onClick={() => setIsCreatingProgram(false)}
                    className="text-zinc-400 hover:text-zinc-600"
                  >
                    <Plus className="w-6 h-6 rotate-45" />
                  </button>
                </div>

                <form onSubmit={handleCreateProgram} className="space-y-6">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-zinc-400 uppercase">
                          Фото обложки
                        </label>
                        <div
                          onClick={() => programPhotoInputRef.current?.click()}
                          className="w-full aspect-video bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-emerald-300 hover:bg-emerald-50 transition-all overflow-hidden relative group"
                        >
                          {programFormData.image ? (
                            <>
                              <img
                                src={programFormData.image}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Camera className="w-8 h-8 text-white" />
                              </div>
                            </>
                          ) : (
                            <>
                              <Camera className="w-8 h-8 text-zinc-300 mb-2" />
                              <span className="text-[10px] font-bold text-zinc-400 uppercase">
                                Добавить фото
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-zinc-400 uppercase">
                          PDF Документ
                        </label>
                        <div
                          onClick={() => programPdfInputRef.current?.click()}
                          className="w-full aspect-video bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-emerald-300 hover:bg-emerald-50 transition-all overflow-hidden relative group"
                        >
                          {programFormData.pdfUrl ? (
                            <div className="flex flex-col items-center gap-2 p-4 text-center">
                              <FileText className="w-8 h-8 text-emerald-600" />
                              <span className="text-[10px] font-bold text-emerald-600 truncate w-full">
                                {programFormData.pdfUrl}
                              </span>
                            </div>
                          ) : (
                            <>
                              <FileText className="w-8 h-8 text-zinc-300 mb-2" />
                              <span className="text-[10px] font-bold text-zinc-400 uppercase">
                                Добавить PDF
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-zinc-700 mb-1">
                        Название папки *
                      </label>
                      <input
                        required
                        type="text"
                        value={programFormData.name}
                        onChange={(e) =>
                          setProgramFormData({ ...programFormData, name: e.target.value })
                        }
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-sm"
                        placeholder="Например: Полезные завтраки"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-zinc-700 mb-1">Описание</label>
                      <textarea
                        value={programFormData.description}
                        onChange={(e) =>
                          setProgramFormData({ ...programFormData, description: e.target.value })
                        }
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium min-h-[80px] text-sm"
                        placeholder="О чем эта подборка?"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-zinc-700 mb-1 text-xs">
                          Имя создателя
                        </label>
                        <input
                          type="text"
                          value={programFormData.creator}
                          onChange={(e) =>
                            setProgramFormData({ ...programFormData, creator: e.target.value })
                          }
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-sm"
                          placeholder="Ваше имя"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-zinc-700 mb-1 text-xs">
                          Ссылка
                        </label>
                        <input
                          type="text"
                          value={programFormData.link}
                          onChange={(e) =>
                            setProgramFormData({ ...programFormData, link: e.target.value })
                          }
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-sm"
                          placeholder="https://..."
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-zinc-700 mb-1">
                          Разрешенные продукты
                        </label>
                        <input
                          type="text"
                          value={programFormData.allowedProducts?.join(', ') || ''}
                          onChange={(e) =>
                            setProgramFormData({
                              ...programFormData,
                              allowedProducts: e.target.value
                                .split(',')
                                .map((s) => s.trim())
                                .filter((s) => s !== ''),
                            })
                          }
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-sm"
                          placeholder="Курица, Рис..."
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-zinc-700 mb-1">
                          Запрещенные продукты
                        </label>
                        <input
                          type="text"
                          value={programFormData.forbiddenProducts?.join(', ') || ''}
                          onChange={(e) =>
                            setProgramFormData({
                              ...programFormData,
                              forbiddenProducts: e.target.value
                                .split(',')
                                .map((s) => s.trim())
                                .filter((s) => s !== ''),
                            })
                          }
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-sm"
                          placeholder="Сахар, Мука..."
                        />
                      </div>
                    </div>

                    {/* Subfolders Section */}
                    <div className="space-y-4 pt-4 border-t border-zinc-100">
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-bold text-zinc-700 uppercase tracking-wider">
                          Подпапки ({programFormData.subfolders.length})
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const newSubfolder: Subfolder = {
                              id: crypto.randomUUID(),
                              name: '',
                              description: '',
                              recipeIds: [],
                            };
                            setProgramFormData({
                              ...programFormData,
                              subfolders: [...programFormData.subfolders, newSubfolder],
                            });
                          }}
                          className="flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Создать подпапку</span>
                        </button>
                      </div>

                      <div className="space-y-6">
                        {programFormData.subfolders.map((subfolder) => (
                          <div
                            key={subfolder.id}
                            className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 space-y-4 relative group"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setProgramFormData({
                                  ...programFormData,
                                  subfolders: programFormData.subfolders.filter(
                                    (sf) => sf.id !== subfolder.id,
                                  ),
                                });
                              }}
                              className="absolute top-2 right-2 p-1.5 text-zinc-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>

                            <div className="grid grid-cols-[80px_1fr] gap-4">
                              <div
                                onClick={() => {
                                  setEditingSubfolderId(subfolder.id);
                                  subfolderPhotoInputRef.current?.click();
                                }}
                                className="aspect-square bg-white border-2 border-dashed border-zinc-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-emerald-300 hover:bg-emerald-50 transition-all overflow-hidden relative"
                              >
                                {subfolder.image ? (
                                  <img
                                    src={subfolder.image}
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <Camera className="w-6 h-6 text-zinc-300" />
                                )}
                              </div>
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  value={subfolder.name}
                                  onChange={(e) => {
                                    setProgramFormData({
                                      ...programFormData,
                                      subfolders: programFormData.subfolders.map((sf) =>
                                        sf.id === subfolder.id
                                          ? { ...sf, name: e.target.value }
                                          : sf,
                                      ),
                                    });
                                  }}
                                  className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-xs"
                                  placeholder="Название подпапки"
                                />
                                <textarea
                                  value={subfolder.description}
                                  onChange={(e) => {
                                    setProgramFormData({
                                      ...programFormData,
                                      subfolders: programFormData.subfolders.map((sf) =>
                                        sf.id === subfolder.id
                                          ? { ...sf, description: e.target.value }
                                          : sf,
                                      ),
                                    });
                                  }}
                                  className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-[10px] min-h-[50px]"
                                  placeholder="Описание подпапки"
                                />
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                      Разрешенные
                                    </label>
                                    <input
                                      type="text"
                                      value={subfolder.allowedProducts?.join(', ') || ''}
                                      onChange={(e) => {
                                        const val = e.target.value
                                          .split(',')
                                          .map((s) => s.trim())
                                          .filter((s) => s !== '');
                                        setProgramFormData({
                                          ...programFormData,
                                          subfolders: programFormData.subfolders.map((sf) =>
                                            sf.id === subfolder.id
                                              ? { ...sf, allowedProducts: val }
                                              : sf,
                                          ),
                                        });
                                      }}
                                      className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-[10px]"
                                      placeholder="Продукты..."
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                      Запрещенные
                                    </label>
                                    <input
                                      type="text"
                                      value={subfolder.forbiddenProducts?.join(', ') || ''}
                                      onChange={(e) => {
                                        const val = e.target.value
                                          .split(',')
                                          .map((s) => s.trim())
                                          .filter((s) => s !== '');
                                        setProgramFormData({
                                          ...programFormData,
                                          subfolders: programFormData.subfolders.map((sf) =>
                                            sf.id === subfolder.id
                                              ? { ...sf, forbiddenProducts: val }
                                              : sf,
                                          ),
                                        });
                                      }}
                                      className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-[10px]"
                                      placeholder="Продукты..."
                                    />
                                  </div>
                                </div>
                                <div className="grid grid-cols-4 gap-2">
                                  <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                      Ккал
                                    </label>
                                    <input
                                      type="number"
                                      value={subfolder.targetCalories || ''}
                                      onChange={(e) => {
                                        setProgramFormData({
                                          ...programFormData,
                                          subfolders: programFormData.subfolders.map((sf) =>
                                            sf.id === subfolder.id
                                              ? { ...sf, targetCalories: Number(e.target.value) }
                                              : sf,
                                          ),
                                        });
                                      }}
                                      className="w-full px-2 py-1.5 bg-white border border-zinc-200 rounded-lg text-[10px]"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                      Белки
                                    </label>
                                    <input
                                      type="number"
                                      value={subfolder.targetProteins || ''}
                                      onChange={(e) => {
                                        setProgramFormData({
                                          ...programFormData,
                                          subfolders: programFormData.subfolders.map((sf) =>
                                            sf.id === subfolder.id
                                              ? { ...sf, targetProteins: Number(e.target.value) }
                                              : sf,
                                          ),
                                        });
                                      }}
                                      className="w-full px-2 py-1.5 bg-white border border-zinc-200 rounded-lg text-[10px]"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                      Жиры
                                    </label>
                                    <input
                                      type="number"
                                      value={subfolder.targetFats || ''}
                                      onChange={(e) => {
                                        setProgramFormData({
                                          ...programFormData,
                                          subfolders: programFormData.subfolders.map((sf) =>
                                            sf.id === subfolder.id
                                              ? { ...sf, targetFats: Number(e.target.value) }
                                              : sf,
                                          ),
                                        });
                                      }}
                                      className="w-full px-2 py-1.5 bg-white border border-zinc-200 rounded-lg text-[10px]"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                      Угл
                                    </label>
                                    <input
                                      type="number"
                                      value={subfolder.targetCarbs || ''}
                                      onChange={(e) => {
                                        setProgramFormData({
                                          ...programFormData,
                                          subfolders: programFormData.subfolders.map((sf) =>
                                            sf.id === subfolder.id
                                              ? { ...sf, targetCarbs: Number(e.target.value) }
                                              : sf,
                                          ),
                                        });
                                      }}
                                      className="w-full px-2 py-1.5 bg-white border border-zinc-200 rounded-lg text-[10px]"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase">
                                  Рецепты ({subfolder.recipeIds.length})
                                </span>
                                <select
                                  value={subfolderRecipeFilters[subfolder.id] || 'Все'}
                                  onChange={(e) =>
                                    setSubfolderRecipeFilters({
                                      ...subfolderRecipeFilters,
                                      [subfolder.id]: e.target.value,
                                    })
                                  }
                                  className="text-[10px] font-bold text-emerald-600 bg-white border border-zinc-100 rounded-md px-1.5 py-0.5 outline-none"
                                >
                                  <option value="Все">Все</option>
                                  {availableCategories.map((cat) => (
                                    <option key={cat} value={cat}>
                                      {cat}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="max-h-32 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                                {recipes
                                  .filter(
                                    (r) =>
                                      (subfolderRecipeFilters[subfolder.id] || 'Все') === 'Все' ||
                                      r.categories.includes(
                                        subfolderRecipeFilters[subfolder.id] ?? '',
                                      ),
                                  )
                                  .map((recipe) => (
                                    <label
                                      key={recipe.id}
                                      className="flex items-center gap-2 p-2 bg-white rounded-lg cursor-pointer hover:bg-zinc-50 transition-colors"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={subfolder.recipeIds.includes(recipe.id)}
                                        onChange={(e) => {
                                          const newRecipeIds = e.target.checked
                                            ? [...subfolder.recipeIds, recipe.id]
                                            : subfolder.recipeIds.filter((id) => id !== recipe.id);
                                          setProgramFormData({
                                            ...programFormData,
                                            subfolders: programFormData.subfolders.map((sf) =>
                                              sf.id === subfolder.id
                                                ? { ...sf, recipeIds: newRecipeIds }
                                                : sf,
                                            ),
                                          });
                                        }}
                                        className="w-4 h-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                                      />
                                      <span className="text-xs font-medium text-zinc-600 truncate">
                                        {recipe.title}
                                      </span>
                                    </label>
                                  ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-sm font-bold text-zinc-700">
                          Выберите рецепты ({programFormData.recipeIds.length})
                        </label>
                        <select
                          value={programRecipeFilter}
                          onChange={(e) => setProgramRecipeFilter(e.target.value)}
                          className="text-xs font-bold text-emerald-600 bg-emerald-50 border-none rounded-lg px-2 py-1 outline-none"
                        >
                          <option value="Все">Все категории</option>
                          {availableCategories.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {recipes
                          .filter(
                            (r) =>
                              programRecipeFilter === 'Все' ||
                              r.categories.includes(programRecipeFilter),
                          )
                          .map((recipe) => (
                            <label
                              key={recipe.id}
                              className="flex items-center gap-3 p-3 bg-zinc-50 rounded-xl cursor-pointer hover:bg-zinc-100 transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={programFormData.recipeIds.includes(recipe.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setProgramFormData({
                                      ...programFormData,
                                      recipeIds: [...programFormData.recipeIds, recipe.id],
                                    });
                                  } else {
                                    setProgramFormData({
                                      ...programFormData,
                                      recipeIds: programFormData.recipeIds.filter(
                                        (id) => id !== recipe.id,
                                      ),
                                    });
                                  }
                                }}
                                className="w-5 h-5 rounded-lg border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="text-sm font-bold text-zinc-700 truncate">
                                {recipe.title}
                              </span>
                            </label>
                          ))}
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                  >
                    {editingProgramId ? 'Сохранить изменения' : 'Создать программу'}
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Hidden file inputs */}
      <input
        type="file"
        ref={programPhotoInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleProgramPhotoUpload}
      />
      <input
        type="file"
        ref={programPdfInputRef}
        className="hidden"
        accept="application/pdf"
        onChange={handleProgramPdfUpload}
      />
      <input
        type="file"
        ref={subfolderPhotoInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleSubfolderPhotoUpload}
      />

      {/* Program delete confirmation */}
      <AnimatePresence>
        {programToDelete && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setProgramToDelete(null)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden p-6 text-center"
            >
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold mb-2">Удалить программу?</h3>
              <p className="text-zinc-500 text-sm mb-6">
                Действительно хочешь удалить программу{' '}
                <span className="font-bold text-zinc-900">"{programToDelete.name}"</span>?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setProgramToDelete(null)}
                  className="flex-1 py-3 font-bold text-zinc-500 hover:bg-zinc-100 rounded-xl transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={async () => {
                    try {
                      await programsRepo.delete(programToDelete.id);
                      setProgramToDelete(null);
                      onOpenProgramIdChange(null);
                    } catch (err) {
                      console.error('Error deleting program:', err);
                    }
                  }}
                  className="flex-1 py-3 font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-lg"
                >
                  Удалить
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ProgramDetailModal */}
      <AnimatePresence>
        {openProgram && (
          <ProgramDetailModal
            program={openProgram}
            recipes={recipes}
            availableCategories={availableCategories}
            programRecipeFilter={programRecipeFilter}
            onProgramRecipeFilterChange={setProgramRecipeFilter}
            onClose={() => onOpenProgramIdChange(null)}
            onDeleteProgram={setProgramToDelete}
            onStartRecipeSelection={onStartRecipeSelection}
            onRecipeTargetSet={onRecipeTargetSet}
            recipeTarget={recipeTarget}
            onRecipeTargetCleared={onRecipeTargetCleared}
            photoInputRef={photoInputRef}
            isAddingManual={isAddingManual}
            onIsAddingManualChange={onIsAddingManualChange}
            isAddingLink={isAddingLink}
            onIsAddingLinkChange={onIsAddingLinkChange}
            isAddingPDF={isAddingPDF}
            onIsAddingPDFChange={onIsAddingPDFChange}
            isScanning={isScanning}
            onIsScanningChange={onIsScanningChange}
            onSelectRecipe={onSelectRecipe}
            userProfile={userProfile}
          />
        )}
      </AnimatePresence>
    </>
  );
}
