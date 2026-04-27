import type { UserProfileRepository } from '@/services/UserProfileRepository';
import type { UserProfile } from '@/shared/domain/types';

export class FakeUserProfileRepository implements UserProfileRepository {
  private current: UserProfile | null = null;
  private listeners = new Set<(profile: UserProfile | null) => void>();

  private emit(): void {
    const snapshot = this.current ? { ...this.current } : null;
    this.listeners.forEach(cb => cb(snapshot));
  }

  subscribe(callback: (profile: UserProfile | null) => void): () => void {
    this.listeners.add(callback);
    callback(this.current);
    return () => this.listeners.delete(callback);
  }

  async save(profile: UserProfile): Promise<void> {
    this.current = { ...profile };
    this.emit();
  }

  reset(): void {
    this.current = null;
    this.listeners.clear();
  }
}
