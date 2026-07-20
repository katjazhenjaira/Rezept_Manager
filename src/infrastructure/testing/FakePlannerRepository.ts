import type { PlannerRepository } from '@/services/PlannerRepository';
import type { PlannerEntry } from '@/shared/domain/types';
import { FakeCollectionRepository } from './FakeCollectionRepository';

export class FakePlannerRepository
  extends FakeCollectionRepository<PlannerEntry>
  implements PlannerRepository {}
