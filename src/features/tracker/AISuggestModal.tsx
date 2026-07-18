// src/features/tracker/AISuggestModal.tsx
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Loader2, Plus, Check } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { FillRemainingOption } from '@/services/ai/contracts';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type SuggestionResult = {
  options: FillRemainingOption[];
  reason: string;
};

export type AISuggestModalProps = {
  isOpen: boolean;
  onClose: () => void;
  suggestion: SuggestionResult | null;
  isSuggesting: boolean;
  selectedIds: string[];
  onToggleId: (id: string) => void;
  onAddSelected: () => Promise<void>;
  onRequestAlternative: () => void;
};

export function AISuggestModal({
  isOpen,
  onClose,
  suggestion,
  isSuggesting,
  selectedIds,
  onToggleId,
  onAddSelected,
  onRequestAlternative,
}: AISuggestModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
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
            className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden p-8"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-zinc-900">Рекомендация ИИ</h2>
              </div>
              <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>

            {!suggestion ? (
              <div className="py-12 text-center space-y-4">
                <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto" />
                <p className="text-zinc-500 font-medium">Анализирую ваши КБЖУ и рецепты...</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
                  <h3 className="text-sm font-bold text-emerald-600 uppercase tracking-widest mb-4">
                    Рекомендация на остаток кбжу на день
                  </h3>
                  <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                    {suggestion.options.map((option) => (
                      <div
                        key={option.id}
                        className={cn(
                          'bg-white p-4 rounded-xl border transition-all cursor-pointer relative group',
                          selectedIds.includes(option.id)
                            ? 'border-emerald-500 shadow-md ring-1 ring-emerald-500'
                            : 'border-emerald-100 shadow-sm hover:border-emerald-300',
                        )}
                        onClick={() => onToggleId(option.id)}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              'w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 mt-0.5',
                              selectedIds.includes(option.id)
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'border-zinc-200 bg-white',
                            )}
                          >
                            {selectedIds.includes(option.id) && <Check className="w-3.5 h-3.5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-bold text-zinc-900 text-sm leading-tight">
                                {option.type === 'recipe' ? `Рецепт: ${option.description}` : option.description}
                              </span>
                              <span className="text-xs font-bold text-emerald-600 ml-2 whitespace-nowrap">
                                {option.macros.calories} ккал
                              </span>
                            </div>
                            <div className="flex gap-3 text-[10px] font-bold text-zinc-400 uppercase">
                              <span>Б: {option.macros.proteins}г</span>
                              <span>Ж: {option.macros.fats}г</span>
                              <span>У: {option.macros.carbs}г</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-emerald-700 text-sm mt-6 italic">"{suggestion.reason}"</p>
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    disabled={selectedIds.length === 0}
                    onClick={() => void onAddSelected()}
                    className={cn(
                      'w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg',
                      selectedIds.length > 0
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100'
                        : 'bg-zinc-100 text-zinc-400 cursor-not-allowed',
                    )}
                  >
                    <Plus className="w-5 h-5" />
                    Добавить в рацион ({selectedIds.length})
                  </button>
                  <button
                    onClick={onRequestAlternative}
                    disabled={isSuggesting}
                    className="w-full py-3 bg-zinc-100 text-zinc-600 rounded-xl font-bold hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
                  >
                    {isSuggesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Предложить другие варианты
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
