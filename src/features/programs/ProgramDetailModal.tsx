import React, { useState } from 'react';
import {
  ChevronLeft, Plus, Edit2, Edit3, Trash2, FolderPlus,
  BookOpen, Camera, FileText, Link as LinkIcon, Activity,
  ChevronDown, Upload, ShoppingCart, Calendar, AlertTriangle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '@/infrastructure/firebaseApp';
import type { Program, Recipe, Resource, Subfolder, UserProfile } from '@/shared/domain/types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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

export type ProgramDetailModalProps = {
  program: Program;
  recipes: Recipe[];
  userProfile: UserProfile;
  availableCategories: string[];
  programRecipeFilter: string;
  onProgramRecipeFilterChange: (f: string) => void;
  onClose: () => void;
  onDeleteProgram: (program: Program) => void;
  onStartRecipeSelection: (programId: string, subfolderId: string | 'main') => void;
  onRecipeTargetSet: (target: { programId: string; subfolderId: string | 'main' }) => void;
  recipeTarget: { programId: string; subfolderId: string | 'main' } | null;
  onRecipeTargetCleared: () => void;
  photoInputRef: React.RefObject<HTMLInputElement>;
  isAddingManual: boolean; onIsAddingManualChange: (v: boolean) => void;
  isAddingLink: boolean;   onIsAddingLinkChange: (v: boolean) => void;
  isAddingPDF: boolean;    onIsAddingPDFChange: (v: boolean) => void;
  isScanning: boolean;     onIsScanningChange: (v: boolean) => void;
  onAddProductsToCart: (products: string[]) => void;
  onSelectRecipe: (recipe: Recipe) => void;
};

export function ProgramDetailModal(props: ProgramDetailModalProps) {
  const {
    program, recipes, userProfile, availableCategories, programRecipeFilter,
    onProgramRecipeFilterChange, onClose, onDeleteProgram,
    onStartRecipeSelection, onRecipeTargetSet, photoInputRef,
    isAddingManual, onIsAddingManualChange,
    isAddingLink, onIsAddingLinkChange,
    isAddingPDF, onIsAddingPDFChange,
    onAddProductsToCart, onSelectRecipe,
  } = props;

  const [openSubfolderId, setOpenSubfolderId] = useState<string | null>(null);
  const [editingSubfolderId, setEditingSubfolderId] = useState<string | null>(null);
  const [editingEntity, setEditingEntity] = useState<{
    type: 'program' | 'subfolder';
    id: string;
    programId?: string;
  } | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '', description: '',
    targetCalories: 0, targetProteins: 0, targetFats: 0, targetCarbs: 0,
    resources: [] as Resource[],
    allowedProducts: [] as string[],
    forbiddenProducts: [] as string[],
  });
  const [programAddRecipeDropdown, setProgramAddRecipeDropdown] = useState<{
    programId: string;
    subfolderId: string | 'main';
  } | null>(null);
  const [subfolderToDelete, setSubfolderToDelete] = useState<{
    programId: string;
    subfolderId: string;
    name: string;
  } | null>(null);
  const [showProducts, setShowProducts] = useState(false);
  const [activeResourceForm, setActiveResourceForm] = useState<{
    targetId: string;
    type: 'link' | 'pdf';
  } | null>(null);
  const [resourceFormData, setResourceFormData] = useState({
    url: '', title: '', description: '',
  });
  const [isMainRecipesOpen, setIsMainRecipesOpen] = useState(true);
  const subfolderPdfInputRef = React.useRef<HTMLInputElement>(null);

  const handleDropRecipe = async (
    recipeId: string,
    targetSubfolderId: string,
    sourceSubfolderId: string,
  ) => {
    if (targetSubfolderId === sourceSubfolderId) return;
    let newRecipeIds = [...program.recipeIds];
    let newSubfolders = program.subfolders ? [...program.subfolders] : [];

    if (sourceSubfolderId === 'main') {
      newRecipeIds = newRecipeIds.filter(id => id !== recipeId);
    } else {
      newSubfolders = newSubfolders.map(sf =>
        sf.id === sourceSubfolderId
          ? { ...sf, recipeIds: sf.recipeIds.filter(id => id !== recipeId) }
          : sf
      );
    }
    if (targetSubfolderId === 'main') {
      if (!newRecipeIds.includes(recipeId)) newRecipeIds.push(recipeId);
    } else {
      newSubfolders = newSubfolders.map(sf =>
        sf.id === targetSubfolderId
          ? { ...sf, recipeIds: [...sf.recipeIds, recipeId] }
          : sf
      );
    }
    try {
      await updateDoc(doc(db, 'programs', program.id), {
        recipeIds: newRecipeIds,
        subfolders: newSubfolders,
      });
    } catch (error) {
      console.error('Error moving recipe:', error);
    }
  };

  const handleSubfolderPdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const newResource: Resource = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'pdf',
      url: file.name,
      title: file.name,
      description: '',
    };
    if (editingEntity) {
      setEditFormData(prev => ({ ...prev, resources: [...prev.resources, newResource] }));
      alert(`Файл ${file.name} добавлен`);
      return;
    }
    if (activeResourceForm) {
      if (activeResourceForm.targetId === 'main') {
        updateDoc(doc(db, 'programs', program.id), {
          resources: [...(program.resources || []), newResource],
        });
      } else {
        const newSubfolders = program.subfolders?.map(sf =>
          sf.id === activeResourceForm.targetId
            ? { ...sf, resources: [...(sf.resources || []), newResource] }
            : sf
        );
        updateDoc(doc(db, 'programs', program.id), { subfolders: newSubfolders });
      }
      setActiveResourceForm(null);
      alert(`Файл ${file.name} загружен`);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingEntity) return;
    try {
      if (editingEntity.type === 'program') {
        await updateDoc(doc(db, 'programs', editingEntity.id), {
          name: editFormData.name,
          description: editFormData.description,
          targetCalories: editFormData.targetCalories,
          targetProteins: editFormData.targetProteins,
          targetFats: editFormData.targetFats,
          targetCarbs: editFormData.targetCarbs,
          resources: editFormData.resources,
          allowedProducts: editFormData.allowedProducts,
          forbiddenProducts: editFormData.forbiddenProducts,
        });
      } else {
        const newSubfolders = program.subfolders?.map(sf =>
          sf.id === editingEntity.id
            ? {
                ...sf,
                name: editFormData.name,
                description: editFormData.description,
                targetCalories: editFormData.targetCalories,
                targetProteins: editFormData.targetProteins,
                targetFats: editFormData.targetFats,
                targetCarbs: editFormData.targetCarbs,
                resources: editFormData.resources,
                allowedProducts: editFormData.allowedProducts,
                forbiddenProducts: editFormData.forbiddenProducts,
              }
            : sf
        );
        await updateDoc(doc(db, 'programs', editingEntity.programId!), {
          subfolders: newSubfolders,
        });
      }
      setEditingEntity(null);
    } catch (error) {
      console.error('Error saving edit:', error);
      alert('Ошибка при сохранении');
    }
  };

  return (
    <>
      {/* Program Details Modal */}
      <AnimatePresence>
        {true && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => onClose()}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => onClose()}
                    className="p-2 hover:bg-zinc-100 rounded-xl transition-colors"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-zinc-900">
                      Программа: {program.name}
                    </h2>
                    <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">
                      {program.description}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                          <button
                            onClick={async () => {
                              const newSubfolder: Subfolder = {
                                id: Math.random().toString(36).substr(2, 9),
                                name: "Новая подпапка",
                                description: "",
                                recipeIds: []
                              };
                              await updateDoc(doc(db, "programs", program.id), {
                                subfolders: [...(program.subfolders || []), newSubfolder]
                              });
                              setOpenSubfolderId(newSubfolder.id);
                              setEditingSubfolderId(newSubfolder.id);
                            }}
                            className="text-[10px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                          >
                            <FolderPlus className="w-3.5 h-3.5" />
                            Создать подпапку
                          </button>
                          <div className="relative">
                            <button
                              onClick={() => setProgramAddRecipeDropdown(programAddRecipeDropdown?.subfolderId === 'main' ? null : { programId: program.id, subfolderId: 'main' })}
                              className="text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Добавить рецепт
                            </button>

                            <AnimatePresence>
                              {programAddRecipeDropdown?.programId === program.id && programAddRecipeDropdown?.subfolderId === 'main' && (
                                <>
                                  <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setProgramAddRecipeDropdown(null)}
                                  />
                                  <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className="absolute left-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-zinc-100 overflow-hidden z-50"
                                  >
                                    <AddRecipeOption
                                      icon={<BookOpen className="w-4 h-4 text-emerald-500" />}
                                      label="Выбрать из библиотеки"
                                      onClick={() => { onStartRecipeSelection(program.id, 'main'); setProgramAddRecipeDropdown(null); }}
                                    />
                                    <AddRecipeOption
                                      icon={<Camera className="w-4 h-4 text-emerald-500" />}
                                      label="Загрузить фото"
                                      onClick={() => { onRecipeTargetSet({ programId: program.id, subfolderId: 'main' }); photoInputRef.current?.click(); setProgramAddRecipeDropdown(null); }}
                                    />
                                    <AddRecipeOption
                                      icon={<FileText className="w-4 h-4 text-emerald-500" />}
                                      label="PDF документ"
                                      onClick={() => { onRecipeTargetSet({ programId: program.id, subfolderId: 'main' }); onIsAddingPDFChange(true); setProgramAddRecipeDropdown(null); }}
                                    />
                                    <AddRecipeOption
                                      icon={<LinkIcon className="w-4 h-4 text-emerald-500" />}
                                      label="Вставить ссылку"
                                      onClick={() => { onRecipeTargetSet({ programId: program.id, subfolderId: 'main' }); onIsAddingLinkChange(true); setProgramAddRecipeDropdown(null); }}
                                    />
                                    <AddRecipeOption
                                      icon={<Edit3 className="w-4 h-4 text-emerald-500" />}
                                      label="Добавить вручную"
                                      onClick={() => { onRecipeTargetSet({ programId: program.id, subfolderId: 'main' }); onIsAddingManualChange(true); setProgramAddRecipeDropdown(null); }}
                                    />
                                  </motion.div>
                                </>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>

                        {/* Compact Resources Display */}
                        {program.resources && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {program.resources?.map(res => (
                              <div key={res.id} className="flex items-center gap-2 bg-zinc-50 border border-zinc-100 px-2 py-1 rounded-md group relative">
                                {res.type === 'pdf' ? <FileText className="w-3 h-3 text-red-500" /> : <LinkIcon className="w-3 h-3 text-blue-500" />}
                                <a href={res.url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-medium text-zinc-600 hover:text-emerald-600 truncate max-w-[120px]">
                                  {res.title}
                                </a>
                                {res.description && (
                                  <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-20 w-48 p-2 bg-zinc-900 text-white text-[10px] rounded-lg shadow-xl">
                                    {res.description}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Allowed/Forbidden Products Section */}
                        {(() => {
                          const hasRestrictions = (program.allowedProducts?.length ?? 0) > 0 || (program.forbiddenProducts?.length ?? 0) > 0;
                          if (!hasRestrictions) return null;

                          return (
                            <div className="mt-4 border-t border-zinc-100 pt-4">
                              <div className="flex items-center justify-between mb-3">
                                <button
                                  onClick={() => setShowProducts(!showProducts)}
                                  className="flex items-center gap-2 text-sm font-bold text-zinc-700 hover:text-emerald-600 transition-colors"
                                >
                                  <Activity className="w-4 h-4" />
                                  <span>Ограничения по продуктам</span>
                                  <ChevronDown className={cn("w-4 h-4 transition-transform", showProducts && "rotate-180")} />
                                </button>

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => onAddProductsToCart([...(program.allowedProducts || []), ...(program.forbiddenProducts || [])])}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-bold hover:bg-emerald-100 transition-colors"
                                  >
                                    <ShoppingCart className="w-3.5 h-3.5" />
                                    Добавить в корзину
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingEntity({ type: 'program', id: program.id });
                                      setEditFormData({
                                        name: program.name,
                                        description: program.description || '',
                                        targetCalories: program.targetCalories || 0,
                                        targetProteins: program.targetProteins || 0,
                                        targetFats: program.targetFats || 0,
                                        targetCarbs: program.targetCarbs || 0,
                                        resources: program.resources || [],
                                        allowedProducts: program.allowedProducts || [],
                                        forbiddenProducts: program.forbiddenProducts || []
                                      });
                                    }}
                                    className="p-1.5 text-zinc-400 hover:text-emerald-600 hover:bg-zinc-50 rounded-lg transition-colors"
                                    title="Редактировать ограничения"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              <AnimatePresence>
                                {showProducts && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="flex flex-col gap-3 mt-1">
                                      {program.allowedProducts && program.allowedProducts.length > 0 && (
                                        <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-100">
                                          <p className="text-[10px] font-bold text-emerald-600 uppercase mb-2">Разрешенные</p>
                                          <div className="flex flex-wrap gap-1.5">
                                            {program.allowedProducts.map((p, i) => (
                                              <span key={i} className="text-[10px] bg-white text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-100">
                                                {p}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      {program.forbiddenProducts && program.forbiddenProducts.length > 0 && (
                                        <div className="bg-red-50/50 rounded-xl p-3 border border-red-100">
                                          <p className="text-[10px] font-bold text-red-600 uppercase mb-2">Запрещенные</p>
                                          <div className="flex flex-wrap gap-1.5">
                                            {program.forbiddenProducts.map((p, i) => (
                                              <span key={i} className="text-[10px] bg-white text-red-700 px-2 py-0.5 rounded-md border border-red-100">
                                                {p}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })()}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => {
                      setEditingEntity({ type: 'program', id: program.id });
                      setEditFormData({
                        name: program.name,
                        description: program.description || '',
                        targetCalories: program.targetCalories || 0,
                        targetProteins: program.targetProteins || 0,
                        targetFats: program.targetFats || 0,
                        targetCarbs: program.targetCarbs || 0,
                        resources: program.resources || [],
                        allowedProducts: program.allowedProducts || [],
                        forbiddenProducts: program.forbiddenProducts || []
                      });
                    }}
                    className="p-2 rounded-xl transition-colors hover:bg-zinc-100 text-zinc-400"
                    title="Редактировать программу"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      onDeleteProgram(program);
                    }}
                    className="p-2 rounded-xl transition-colors hover:bg-red-50 text-zinc-400 hover:text-red-600"
                    title="Удалить программу"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <button onClick={() => onClose()} className="text-zinc-400 hover:text-zinc-600">
                    <Plus className="w-6 h-6 rotate-45" />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                {(() => {
                  const collectionRecipes = recipes.filter(r =>
                    program.recipeIds.includes(r.id) &&
                    (programRecipeFilter === 'Все' || r.categories.includes(programRecipeFilter))
                  );

                  return (
                    <div className="space-y-12">
                      {/* Subfolders */}
                      {program.subfolders && program.subfolders.length > 0 && (
                        <div className="space-y-4">
                          {program.subfolders.map(subfolder => {
                            const subfolderRecipes = recipes.filter(r =>
                              subfolder.recipeIds.includes(r.id) &&
                              (programRecipeFilter === 'Все' || r.categories.includes(programRecipeFilter))
                            );
                            if (subfolderRecipes.length === 0 && programRecipeFilter !== 'Все') return null;

                            const isOpen = openSubfolderId === subfolder.id;

                            return (
                              <div
                                key={subfolder.id}
                                className={cn(
                                  "bg-emerald-50 rounded-3xl border transition-all overflow-hidden relative",
                                  isOpen ? "border-emerald-200 shadow-sm" : "border-emerald-100"
                                )}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  e.currentTarget.classList.add('bg-emerald-100');
                                }}
                                onDragLeave={(e) => {
                                  e.currentTarget.classList.remove('bg-emerald-100');
                                }}
                                onDrop={(e: any) => {
                                  e.preventDefault();
                                  e.currentTarget.classList.remove('bg-emerald-100');
                                  const recipeId = e.dataTransfer.getData('recipeId');
                                  const sourceSubfolderId = e.dataTransfer.getData('sourceSubfolderId');
                                  handleDropRecipe(recipeId, subfolder.id, sourceSubfolderId);
                                }}
                              >
                                    <button
                                      onClick={() => setOpenSubfolderId(isOpen ? null : subfolder.id)}
                                      className="w-full flex items-center gap-4 p-4 hover:bg-emerald-100/50 transition-colors"
                                    >
                                      {subfolder.image ? (
                                        <div className="w-12 h-12 rounded-xl overflow-hidden shadow-sm border border-emerald-200">
                                          <img src={subfolder.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                        </div>
                                      ) : (
                                        <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 border border-emerald-200">
                                          <FolderPlus className="w-6 h-6" />
                                        </div>
                                      )}
                                      <div className="flex-1 text-left pr-24">
                                        <h3 className="font-bold text-emerald-900">{subfolder.name}</h3>
                                        {subfolder.description && <p className="text-xs text-emerald-600 line-clamp-1">{subfolder.description}</p>}

                                        <div className="flex flex-wrap gap-2 mt-2">
                                          <div className="relative">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setProgramAddRecipeDropdown(programAddRecipeDropdown?.subfolderId === subfolder.id ? null : { programId: program.id, subfolderId: subfolder.id });
                                              }}
                                              className="text-[9px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-2 py-1 rounded-md flex items-center gap-1 transition-colors shadow-sm"
                                            >
                                              <Plus className="w-3 h-3" />
                                              + Рецепт
                                            </button>

                                            <AnimatePresence>
                                              {programAddRecipeDropdown?.programId === program.id && programAddRecipeDropdown?.subfolderId === subfolder.id && (
                                                <>
                                                  <div
                                                    className="fixed inset-0 z-40"
                                                    onClick={(e) => { e.stopPropagation(); setProgramAddRecipeDropdown(null); }}
                                                  />
                                                  <motion.div
                                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="absolute left-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-zinc-100 overflow-hidden z-50"
                                                  >
                                                    <AddRecipeOption
                                                      icon={<BookOpen className="w-4 h-4 text-emerald-500" />}
                                                      label="Выбрать из библиотеки"
                                                      onClick={() => { onStartRecipeSelection(program.id, subfolder.id); setProgramAddRecipeDropdown(null); }}
                                                    />
                                                    <AddRecipeOption
                                                      icon={<Camera className="w-4 h-4 text-emerald-500" />}
                                                      label="Загрузить фото"
                                                      onClick={() => { onRecipeTargetSet({ programId: program.id, subfolderId: subfolder.id }); photoInputRef.current?.click(); setProgramAddRecipeDropdown(null); }}
                                                    />
                                                    <AddRecipeOption
                                                      icon={<FileText className="w-4 h-4 text-emerald-500" />}
                                                      label="PDF документ"
                                                      onClick={() => { onRecipeTargetSet({ programId: program.id, subfolderId: subfolder.id }); onIsAddingPDFChange(true); setProgramAddRecipeDropdown(null); }}
                                                    />
                                                    <AddRecipeOption
                                                      icon={<LinkIcon className="w-4 h-4 text-emerald-500" />}
                                                      label="Вставить ссылку"
                                                      onClick={() => { onRecipeTargetSet({ programId: program.id, subfolderId: subfolder.id }); onIsAddingLinkChange(true); setProgramAddRecipeDropdown(null); }}
                                                    />
                                                    <AddRecipeOption
                                                      icon={<Edit3 className="w-4 h-4 text-emerald-500" />}
                                                      label="Добавить вручную"
                                                      onClick={() => { onRecipeTargetSet({ programId: program.id, subfolderId: subfolder.id }); onIsAddingManualChange(true); setProgramAddRecipeDropdown(null); }}
                                                    />
                                                  </motion.div>
                                                </>
                                              )}
                                            </AnimatePresence>
                                          </div>
                                        </div>

                                            {/* Compact Resources Display for Subfolder */}
                                            {subfolder.resources && subfolder.resources.length > 0 && (
                                              <div className="flex flex-wrap gap-1.5 mt-2">
                                                {subfolder.resources.map(res => (
                                                  <div key={res.id} className="flex items-center gap-1.5 bg-white/40 border border-emerald-100 px-1.5 py-0.5 rounded-md group relative" onClick={e => e.stopPropagation()}>
                                                    {res.type === 'pdf' ? <FileText className="w-2.5 h-2.5 text-red-500" /> : <LinkIcon className="w-2.5 h-2.5 text-blue-500" />}
                                                    <a href={res.url} target="_blank" rel="noopener noreferrer" className="text-[9px] font-medium text-emerald-800 hover:underline truncate max-w-[80px]">
                                                      {res.title}
                                                    </a>
                                                    {res.description && (
                                                      <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-20 w-40 p-1.5 bg-zinc-800 text-white text-[9px] rounded shadow-lg">
                                                        {res.description}
                                                      </div>
                                                    )}
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                          <Plus className={cn("w-5 h-5 text-emerald-600 transition-transform", isOpen && "rotate-45")} />
                                    </button>

                                    {/* Allowed/Forbidden Products for Subfolder */}
                                    {isOpen && (subfolder.allowedProducts?.length || subfolder.forbiddenProducts?.length) ? (
                                      <div className="px-4 pb-4">
                                        <div className="flex items-center justify-between mb-2">
                                          <p className="text-[10px] font-bold text-zinc-500 uppercase">Ограничения подпапки</p>
                                          <div className="flex items-center gap-2">
                                            <button
                                              onClick={(e) => { e.stopPropagation(); onAddProductsToCart([...(subfolder.allowedProducts || []), ...(subfolder.forbiddenProducts || [])]); }}
                                              className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-600 rounded-md text-[8px] font-bold hover:bg-emerald-100 transition-colors"
                                            >
                                              <ShoppingCart className="w-3 h-3" />
                                              В корзину
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingEntity({ type: 'subfolder', id: subfolder.id, programId: program.id });
                                                setEditFormData({
                                                  name: subfolder.name,
                                                  description: subfolder.description || '',
                                                  targetCalories: subfolder.targetCalories || 0,
                                                  targetProteins: subfolder.targetProteins || 0,
                                                  targetFats: subfolder.targetFats || 0,
                                                  targetCarbs: subfolder.targetCarbs || 0,
                                                  resources: subfolder.resources || [],
                                                  allowedProducts: subfolder.allowedProducts || [],
                                                  forbiddenProducts: subfolder.forbiddenProducts || []
                                                });
                                              }}
                                              className="p-1 text-zinc-400 hover:text-emerald-600 rounded transition-colors"
                                            >
                                              <Edit2 className="w-3 h-3" />
                                            </button>
                                          </div>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                          {subfolder.allowedProducts && subfolder.allowedProducts.length > 0 && (
                                            <div className="bg-emerald-50/30 rounded-lg p-2 border border-emerald-100/50">
                                              <p className="text-[8px] font-bold text-emerald-600 uppercase mb-1">Разрешенные</p>
                                              <div className="flex flex-wrap gap-1">
                                                {subfolder.allowedProducts.map((p, i) => (
                                                  <span key={i} className="text-[8px] bg-white text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-100">
                                                    {p}
                                                  </span>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                          {subfolder.forbiddenProducts && subfolder.forbiddenProducts.length > 0 && (
                                            <div className="bg-red-50/30 rounded-lg p-2 border border-red-100/50">
                                              <p className="text-[8px] font-bold text-red-600 uppercase mb-1">Запрещенные</p>
                                              <div className="flex flex-wrap gap-1">
                                                {subfolder.forbiddenProducts.map((p, i) => (
                                                  <span key={i} className="text-[8px] bg-white text-red-700 px-1.5 py-0.5 rounded border border-red-100">
                                                    {p}
                                                  </span>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ) : null}

                                    {/* Subfolder Actions - Positioned AFTER the toggle button and with high z-index */}
                                    <div className="absolute top-4 right-12 z-50 flex items-center gap-2">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingEntity({ type: 'subfolder', id: subfolder.id, programId: program.id });
                                          setEditFormData({
                                            name: subfolder.name,
                                            description: subfolder.description || '',
                                            targetCalories: subfolder.targetCalories || 0,
                                            targetProteins: subfolder.targetProteins || 0,
                                            targetFats: subfolder.targetFats || 0,
                                            targetCarbs: subfolder.targetCarbs || 0,
                                            resources: subfolder.resources || [],
                                            allowedProducts: subfolder.allowedProducts || [],
                                            forbiddenProducts: subfolder.forbiddenProducts || []
                                          });
                                        }}
                                        className="p-2 rounded-lg transition-colors hover:bg-emerald-200 text-emerald-600"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSubfolderToDelete({ programId: program.id, subfolderId: subfolder.id, name: subfolder.name });
                                        }}
                                        className="p-2 rounded-lg transition-colors hover:bg-red-100 text-red-600"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>

                                <AnimatePresence>
                                  {isOpen && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className="border-t border-emerald-100"
                                    >
                                      <div className="p-4 space-y-6">
                                        {subfolderRecipes.length > 0 ? (
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {subfolderRecipes.map((recipe) => (
                                              <motion.div
                                                layout
                                                key={recipe.id}
                                                onClick={() => onSelectRecipe(recipe)}
                                                className="bg-white rounded-2xl border border-zinc-200 overflow-hidden hover:shadow-md transition-all group cursor-pointer flex items-center gap-3 p-2 relative"
                                                draggable
                                                onDragStart={(e: any) => {
                                                  e.dataTransfer.setData('recipeId', recipe.id);
                                                  e.dataTransfer.setData('sourceSubfolderId', subfolder.id);
                                                }}
                                              >
                                                {userProfile.allergies.some(allergy =>
                                                  recipe.ingredients.some(ing => ing.toLowerCase().includes(allergy.toLowerCase()))
                                                ) && (
                                                  <div className="absolute -top-1 -right-1 z-10 bg-red-500 text-white p-1 rounded-full shadow-sm" title="Содержит аллергены!">
                                                    <AlertTriangle className="w-2.5 h-2.5" />
                                                  </div>
                                                )}
                                                <div className="w-16 h-16 bg-zinc-100 rounded-xl overflow-hidden flex-shrink-0">
                                                  <img
                                                    src={recipe.image || `https://picsum.photos/seed/${recipe.id}/200/200`}
                                                    alt={recipe.title}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                    referrerPolicy="no-referrer"
                                                  />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                  <h3 className="font-bold text-sm text-zinc-900 truncate group-hover:text-emerald-600 transition-colors">{recipe.title}</h3>
                                                  <div className="flex items-center gap-1 text-[10px] text-zinc-500 mt-1">
                                                    <Calendar className="w-3 h-3 text-emerald-500" />
                                                    <span>{recipe.time}</span>
                                                  </div>
                                                </div>
                                              </motion.div>
                                            ))}
                                          </div>
                                        ) : (
                                          <div className="py-8 text-center bg-white/50 rounded-2xl border border-dashed border-emerald-200">
                                            <p className="text-emerald-400 text-xs italic">В этой подпапке пока нет рецептов</p>
                                          </div>
                                        )}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Main Recipes */}
                      <div className="space-y-4">
                        <div
                          className={cn(
                            "bg-zinc-50 rounded-3xl border transition-all overflow-hidden",
                            isMainRecipesOpen ? "border-zinc-200 shadow-sm" : "border-zinc-100"
                          )}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.currentTarget.classList.add('bg-zinc-100');
                          }}
                          onDragLeave={(e) => {
                            e.currentTarget.classList.remove('bg-zinc-100');
                          }}
                          onDrop={(e: any) => {
                            e.preventDefault();
                            e.currentTarget.classList.remove('bg-zinc-100');
                            const recipeId = e.dataTransfer.getData('recipeId');
                            const sourceSubfolderId = e.dataTransfer.getData('sourceSubfolderId');
                            handleDropRecipe(recipeId, 'main', sourceSubfolderId);
                          }}
                        >
                          <button
                            onClick={() => setIsMainRecipesOpen(!isMainRecipesOpen)}
                            className="w-full flex items-center justify-between p-5 hover:bg-zinc-100/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-400">
                                <BookOpen className="w-5 h-5" />
                              </div>
                              <h3 className="font-bold text-zinc-900">Загруженные рецепты</h3>
                            </div>
                            <Plus className={cn("w-5 h-5 text-zinc-400 transition-transform", isMainRecipesOpen && "rotate-45")} />
                          </button>

                          <AnimatePresence>
                            {isMainRecipesOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="border-t border-zinc-100"
                              >
                                <div className="p-6">
                                  {collectionRecipes.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                                      {collectionRecipes.map((recipe) => (
                                        <motion.div
                                          layout
                                          key={recipe.id}
                                          onClick={() => onSelectRecipe(recipe)}
                                          className="bg-white rounded-2xl border border-zinc-200 overflow-hidden hover:shadow-xl transition-all group cursor-pointer flex flex-col h-full relative"
                                          draggable
                                          onDragStart={(e: any) => {
                                            e.dataTransfer.setData('recipeId', recipe.id);
                                            e.dataTransfer.setData('sourceSubfolderId', 'main');
                                          }}
                                        >
                                          {userProfile.allergies.some(allergy =>
                                            recipe.ingredients.some(ing => ing.toLowerCase().includes(allergy.toLowerCase()))
                                          ) && (
                                            <div className="absolute top-3 right-3 z-10 bg-red-500 text-white p-1.5 rounded-lg shadow-lg" title="Содержит аллергены!">
                                              <AlertTriangle className="w-4 h-4" />
                                            </div>
                                          )}
                                          <div className="aspect-[4/3] bg-zinc-100 relative overflow-hidden">
                                            <img
                                              src={recipe.image || `https://picsum.photos/seed/${recipe.id}/600/450`}
                                              alt={recipe.title}
                                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                              referrerPolicy="no-referrer"
                                            />
                                          </div>
                                          <div className="p-5 flex-1 flex flex-col">
                                            <h3 className="font-bold text-lg mb-2 group-hover:text-emerald-600 transition-colors line-clamp-2 leading-snug">{recipe.title}</h3>
                                            <div className="mt-auto pt-4 border-t border-zinc-100 flex items-center justify-between text-zinc-500 text-sm">
                                              <div className="flex items-center gap-1.5">
                                                <Calendar className="w-4 h-4 text-emerald-500" />
                                                <span className="font-medium">{recipe.time}</span>
                                              </div>
                                            </div>
                                          </div>
                                        </motion.div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="py-12 text-center bg-zinc-50/50 rounded-3xl border border-dashed border-zinc-200">
                                      <p className="text-zinc-400 text-sm italic">В этой папке пока нет рецептов</p>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      {collectionRecipes.length === 0 && (!program.subfolders || program.subfolders.length === 0 || (programRecipeFilter !== 'Все' && !program.subfolders.some(sf => recipes.filter(r => sf.recipeIds.includes(r.id) && r.categories.includes(programRecipeFilter)).length > 0))) && (
                        <div className="py-12 text-center">
                          <p className="text-zinc-500">
                            {programRecipeFilter === 'Все'
                              ? "В этом сборнике пока нет рецептов."
                              : `Нет рецептов в категории "${programRecipeFilter}"`}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Entity Editing Modal */}
      <AnimatePresence>
        {editingEntity && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingEntity(null)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <h3 className="text-lg font-bold">
                  {editingEntity.type === 'program' ? 'Редактировать программу' : 'Редактировать подпапку'}
                </h3>
                <button onClick={() => setEditingEntity(null)} className="text-zinc-400 hover:text-zinc-600">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Название</label>
                    <input
                      type="text"
                      value={editFormData.name}
                      onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Название"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Описание</label>
                    <textarea
                      value={editFormData.description}
                      onChange={e => setEditFormData({ ...editFormData, description: e.target.value })}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 min-h-[100px]"
                      placeholder="Описание"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 pt-4 border-t border-zinc-100">
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Разрешенные продукты (через запятую)</label>
                      <input
                        type="text"
                        value={editFormData.allowedProducts.join(', ')}
                        onChange={e => setEditFormData({ ...editFormData, allowedProducts: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="Курица, овощи..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Запрещенные продукты (через запятую)</label>
                      <input
                        type="text"
                        value={editFormData.forbiddenProducts.join(', ')}
                        onChange={e => setEditFormData({ ...editFormData, forbiddenProducts: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="Сахар, мучное..."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-100">
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Калории (ккал)</label>
                      <input
                        type="number"
                        value={editFormData.targetCalories}
                        onChange={e => setEditFormData({ ...editFormData, targetCalories: parseInt(e.target.value) || 0 })}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Белки (г)</label>
                      <input
                        type="number"
                        value={editFormData.targetProteins}
                        onChange={e => setEditFormData({ ...editFormData, targetProteins: parseInt(e.target.value) || 0 })}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Жиры (г)</label>
                      <input
                        type="number"
                        value={editFormData.targetFats}
                        onChange={e => setEditFormData({ ...editFormData, targetFats: parseInt(e.target.value) || 0 })}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Углеводы (г)</label>
                      <input
                        type="number"
                        value={editFormData.targetCarbs}
                        onChange={e => setEditFormData({ ...editFormData, targetCarbs: parseInt(e.target.value) || 0 })}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-zinc-100 space-y-4">
                    <h4 className="text-sm font-bold text-zinc-900">Ресурсы</h4>

                    <div className="space-y-3 bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Название ресурса"
                          className="flex-1 bg-white border border-zinc-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                          id="new-resource-title"
                        />
                        <button
                          onClick={() => {
                            const titleInput = document.getElementById('new-resource-title') as HTMLInputElement;
                            const urlInput = document.getElementById('new-resource-url') as HTMLInputElement;
                            if (!urlInput.value) return alert("Введите URL");
                            const newRes: Resource = {
                              id: Math.random().toString(36).substr(2, 9),
                              type: 'link',
                              url: urlInput.value,
                              title: titleInput.value || 'Ссылка',
                            };
                            setEditFormData(prev => ({ ...prev, resources: [...prev.resources, newRes] }));
                            titleInput.value = '';
                            urlInput.value = '';
                          }}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors"
                        >
                          + Ссылка
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="https://..."
                          className="flex-1 bg-white border border-zinc-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                          id="new-resource-url"
                        />
                        <button
                          onClick={() => subfolderPdfInputRef.current?.click()}
                          className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors flex items-center gap-1"
                        >
                          <Upload className="w-3 h-3" />
                          Документ
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {editFormData.resources.length === 0 ? (
                        <p className="text-[10px] text-zinc-400 italic">Нет добавленных ресурсов</p>
                      ) : (
                        editFormData.resources.map(res => (
                          <div key={res.id} className="flex items-center justify-between bg-zinc-50 p-2 rounded-lg border border-zinc-100">
                            <div className="flex items-center gap-2 overflow-hidden">
                              {res.type === 'pdf' ? <FileText className="w-3 h-3 text-red-500" /> : <LinkIcon className="w-3 h-3 text-blue-500" />}
                              <span className="text-[10px] font-medium text-zinc-600 truncate">{res.title}</span>
                            </div>
                            <button
                              onClick={() => {
                                setEditFormData(prev => ({
                                  ...prev,
                                  resources: prev.resources.filter(r => r.id !== res.id)
                                }));
                              }}
                              className="text-zinc-400 hover:text-red-500"
                            >
                              <Plus className="w-3 h-3 rotate-45" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-zinc-100 bg-zinc-50 flex gap-3">
                {editingEntity.type === 'subfolder' && (
                  <button
                    onClick={() => {
                      setSubfolderToDelete({ programId: editingEntity.programId!, subfolderId: editingEntity.id, name: editFormData.name });
                      setEditingEntity(null);
                    }}
                    className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                    title="Удалить подпапку"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={() => setEditingEntity(null)}
                  className="flex-1 py-3 font-bold text-zinc-500 hover:bg-zinc-100 rounded-xl transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 py-3 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-lg"
                >
                  Сохранить
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Resource Adding Modal */}
      <AnimatePresence>
        {activeResourceForm && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveResourceForm(null)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden p-6"
            >
              <h3 className="text-lg font-bold mb-4">
                {activeResourceForm.type === 'link' ? 'Добавить ссылку' : 'Добавить документ'}
              </h3>
              <div className="space-y-4">
                {activeResourceForm.type === 'pdf' && (
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex flex-col items-center gap-2 text-center">
                    <button
                      onClick={() => subfolderPdfInputRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-sm"
                    >
                      <Upload className="w-4 h-4" />
                      Загрузить файл
                    </button>
                    <p className="text-[10px] text-emerald-600 font-medium uppercase tracking-wider">Или введите URL ниже</p>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">URL</label>
                  <input
                    type="text"
                    value={resourceFormData.url}
                    onChange={e => setResourceFormData({ ...resourceFormData, url: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Название</label>
                  <input
                    type="text"
                    value={resourceFormData.title}
                    onChange={e => setResourceFormData({ ...resourceFormData, title: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Название"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Описание (необязательно)</label>
                  <textarea
                    value={resourceFormData.description}
                    onChange={e => setResourceFormData({ ...resourceFormData, description: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 min-h-[80px]"
                    placeholder="Описание"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setActiveResourceForm(null)}
                    className="flex-1 py-3 font-bold text-zinc-500 hover:bg-zinc-100 rounded-xl transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={async () => {
                      if (!resourceFormData.url) return alert("Введите URL");
                      const newResource: Resource = {
                        id: Math.random().toString(36).substr(2, 9),
                        type: activeResourceForm.type,
                        url: resourceFormData.url,
                        title: resourceFormData.title || (activeResourceForm.type === 'link' ? 'Ссылка' : 'Документ'),
                        description: resourceFormData.description
                      };

                      if (activeResourceForm.targetId === 'main') {
                        await updateDoc(doc(db, "programs", program.id), {
                          resources: [...(program.resources || []), newResource]
                        });
                      } else {
                        const newSubfolders = program.subfolders?.map(sf =>
                          sf.id === activeResourceForm.targetId ? { ...sf, resources: [...(sf.resources || []), newResource] } : sf
                        );
                        await updateDoc(doc(db, "programs", program.id), { subfolders: newSubfolders });
                      }
                      setActiveResourceForm(null);
                      setResourceFormData({ url: '', title: '', description: '' });
                    }}
                    className="flex-1 py-3 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-lg"
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Subfolder Delete Confirmation Modal */}
      <AnimatePresence>
        {subfolderToDelete && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSubfolderToDelete(null)}
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
              <h3 className="text-lg font-bold mb-2">Удалить подпапку?</h3>
              <p className="text-zinc-500 text-sm mb-6">
                Действительно хочешь удалить подпапку <span className="font-bold text-zinc-900">"{subfolderToDelete.name}"</span>?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setSubfolderToDelete(null)}
                  className="flex-1 py-3 font-bold text-zinc-500 hover:bg-zinc-100 rounded-xl transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={async () => {
                    await updateDoc(doc(db, "programs", subfolderToDelete.programId), {
                      subfolders: program.subfolders?.filter(sf => sf.id !== subfolderToDelete.subfolderId)
                    });
                    setSubfolderToDelete(null);
                    setEditingSubfolderId(null);
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

      <input
        type="file"
        ref={subfolderPdfInputRef}
        className="hidden"
        accept="application/pdf"
        onChange={handleSubfolderPdfUpload}
      />
    </>
  );
}
