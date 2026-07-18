// src/app/layout/AppHeader.tsx
import React, { useState } from 'react';
import { BookOpen, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type AppHeaderProps = {
  onOpenSettings: () => void;
};

export function AppHeader({ onOpenSettings }: AppHeaderProps) {
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<'ru' | 'de' | 'en'>('ru');

  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-zinc-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 h-auto py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-200">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight font-display">Рецепт Менеджер</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setIsLanguageDropdownOpen(!isLanguageDropdownOpen)}
                className="p-2 bg-zinc-100 text-zinc-600 rounded-xl hover:bg-zinc-200 transition-all flex items-center justify-center min-w-[40px]"
              >
                <span className="text-lg">
                  {currentLanguage === 'ru' ? '🇷🇺' : currentLanguage === 'de' ? '🇩🇪' : '🇺🇸'}
                </span>
              </button>
              <AnimatePresence>
                {isLanguageDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsLanguageDropdownOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-32 bg-white rounded-2xl shadow-2xl border border-zinc-100 overflow-hidden z-50"
                    >
                      <button
                        onClick={() => { setCurrentLanguage('ru'); setIsLanguageDropdownOpen(false); }}
                        className={cn(
                          'w-full px-4 py-3 text-left text-sm font-bold flex items-center gap-3 hover:bg-zinc-50 transition-colors',
                          currentLanguage === 'ru' ? 'text-emerald-600 bg-emerald-50/50' : 'text-zinc-600',
                        )}
                      >
                        <span>🇷🇺</span> Русский
                      </button>
                      <button
                        onClick={() => { setCurrentLanguage('de'); setIsLanguageDropdownOpen(false); }}
                        className={cn(
                          'w-full px-4 py-3 text-left text-sm font-bold flex items-center gap-3 hover:bg-zinc-50 transition-colors',
                          currentLanguage === 'de' ? 'text-emerald-600 bg-emerald-50/50' : 'text-zinc-600',
                        )}
                      >
                        <span>🇩🇪</span> Deutsch
                      </button>
                      <button
                        onClick={() => { setCurrentLanguage('en'); setIsLanguageDropdownOpen(false); }}
                        className={cn(
                          'w-full px-4 py-3 text-left text-sm font-bold flex items-center gap-3 hover:bg-zinc-50 transition-colors',
                          currentLanguage === 'en' ? 'text-emerald-600 bg-emerald-50/50' : 'text-zinc-600',
                        )}
                      >
                        <span>🇺🇸</span> English
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            <button
              onClick={onOpenSettings}
              className="p-2 bg-zinc-100 text-zinc-600 rounded-xl hover:bg-zinc-200 transition-all"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
