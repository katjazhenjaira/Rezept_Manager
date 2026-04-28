import { useState } from 'react';
import { Settings, Plus, Trash2, Droplets } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { setDoc, doc } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { db } from '@/infrastructure/firebaseApp';
import type { UserProfile } from '@/shared/domain/types';
import { changeLanguage, type AppLanguage } from '@/app/providers/I18nProvider';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DEFAULT_CATEGORIES = ['Завтрак', 'Обед', 'Ужин', 'Перекус', 'Десерт', 'Мясо', 'Рыба', 'Веган', 'Вегетарианское', 'Напитки', 'Основное блюдо', 'Гарниры', 'Салаты', 'Супы'];
const PRESET_ALLERGIES = ['Глютен', 'Лактоза', 'Орехи', 'Морепродукты', 'Яйца', 'Соя', 'Мед', 'Цитрусовые'];

type Props = {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  setUserProfile: (p: UserProfile) => void;
  availableCategories: string[];
  setAvailableCategories: (setter: (prev: string[]) => string[]) => void;
  onCategoryRemoved: (cat: string) => void;
};

export function SettingsModal({
  isOpen,
  onClose,
  userProfile,
  setUserProfile,
  availableCategories,
  setAvailableCategories,
  onCategoryRemoved,
}: Props) {
  const { i18n } = useTranslation();
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [isCategoryDeleteConfirmOpen, setIsCategoryDeleteConfirmOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);

  const handleSaveSettings = async () => {
    try {
      await setDoc(doc(db, 'settings', 'profile'), userProfile);
      onClose();
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Не удалось сохранить настройки');
    }
  };

  const handleCreateCategory = () => {
    const newCat = newCategoryInput.trim();
    if (newCat && !availableCategories.includes(newCat)) {
      setAvailableCategories((prev) => [...prev, newCat]);
      setNewCategoryInput('');
      setIsCategoryModalOpen(false);
    }
  };

  const removeCategory = (cat: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCategoryToDelete(cat);
    setIsCategoryDeleteConfirmOpen(true);
  };

  const confirmRemoveCategory = () => {
    if (categoryToDelete) {
      setAvailableCategories((prev) => prev.filter((c) => c !== categoryToDelete));
      onCategoryRemoved(categoryToDelete);
      setIsCategoryDeleteConfirmOpen(false);
      setCategoryToDelete(null);
    }
  };

  const toggleAllergy = (allergy: string) => {
    const newAllergies = userProfile.allergies.includes(allergy)
      ? userProfile.allergies.filter((a) => a !== allergy)
      : [...userProfile.allergies, allergy];
    setUserProfile({ ...userProfile, allergies: newAllergies });
  };

  const addCustomAllergy = (val: string) => {
    if (val && !userProfile.allergies.includes(val)) {
      setUserProfile({ ...userProfile, allergies: [...userProfile.allergies, val] });
    }
  };

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
            className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-600">
                  <Settings className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-zinc-900">Настройки профиля</h2>
              </div>
              <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>

            <div className="p-8 overflow-y-auto custom-scrollbar space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase">Имя</label>
                  <input
                    type="text"
                    value={userProfile.name}
                    onChange={(e) => setUserProfile({ ...userProfile, name: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Ваше имя"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase">Возраст</label>
                  <input
                    type="number"
                    value={userProfile.age}
                    onChange={(e) => setUserProfile({ ...userProfile, age: parseInt(e.target.value) })}
                    className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase">Пол</label>
                  <select
                    value={userProfile.gender}
                    onChange={(e) => setUserProfile({ ...userProfile, gender: e.target.value as 'male' | 'female' })}
                    className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="female">Женский</option>
                    <option value="male">Мужской</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase">Текущий вес (кг)</label>
                  <input
                    type="number"
                    value={userProfile.currentWeight}
                    onChange={(e) => setUserProfile({ ...userProfile, currentWeight: parseFloat(e.target.value) })}
                    className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase">Желаемый вес (кг)</label>
                  <input
                    type="number"
                    value={userProfile.targetWeight}
                    onChange={(e) => setUserProfile({ ...userProfile, targetWeight: parseFloat(e.target.value) })}
                    className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-zinc-900 border-b border-zinc-100 pb-2">Цели КБЖУ</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase">Ккал</label>
                    <input
                      type="number"
                      value={userProfile.targetCalories}
                      onChange={(e) => setUserProfile({ ...userProfile, targetCalories: parseInt(e.target.value) })}
                      className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase">Белки (г)</label>
                    <input
                      type="number"
                      value={userProfile.targetProteins}
                      onChange={(e) => setUserProfile({ ...userProfile, targetProteins: parseInt(e.target.value) })}
                      className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase">Жиры (г)</label>
                    <input
                      type="number"
                      value={userProfile.targetFats}
                      onChange={(e) => setUserProfile({ ...userProfile, targetFats: parseInt(e.target.value) })}
                      className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase">Углеводы (г)</label>
                    <input
                      type="number"
                      value={userProfile.targetCarbs}
                      onChange={(e) => setUserProfile({ ...userProfile, targetCarbs: parseInt(e.target.value) })}
                      className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-zinc-900 border-b border-zinc-100 pb-2">Аллергии и непереносимости</h3>
                <div className="flex flex-wrap gap-2">
                  {PRESET_ALLERGIES.map((allergy) => (
                    <button
                      key={allergy}
                      onClick={() => toggleAllergy(allergy)}
                      className={cn(
                        'px-4 py-2 rounded-xl text-sm font-medium transition-all border',
                        userProfile.allergies.includes(allergy)
                          ? 'bg-red-50 border-red-200 text-red-600 shadow-sm'
                          : 'bg-zinc-50 border-zinc-100 text-zinc-500 hover:border-red-100'
                      )}
                    >
                      {allergy}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    id="custom-allergy-input"
                    type="text"
                    placeholder="Добавить свою..."
                    className="flex-1 bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = (e.target as HTMLInputElement).value.trim();
                        addCustomAllergy(val);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      const input = document.getElementById('custom-allergy-input') as HTMLInputElement;
                      addCustomAllergy(input.value.trim());
                      input.value = '';
                    }}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all"
                  >
                    Добавить
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                  <h3 className="text-sm font-bold text-zinc-900">Управление категориями</h3>
                  <button
                    onClick={() => setIsCategoryModalOpen(true)}
                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Добавить
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableCategories.map((cat) => (
                    <div
                      key={cat}
                      className="group flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-all border bg-zinc-50 border-zinc-100 text-zinc-600"
                    >
                      <span>{cat}</span>
                      {!DEFAULT_CATEGORIES.includes(cat) && (
                        <button
                          onClick={(e) => removeCategory(cat, e)}
                          className="text-zinc-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100">
                <div className="flex items-center gap-3 mb-4">
                  <Droplets className="w-5 h-5 text-blue-600" />
                  <h3 className="text-sm font-bold text-blue-900">Калькулятор воды</h3>
                </div>
                <p className="text-sm text-blue-700 mb-4">
                  На основе вашего веса ({userProfile.currentWeight} кг) рекомендуемая норма воды:
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-blue-600">
                    {Math.round(userProfile.currentWeight * 35)} мл
                  </span>
                  <button
                    onClick={() => setUserProfile({ ...userProfile, waterGoal: Math.round(userProfile.currentWeight * 35) })}
                    className="text-xs font-bold bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-all"
                  >
                    Установить как цель
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-bold text-zinc-900 border-b border-zinc-100 pb-2">Язык интерфейса</h3>
                <div className="flex gap-2">
                  {(['ru', 'de', 'en'] as AppLanguage[]).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => changeLanguage(lang)}
                      className={cn(
                        'flex-1 py-2 rounded-xl text-sm font-bold border transition-all',
                        i18n.language === lang
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                          : 'bg-zinc-50 border-zinc-100 text-zinc-500 hover:border-emerald-200'
                      )}
                    >
                      {lang === 'ru' ? '🇷🇺 RU' : lang === 'de' ? '🇩🇪 DE' : '🇬🇧 EN'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-zinc-100 bg-zinc-50">
              <button
                onClick={handleSaveSettings}
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
              >
                Сохранить настройки
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Category create modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsCategoryModalOpen(false)}
            className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden p-8"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">Новая категория</h3>
              <button onClick={() => setIsCategoryModalOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase">Название</label>
                <input
                  autoFocus
                  type="text"
                  value={newCategoryInput}
                  onChange={(e) => setNewCategoryInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateCategory()}
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Например: Праздничное"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="py-3 bg-zinc-100 text-zinc-600 rounded-xl font-bold hover:bg-zinc-200 transition-all"
                >
                  Отмена
                </button>
                <button
                  onClick={handleCreateCategory}
                  disabled={!newCategoryInput.trim()}
                  className="py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50 disabled:shadow-none"
                >
                  Создать
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Category delete confirm modal */}
      {isCategoryDeleteConfirmOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsCategoryDeleteConfirmOpen(false)}
            className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden p-8 text-center"
          >
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold mb-2">Удалить категорию?</h3>
            <p className="text-zinc-500 text-sm mb-8">
              Вы уверены, что хотите удалить категорию «{categoryToDelete}»?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setIsCategoryDeleteConfirmOpen(false)}
                className="py-3 bg-zinc-100 text-zinc-600 rounded-xl font-bold hover:bg-zinc-200 transition-all"
              >
                Отмена
              </button>
              <button
                onClick={confirmRemoveCategory}
                className="py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-100"
              >
                Удалить
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
