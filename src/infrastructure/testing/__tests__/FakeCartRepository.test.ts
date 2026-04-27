import { describe, it, expect, beforeEach } from 'vitest';
import { FakeCartRepository } from '../FakeCartRepository';
import type { CartItem } from '@/shared/domain/types';

const item = (): Omit<CartItem, 'id'> => ({
  name: 'Молоко',
  amount: '1л',
  sourceDishes: ['Суп'],
  checked: false,
  createdAt: '2026-01-01T00:00:00.000Z',
});

describe('FakeCartRepository', () => {
  let repo: FakeCartRepository;

  beforeEach(() => {
    repo = new FakeCartRepository();
  });

  it('subscribeAll immediately emits empty array', () => {
    const calls: CartItem[][] = [];
    repo.subscribeAll(i => calls.push(i));
    expect(calls[0]).toEqual([]);
  });

  it('add returns id and notifies', async () => {
    const calls: CartItem[][] = [];
    repo.subscribeAll(i => calls.push(i));
    const id = await repo.add(item());
    expect(id).toBe('1');
    expect(calls[1]![0]!.name).toBe('Молоко');
  });

  it('update changes a field', async () => {
    const id = await repo.add(item());
    await repo.update(id, { checked: true });
    const calls: CartItem[][] = [];
    repo.subscribeAll(i => calls.push(i));
    expect(calls[0]![0]!.checked).toBe(true);
  });

  it('update on unknown id is a no-op', async () => {
    await expect(repo.update('ghost', { checked: true })).resolves.toBeUndefined();
  });

  it('delete removes item', async () => {
    const id = await repo.add(item());
    await repo.delete(id);
    const calls: CartItem[][] = [];
    repo.subscribeAll(i => calls.push(i));
    expect(calls[0]).toEqual([]);
  });

  it('delete on unknown id is a no-op', async () => {
    await expect(repo.delete('ghost')).resolves.toBeUndefined();
  });

  it('deleteAll removes all items', async () => {
    await repo.add(item());
    await repo.add({ ...item(), name: 'Кефир' });
    await repo.deleteAll();
    const calls: CartItem[][] = [];
    repo.subscribeAll(i => calls.push(i));
    expect(calls[0]).toEqual([]);
  });

  it('unsubscribe stops notifications', async () => {
    const calls: CartItem[][] = [];
    const unsub = repo.subscribeAll(i => calls.push(i));
    unsub();
    await repo.add(item());
    expect(calls).toHaveLength(1);
  });
});
