import { getFeatureInterestsRepository } from "@/lib/repositories/feature-interests/get-feature-interests-repository";
import type { Input, Output } from "./schema";

export async function voteFeatureInterest(input: Input): Promise<Output> {
  const repository = getFeatureInterestsRepository();
  return repository.vote(input);
}
