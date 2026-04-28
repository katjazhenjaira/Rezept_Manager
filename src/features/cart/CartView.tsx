import { useState } from 'react';
import { ShoppingCart, Plus, Edit2, Trash2, Check } from 'lucide-react';
import { addDoc, updateDoc, deleteDoc, doc, collection } from 'firebase/firestore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { db } from '@/infrastructure/firebaseApp';
import { isStaple } from '@/features/cart/services/staples';
import type { CartItem } from '@/shared/domain/types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type CartItemRowProps = {
  item: CartItem;
  isBasic?: boolean;
  onToggle: (item: CartItem) => void;
  onDelete: (id: string) => void;
  onUpdateAmount: (id: string, amount: string) => void;
};

function CartItemRow({ item, isBasic = false, onToggle, onDelete, onUpdateAmount }: CartItemRowProps) {
  return (
    <div className={cn('p-3 flex items-center gap-3 hover:bg-zinc-50/50 transition-colors group', item.checked && 'opacity-50')}>
      <button
        onClick={() => onToggle(item)}
        className={cn(
          'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0',
          item.checked
            ? 'bg-emerald-500 border-emerald-500 text-white'
            : isBasic
            ? 'border-emerald-200 text-transparent'
            : 'border-zinc-200 text-transparent'
        )}
      >
        <Check className="w-3 h-3" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className={cn('font-bold text-sm text-zinc-900', item.checked && 'line-through')}>{item.name}</span>
          <span className={cn('text-xs font-medium', isBasic ? 'text-emerald-600/60' : 'text-zinc-400')}>
            {isBasic ? `Нужно: ${item.amount}` : item.amount}
          </span>
        </div>
        {item.sourceDishes && item.sourceDishes.length > 0 && (
          <p className="text-[10px] text-zinc-400 truncate italic">({item.sourceDishes.join(', ')})</p>
        )}
        {isBasic && !item.checked && (
          <p className="text-[10px] text-emerald-600/40 font-medium">Есть в наличии или докупить?</p>
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

type Props = {
  cart: CartItem[];
};

export function CartView({ cart }: Props) {
  const [newCartItemName, setNewCartItemName] = useState('');
  const [newCartItemAmount, setNewCartItemAmount] = useState('');

  const handleAddManualCartItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCartItemName.trim()) return;

    await addDoc(collection(db, 'cart'), {
      name: newCartItemName,
      amount: newCartItemAmount,
      sourceDishes: [],
      checked: false,
      isBasic: isStaple(newCartItemName),
      createdAt: new Date().toISOString(),
    });

    setNewCartItemName('');
    setNewCartItemAmount('');
  };

  const toggleCartItem = (item: CartItem) =>
    updateDoc(doc(db, 'cart', item.id), { checked: !item.checked });

  const deleteCartItem = (id: string) => deleteDoc(doc(db, 'cart', id));

  const updateCartItemAmount = (id: string, amount: string) =>
    updateDoc(doc(db, 'cart', id), { amount });

  const clearCart = async () => {
    if (!confirm('Очистить всю корзину?')) return;
    for (const item of cart) {
      await deleteDoc(doc(db, 'cart', item.id));
    }
  };

  const basicItems = cart.filter((item) => item.isBasic);
  const mainItems = cart.filter((item) => !item.isBasic);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display mb-1">Корзина</h2>
          <p className="text-sm text-zinc-500">Список покупок для ваших рецептов</p>
        </div>
        <button onClick={clearCart} className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors">
          Очистить все
        </button>
      </div>

      <form onSubmit={handleAddManualCartItem} className="bg-white p-4 rounded-2xl border border-zinc-100 shadow-sm flex gap-3">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Название продукта..."
            value={newCartItemName}
            onChange={(e) => setNewCartItemName(e.target.value)}
            className="w-full bg-zinc-50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>
        <div className="w-24">
          <input
            type="text"
            placeholder="Кол-во..."
            value={newCartItemAmount}
            onChange={(e) => setNewCartItemAmount(e.target.value)}
            className="w-full bg-zinc-50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>
        <button
          type="submit"
          className="bg-emerald-600 text-white px-5 py-2 rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Добавить</span>
        </button>
      </form>

      {cart.length === 0 ? (
        <div className="bg-white rounded-3xl border border-zinc-100 p-12 text-center space-y-4">
          <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto">
            <ShoppingCart className="w-8 h-8 text-zinc-200" />
          </div>
          <p className="text-zinc-500 text-sm">Ваша корзина пуста. Добавьте продукты вручную или из планировщика.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {mainItems.length > 0 && (
            <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-zinc-50/50 border-b border-zinc-100">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Основные продукты</h3>
              </div>
              <div className="divide-y divide-zinc-50">
                {mainItems.map((item) => (
                  <CartItemRow
                    key={item.id}
                    item={item}
                    onToggle={toggleCartItem}
                    onDelete={deleteCartItem}
                    onUpdateAmount={updateCartItemAmount}
                  />
                ))}
              </div>
            </div>
          )}

          {basicItems.length > 0 && (
            <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-emerald-50/30 border-b border-emerald-100">
                <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
                  Базовые продукты (Проверьте наличие)
                </h3>
              </div>
              <div className="divide-y divide-zinc-50">
                {basicItems.map((item) => (
                  <CartItemRow
                    key={item.id}
                    item={item}
                    isBasic
                    onToggle={toggleCartItem}
                    onDelete={deleteCartItem}
                    onUpdateAmount={updateCartItemAmount}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
