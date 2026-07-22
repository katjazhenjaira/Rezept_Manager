import { useState } from 'react';
import { ShoppingCart, Plus } from 'lucide-react';
import { useRepositories } from '@/app/providers/RepositoryContext';
import { isStaple } from '@/features/cart/services/staples';
import { productAllergens } from '@/shared/domain/allergies';
import { CartItemRow } from './CartItemRow';
import type { CartItem } from '@/shared/domain/types';

type Props = {
  cart: CartItem[];
  allergies: string[];
};

export function CartView({ cart, allergies }: Props) {
  const { cart: cartRepo } = useRepositories();
  const [newCartItemName, setNewCartItemName] = useState('');
  const [newCartItemAmount, setNewCartItemAmount] = useState('');

  const handleAddManualCartItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCartItemName.trim()) return;

    await cartRepo.add({
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

  const toggleCartItem = (item: CartItem) => cartRepo.update(item.id, { checked: !item.checked });

  const deleteCartItem = (id: string) => cartRepo.delete(id);

  const updateCartItemAmount = (id: string, amount: string) => cartRepo.update(id, { amount });

  const clearCart = async () => {
    if (!confirm('Очистить всю корзину?')) return;
    await cartRepo.deleteAll();
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
        <button
          onClick={clearCart}
          className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors"
        >
          Очистить все
        </button>
      </div>

      <form
        onSubmit={handleAddManualCartItem}
        className="bg-white p-4 rounded-2xl border border-zinc-100 shadow-sm flex gap-3"
      >
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
          <p className="text-zinc-500 text-sm">
            Ваша корзина пуста. Добавьте продукты вручную или из планировщика.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {mainItems.length > 0 && (
            <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-zinc-50/50 border-b border-zinc-100">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  Основные продукты
                </h3>
              </div>
              <div className="divide-y divide-zinc-50">
                {mainItems.map((item) => (
                  <CartItemRow
                    key={item.id}
                    item={item}
                    allergens={productAllergens(item.name, allergies)}
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
                    allergens={productAllergens(item.name, allergies)}
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
