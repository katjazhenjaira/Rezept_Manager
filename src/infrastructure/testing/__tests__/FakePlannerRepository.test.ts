import { describe, it, expect, beforeEach } from 'vitest';
import { FakePlannerRepository } from '../FakePlannerRepository';
import type { PlannerEntry } from '@/shared/domain/types';

const entry = (): Omit<PlannerEntry, 'id'> => ({
  date: '2026-04-27',
  mealType: 'Завтрак',
  type: 'recipe',
  recipeId: 'r1',
});

describe('FakePlannerRepository', () => {
  let repo: FakePlannerRepository;

  beforeEach(() => {
    repo = new FakePlannerRepository();
  });

  it('subscribeAll immediately emits empty array', () => {
    const calls: PlannerEntry[][] = [];
    repo.subscribeAll(e => calls.push(e));
    expect(calls[0]).toEqual([]);
  });

  it('add returns id and notifies subscribers', async () => {
    const calls: PlannerEntry[][] = [];
    repo.subscribeAll(e => calls.push(e));
    const id = await repo.add(entry());
    expect(id).toBe('1');
    expect(calls[1]![0]!.recipeId).toBe('r1');
  });

  it('delete removes entry and notifies', async () => {
    const id = await repo.add(entry());
    const calls: PlannerEntry[][] = [];
    repo.subscribeAll(e => calls.push(e));
    await repo.delete(id);
    expect(calls[calls.length - 1]).toEqual([]);
  });

  it('delete on unknown id is a no-op', async () => {
    await expect(repo.delete('ghost')).resolves.toBeUndefined();
  });

  it('unsubscribe stops notifications', async () => {
    const calls: PlannerEntry[][] = [];
    const unsub = repo.subscribeAll(e => calls.push(e));
    unsub();
    await repo.add(entry());
    expect(calls).toHaveLength(1);
  });

  it('reset clears all state', async () => {
    await repo.add(entry());
    repo.reset();
    const calls: PlannerEntry[][] = [];
    repo.subscribeAll(e => calls.push(e));
    expect(calls[0]).toEqual([]);
  });
});
