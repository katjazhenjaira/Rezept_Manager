import type { UserProfile } from '@/shared/domain/types';

export interface UserProfileRepository {
  subscribe(callback: (profile: UserProfile | null) => void): () => void;
  save(profile: UserProfile): Promise<void>;
}
