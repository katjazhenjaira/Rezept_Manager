import { Edit2, Trash2, Check, AlertTriangle } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { CartItem } from '@/shared/domain/types';

// ─── Utility ─────────────────────────────────────────────────────────────────

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Props ────────────────────────────────────────────────────────────────────

export type CartItemRowProps = {
  item: CartItem;
  isBasic?: boolean;
  allergens: string[];
  onToggle: (item: CartItem) => void;
  onDelete: (id: string) => void;
  onUpdateAmount: (id: string, amount: string) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function CartItemRow({
  item,
  isBasic = false,
  allergens,
  onToggle,
  onDelete,
  onUpdateAmount,
}: CartItemRowProps) {
  const hasAllergen = allergens.length > 0;

  return (
    <div
      className={cn(
        'p-3 flex items-center gap-3 hover:bg-zinc-50/50 transition-colors group',
        item.checked && 'opacity-50',
        hasAllergen && !item.checked && 'bg-red-50/60 hover:bg-red-50',
      )}
    >
      <button
        onClick={() => onToggle(item)}
        className={cn(
          'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0',
          item.checked
            ? 'bg-emerald-500 border-emerald-500 text-white'
            : isBasic
              ? 'border-emerald-200 text-transparent'
              : 'border-zinc-200 text-transparent',
        )}
      >
        <Check className="w-3 h-3" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              'font-bold text-sm',
              hasAllergen && !item.checked ? 'text-red-700' : 'text-zinc-900',
              item.checked && 'line-through',
            )}
          >
            {item.name}
          </span>
          <span
            className={cn('text-xs font-medium', isBasic ? 'text-emerald-600/60' : 'text-zinc-400')}
          >
            {isBasic ? `Нужно: ${item.amount}` : item.amount}
          </span>
        </div>
        {item.sourceDishes && item.sourceDishes.length > 0 && (
          <p className="text-[10px] text-zinc-400 truncate italic">
            ({item.sourceDishes.join(', ')})
          </p>
        )}
        {isBasic && !item.checked && (
          <p className="text-[10px] text-emerald-600/40 font-medium">
            Есть в наличии или докупить?
          </p>
        )}
        {hasAllergen && !item.checked && (
          <p className="flex items-center gap-1 text-[10px] text-red-600 font-bold">
            <AlertTriangle className="w-3 h-3 flex-shrink-0" />
            Осторожно: аллерген! ({allergens.join(', ')})
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isBasic && (
          <button
            onClick={() => {
              const newAmount = prompt('Изменить количество:', item.amount);
              if (newAmount !== null) onUpdateAmount(item.id, newAmount);
            }}
            className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={() => onDelete(item.id)}
          className="p-1.5 hover:bg-red-50 rounded-lg text-zinc-400 hover:text-red-600 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
