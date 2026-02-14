import { getFeatureInterestsRepository } from "@/lib/repositories/feature-interests/get-feature-interests-repository";
import type { Input, Output } from "./schema";

export async function getFeatureInterestStatus(input: Input): Promise<Output> {
  const repository = getFeatureInterestsRepository();
  return repository.getStatus(input);
}
