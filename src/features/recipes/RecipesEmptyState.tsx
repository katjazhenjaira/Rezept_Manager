import React from 'react';
import { BookOpen, Camera, FileText, Link as LinkIcon, Edit3, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

// ─── Sub-components ───────────────────────────────────────────────────────────

function ActionButton({
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
      className="flex items-center justify-between p-4 bg-white border border-zinc-200 rounded-2xl hover:border-emerald-500 hover:shadow-md transition-all group"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-zinc-50 rounded-lg group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
          {icon}
        </div>
        <span className="font-medium text-zinc-700 group-hover:text-zinc-900">{label}</span>
      </div>
      <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-emerald-500 transition-colors" />
    </button>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export type RecipesEmptyStateProps = {
  photoInputRef: React.RefObject<HTMLInputElement | null>;
  onAddPDF: () => void;
  onAddLink: () => void;
  onAddManual: () => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function RecipesEmptyState({
  photoInputRef,
  onAddPDF,
  onAddLink,
  onAddManual,
}: RecipesEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <div className="mb-8">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 mb-2">Твой банк рецептов пока пуст</h2>
          <p className="text-zinc-500">Добавь первый рецепт удобным способом:</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ActionButton
            icon={<Camera className="w-5 h-5" />}
            label="Фото рецепта"
            onClick={() => photoInputRef.current?.click()}
          />
          <ActionButton
            icon={<FileText className="w-5 h-5" />}
            label="PDF документ"
            onClick={onAddPDF}
          />
          <ActionButton
            icon={<LinkIcon className="w-5 h-5" />}
            label="Вставить ссылку"
            onClick={onAddLink}
          />
          <ActionButton
            icon={<Edit3 className="w-5 h-5" />}
            label="Добавить вручную"
            onClick={onAddManual}
          />
        </div>
      </motion.div>
    </div>
  );
}
