import { describe, it, expect, beforeEach } from 'vitest';
import { FakeUserProfileRepository } from '../FakeUserProfileRepository';
import type { UserProfile } from '@/shared/domain/types';

const profile = (): UserProfile => ({
  name: 'Анна',
  age: 30,
  gender: 'female',
  currentWeight: 65,
  targetWeight: 60,
  targetCalories: 1800,
  targetProteins: 100,
  targetFats: 60,
  targetCarbs: 200,
  waterGoal: 2000,
  allergies: [],
});

describe('FakeUserProfileRepository', () => {
  let repo: FakeUserProfileRepository;

  beforeEach(() => {
    repo = new FakeUserProfileRepository();
  });

  it('subscribe immediately emits null when no profile saved', () => {
    const calls: (UserProfile | null)[] = [];
    repo.subscribe(p => calls.push(p));
    expect(calls[0]).toBeNull();
  });

  it('save persists profile and notifies subscriber', async () => {
    const calls: (UserProfile | null)[] = [];
    repo.subscribe(p => calls.push(p));
    await repo.save(profile());
    expect(calls).toHaveLength(2);
    expect(calls[1]!.name).toBe('Анна');
  });

  it('subsequent saves overwrite previous profile', async () => {
    await repo.save(profile());
    await repo.save({ ...profile(), name: 'Мария' });
    const calls: (UserProfile | null)[] = [];
    repo.subscribe(p => calls.push(p));
    expect(calls[0]!.name).toBe('Мария');
  });

  it('unsubscribe stops notifications', async () => {
    const calls: (UserProfile | null)[] = [];
    const unsub = repo.subscribe(p => calls.push(p));
    unsub();
    await repo.save(profile());
    expect(calls).toHaveLength(1);
  });

  it('reset clears the profile', async () => {
    await repo.save(profile());
    repo.reset();
    const calls: (UserProfile | null)[] = [];
    repo.subscribe(p => calls.push(p));
    expect(calls[0]).toBeNull();
  });
});
