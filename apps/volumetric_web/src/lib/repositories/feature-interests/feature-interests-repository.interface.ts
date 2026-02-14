import type { FeatureKey } from "@/lib/use-cases/feature-interests/feature-keys";

export interface FeatureInterestStatus {
  featureKey: FeatureKey;
  hasVoted: boolean;
  totalInterested: number;
}

export interface FeatureInterestVoteInput {
  featureKey: FeatureKey;
  address: string;
}

export interface FeatureInterestStatusInput {
  featureKey: FeatureKey;
  address?: string;
}

export interface IFeatureInterestsRepository {
  vote(input: FeatureInterestVoteInput): Promise<FeatureInterestStatus>;
  getStatus(input: FeatureInterestStatusInput): Promise<FeatureInterestStatus>;
}
