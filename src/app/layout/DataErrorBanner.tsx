import { AlertTriangle } from 'lucide-react';
import { useData, type DataCollectionKey } from '@/app/providers/DataContext';

const COLLECTION_LABELS: Record<DataCollectionKey, string> = {
  recipes: 'Рецепты',
  plannerEntries: 'Планер',
  cartItems: 'Корзина',
  programs: 'Программы',
};

/**
 * Отличает «данные не загрузились» от «данных нет»: без баннера упавшая подписка
 * выглядит как пустой список (LOG-9).
 */
export function DataErrorBanner() {
  const { errors } = useData();
  if (!errors || errors.length === 0) return null;

  const sections = errors.map((key) => COLLECTION_LABELS[key]).join(', ');

  return (
    <div
      role="alert"
      className="max-w-7xl mx-auto mt-4 px-4 flex items-start gap-3 text-sm text-red-800"
    >
      <div className="w-full flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
        <p>
          Не удалось загрузить данные ({sections}). Показанные списки могут быть неполными —
          проверьте подключение к интернету и при необходимости войдите в аккаунт заново.
        </p>
      </div>
    </div>
  );
}
