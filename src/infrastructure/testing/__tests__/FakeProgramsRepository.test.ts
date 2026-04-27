import { describe, it, expect, beforeEach } from 'vitest';
import { FakeProgramsRepository } from '../FakeProgramsRepository';
import type { Program } from '@/shared/domain/types';

const program = (): Omit<Program, 'id'> => ({
  name: 'Похудение',
  description: 'Программа на 4 недели',
  creator: 'Тест',
  link: '',
  recipeIds: [],
  createdAt: '2026-01-01T00:00:00.000Z',
});

describe('FakeProgramsRepository', () => {
  let repo: FakeProgramsRepository;

  beforeEach(() => {
    repo = new FakeProgramsRepository();
  });

  it('subscribeAll immediately emits empty array', () => {
    const calls: Program[][] = [];
    repo.subscribeAll(p => calls.push(p));
    expect(calls[0]).toEqual([]);
  });

  it('add returns id and notifies', async () => {
    const calls: Program[][] = [];
    repo.subscribeAll(p => calls.push(p));
    const id = await repo.add(program());
    expect(id).toBe('1');
    expect(calls[1]![0]!.name).toBe('Похудение');
  });

  it('update changes a field', async () => {
    const id = await repo.add(program());
    await repo.update(id, { name: 'Набор массы' });
    const p = await repo.getById(id);
    expect(p?.name).toBe('Набор массы');
  });

  it('update on unknown id is a no-op', async () => {
    await expect(repo.update('ghost', { name: 'X' })).resolves.toBeUndefined();
  });

  it('delete removes program', async () => {
    const id = await repo.add(program());
    await repo.delete(id);
    expect(await repo.getById(id)).toBeNull();
  });

  it('delete on unknown id is a no-op', async () => {
    await expect(repo.delete('ghost')).resolves.toBeUndefined();
  });

  it('getById returns null for unknown id', async () => {
    expect(await repo.getById('ghost')).toBeNull();
  });

  it('unsubscribe stops notifications', async () => {
    const calls: Program[][] = [];
    const unsub = repo.subscribeAll(p => calls.push(p));
    unsub();
    await repo.add(program());
    expect(calls).toHaveLength(1);
  });
});
