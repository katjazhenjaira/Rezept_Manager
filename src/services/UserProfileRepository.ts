import type { UserProfile } from '@/shared/domain/types';

export interface UserProfileRepository {
  subscribe(
    callback: (profile: UserProfile | null) => void,
    onError?: (error: Error) => void,
  ): () => void;
  save(profile: UserProfile): Promise<void>;
}
