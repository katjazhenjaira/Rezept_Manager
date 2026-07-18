// src/app/layout/RecipeSelectionBar.tsx
import React from 'react';
import { Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type RecipeSelectionBarProps = {
  isVisible: boolean;
  selectedCount: number;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
};

export function RecipeSelectionBar({ isVisible, selectedCount, onCancel, onConfirm }: RecipeSelectionBarProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          exit={{ y: 100 }}
          className="fixed bottom-24 left-4 right-4 z-50 flex justify-center"
        >
          <div className="bg-zinc-900 text-white px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-8 border border-white/10 backdrop-blur-xl">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Выбрано</span>
              <span className="text-xl font-bold text-emerald-400">{selectedCount} рецептов</span>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="flex items-center gap-3">
              <button
                onClick={onCancel}
                className="px-6 py-2.5 rounded-xl font-bold text-zinc-400 hover:text-white transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={() => void onConfirm()}
                disabled={selectedCount === 0}
                className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:hover:bg-emerald-500 text-white px-8 py-2.5 rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                <span>Добавить</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
