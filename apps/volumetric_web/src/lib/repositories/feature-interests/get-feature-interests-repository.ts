import { getFirestore } from "@/lib/firebase";
import type { IFeatureInterestsRepository } from "./feature-interests-repository.interface";
import { FirebaseFeatureInterestsRepository } from "./firebase-feature-interests.repository";

let featureInterestsRepository: IFeatureInterestsRepository | null = null;

export function getFeatureInterestsRepository(): IFeatureInterestsRepository {
  if (!featureInterestsRepository) {
    featureInterestsRepository = new FirebaseFeatureInterestsRepository(getFirestore());
  }

  return featureInterestsRepository;
}
