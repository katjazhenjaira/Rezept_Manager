import { describe, it, expect, beforeEach } from 'vitest';
import { FakeRecipesRepository } from '../FakeRecipesRepository';
import type { Recipe } from '@/shared/domain/types';

const recipe = (): Omit<Recipe, 'id'> => ({
  title: 'Pasta',
  time: '30 мин',
  servings: 2,
  categories: ['Горячее'],
  ingredients: ['Паста 200г'],
  steps: ['Варить 10 минут'],
  macros: { calories: 400, proteins: 15, fats: 5, carbs: 70 },
  createdAt: '2026-01-01T00:00:00.000Z',
});

describe('FakeRecipesRepository', () => {
  let repo: FakeRecipesRepository;

  beforeEach(() => {
    repo = new FakeRecipesRepository();
  });

  it('subscribeAll immediately emits empty array', () => {
    const calls: Recipe[][] = [];
    repo.subscribeAll(r => calls.push(r));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual([]);
  });

  it('add returns incremental id and notifies subscribers', async () => {
    const calls: Recipe[][] = [];
    repo.subscribeAll(r => calls.push(r));
    const id = await repo.add(recipe());
    expect(id).toBe('1');
    expect(calls).toHaveLength(2);
    expect(calls[1]![0]!.title).toBe('Pasta');
  });

  it('add assigns unique ids for multiple calls', async () => {
    const id1 = await repo.add(recipe());
    const id2 = await repo.add({ ...recipe(), title: 'Risotto' });
    expect(id1).not.toBe(id2);
  });

  it('update changes a field and notifies', async () => {
    const id = await repo.add(recipe());
    const calls: Recipe[][] = [];
    repo.subscribeAll(r => calls.push(r));
    await repo.update(id, { title: 'Risotto' });
    expect(calls[calls.length - 1]![0]!.title).toBe('Risotto');
  });

  it('update on unknown id is a no-op', async () => {
    await expect(repo.update('ghost', { title: 'X' })).resolves.toBeUndefined();
  });

  it('delete removes recipe and notifies', async () => {
    const id = await repo.add(recipe());
    await repo.delete(id);
    expect(await repo.getById(id)).toBeNull();
  });

  it('delete on unknown id is a no-op', async () => {
    await expect(repo.delete('ghost')).resolves.toBeUndefined();
  });

  it('getById returns recipe for known id', async () => {
    const id = await repo.add(recipe());
    const r = await repo.getById(id);
    expect(r?.title).toBe('Pasta');
  });

  it('getById returns null for unknown id', async () => {
    expect(await repo.getById('ghost')).toBeNull();
  });

  it('unsubscribe stops future notifications', async () => {
    const calls: Recipe[][] = [];
    const unsub = repo.subscribeAll(r => calls.push(r));
    unsub();
    await repo.add(recipe());
    expect(calls).toHaveLength(1);
  });

  it('reset clears all state and restarts ids from 1', async () => {
    await repo.add(recipe());
    const calls: Recipe[][] = [];
    repo.subscribeAll(r => calls.push(r));
    repo.reset();
    expect(calls).toHaveLength(1); // only initial emit, not triggered by reset
    const id = await repo.add(recipe());
    expect(id).toBe('1');
  });
});
