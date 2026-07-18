// src/features/tracker/ProgramSelectionModal.tsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Check, Edit3 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/infrastructure/firebaseApp';
import { useData } from '@/app/providers/DataContext';
import { useNutritionPlan, useUserProfile } from '@/app/providers/UserProfileContext';
import type { ActiveNutritionPlan } from '@/shared/domain/types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type CustomPlanForm = {
  name: string;
  calories: number;
  proteins: number;
  fats: number;
  carbs: number;
};

export type ProgramSelectionModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function ProgramSelectionModal({ isOpen, onClose }: ProgramSelectionModalProps) {
  const { programs } = useData();
  const { activeNutritionPlan, setActivePlan } = useNutritionPlan();
  const { userProfile } = useUserProfile();

  const [customPlanForm, setCustomPlanForm] = useState<CustomPlanForm>({
    name: '',
    calories: 0,
    proteins: 0,
    fats: 0,
    carbs: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setCustomPlanForm({ name: '', calories: 0, proteins: 0, fats: 0, carbs: 0 });
    }
  }, [isOpen]);

  const handleApplyCustomPlan = async () => {
    if (!customPlanForm.name) return;
    setIsSubmitting(true);
    try {
      const newProgram = {
        name: customPlanForm.name,
        description: 'Свой план питания',
        creator: userProfile?.name ?? 'Я',
        targetCalories: customPlanForm.calories,
        targetProteins: customPlanForm.proteins,
        targetFats: customPlanForm.fats,
        targetCarbs: customPlanForm.carbs,
        recipeIds: [],
        subfolders: [],
        link: '',
        createdAt: new Date().toISOString(),
      };
      const docRef = await addDoc(collection(db, 'programs'), newProgram);
      await setActivePlan({
        ...customPlanForm,
        isCustom: true,
        programId: docRef.id,
        allowedProducts: [],
        forbiddenProducts: [],
      });
      setCustomPlanForm({ name: '', calories: 0, proteins: 0, fats: 0, carbs: 0 });
      onClose();
    } catch (error) {
      console.error('Error saving custom plan:', error);
      alert('Не удалось сохранить план питания');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetDefault = async () => {
    await setActivePlan(null);
    onClose();
  };

  const handleSelectProgram = async (plan: ActiveNutritionPlan) => {
    await setActivePlan(plan);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
          >
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-lg font-bold">Выбрать программу питания</h3>
              <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
              {/* Custom Plan Form */}
              <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 space-y-4">
                <h4 className="font-bold text-emerald-900 flex items-center gap-2">
                  <Edit3 className="w-4 h-4" />
                  Свой план питания
                </h4>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Название плана (напр. Сушка)"
                    value={customPlanForm.name}
                    onChange={(e) => setCustomPlanForm({ ...customPlanForm, name: e.target.value })}
                    className="w-full bg-white border border-emerald-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      placeholder="Ккал"
                      value={customPlanForm.calories || ''}
                      onChange={(e) => setCustomPlanForm({ ...customPlanForm, calories: parseInt(e.target.value) || 0 })}
                      className="bg-white border border-emerald-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Белки (г)"
                      value={customPlanForm.proteins || ''}
                      onChange={(e) => setCustomPlanForm({ ...customPlanForm, proteins: parseInt(e.target.value) || 0 })}
                      className="bg-white border border-emerald-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Жиры (г)"
                      value={customPlanForm.fats || ''}
                      onChange={(e) => setCustomPlanForm({ ...customPlanForm, fats: parseInt(e.target.value) || 0 })}
                      className="bg-white border border-emerald-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Углеводы (г)"
                      value={customPlanForm.carbs || ''}
                      onChange={(e) => setCustomPlanForm({ ...customPlanForm, carbs: parseInt(e.target.value) || 0 })}
                      className="bg-white border border-emerald-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    />
                  </div>
                  <button
                    onClick={() => void handleApplyCustomPlan()}
                    disabled={isSubmitting}
                    className="w-full py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Сохраняем...' : 'Применить свой план'}
                  </button>
                </div>
              </div>

              {/* Existing Programs */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Доступные программы</h4>

                <button
                  onClick={() => void handleSetDefault()}
                  className={cn(
                    'w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between group',
                    !activeNutritionPlan
                      ? 'bg-emerald-50 border-emerald-200 shadow-sm'
                      : 'bg-white border-zinc-100 hover:border-emerald-200',
                  )}
                >
                  <div>
                    <h5 className="font-bold text-zinc-900">По умолчанию</h5>
                    <p className="text-xs text-zinc-500">Данные из ваших настроек профиля</p>
                  </div>
                  {!activeNutritionPlan && <Check className="w-5 h-5 text-emerald-600" />}
                </button>

                {programs.map((program) => (
                  <div key={program.id} className="space-y-2">
                    <button
                      onClick={() =>
                        void handleSelectProgram({
                          name: program.name,
                          calories: program.targetCalories ?? userProfile?.targetCalories ?? 0,
                          proteins: program.targetProteins ?? userProfile?.targetProteins ?? 0,
                          fats: program.targetFats ?? userProfile?.targetFats ?? 0,
                          carbs: program.targetCarbs ?? userProfile?.targetCarbs ?? 0,
                          isCustom: false,
                          programId: program.id,
                          allowedProducts: program.allowedProducts,
                          forbiddenProducts: program.forbiddenProducts,
                        })
                      }
                      className={cn(
                        'w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between group',
                        activeNutritionPlan?.programId === program.id && !activeNutritionPlan?.subfolderId
                          ? 'bg-emerald-50 border-emerald-200 shadow-sm'
                          : 'bg-white border-zinc-100 hover:border-emerald-200',
                      )}
                    >
                      <div>
                        <h5 className="font-bold text-zinc-900">{program.name}</h5>
                        {program.targetCalories ? (
                          <p className="text-xs text-emerald-600 font-medium">
                            {program.targetCalories} ккал • Б:{program.targetProteins} Ж:{program.targetFats} У:{program.targetCarbs}
                          </p>
                        ) : (
                          <p className="text-xs text-zinc-400 italic">КБЖУ не заданы (будут взяты из настроек)</p>
                        )}
                      </div>
                      {activeNutritionPlan?.programId === program.id && !activeNutritionPlan?.subfolderId && (
                        <Check className="w-5 h-5 text-emerald-600" />
                      )}
                    </button>

                    {program.subfolders && program.subfolders.length > 0 && (
                      <div className="pl-6 space-y-2">
                        {program.subfolders.map((subfolder) => (
                          <button
                            key={subfolder.id}
                            onClick={() =>
                              void handleSelectProgram({
                                name: program.name,
                                subfolderName: subfolder.name,
                                calories:
                                  subfolder.targetCalories ??
                                  program.targetCalories ??
                                  userProfile?.targetCalories ?? 0,
                                proteins:
                                  subfolder.targetProteins ??
                                  program.targetProteins ??
                                  userProfile?.targetProteins ?? 0,
                                fats:
                                  subfolder.targetFats ??
                                  program.targetFats ??
                                  userProfile?.targetFats ?? 0,
                                carbs:
                                  subfolder.targetCarbs ??
                                  program.targetCarbs ??
                                  userProfile?.targetCarbs ?? 0,
                                isCustom: false,
                                programId: program.id,
                                subfolderId: subfolder.id,
                                allowedProducts: subfolder.allowedProducts ?? program.allowedProducts,
                                forbiddenProducts: subfolder.forbiddenProducts ?? program.forbiddenProducts,
                              })
                            }
                            className={cn(
                              'w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between group',
                              activeNutritionPlan?.programId === program.id &&
                              activeNutritionPlan?.subfolderId === subfolder.id
                                ? 'bg-emerald-50 border-emerald-200 shadow-sm'
                                : 'bg-white border-zinc-50 hover:border-emerald-100',
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                              <div>
                                <h6 className="text-sm font-bold text-zinc-700">{subfolder.name}</h6>
                                {subfolder.targetCalories && (
                                  <p className="text-[10px] text-emerald-600 font-medium">
                                    {subfolder.targetCalories} ккал
                                  </p>
                                )}
                              </div>
                            </div>
                            {activeNutritionPlan?.programId === program.id &&
                              activeNutritionPlan?.subfolderId === subfolder.id && (
                              <Check className="w-4 h-4 text-emerald-600" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
