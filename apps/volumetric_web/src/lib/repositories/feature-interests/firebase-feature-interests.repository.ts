import type { FirestoreClient } from "firebase-rest-firestore";
import { z } from "zod";
import type {
  FeatureInterestStatus,
  FeatureInterestStatusInput,
  FeatureInterestVoteInput,
  IFeatureInterestsRepository,
} from "./feature-interests-repository.interface";

const FEATURE_INTEREST_COLLECTION = "feature_interest_votes";

interface StoredFeatureInterestVote {
  featureKey: string;
  address: string;
  createdAtMs: number;
}

const StoredFeatureInterestVoteSchema = z.object({
  featureKey: z.string(),
  address: z.string(),
  createdAtMs: z.number(),
});

function toStoredFeatureInterestVotes(values: unknown[]): StoredFeatureInterestVote[] {
  return values.flatMap((value) => {
    const parsed = StoredFeatureInterestVoteSchema.safeParse(value);
    return parsed.success ? [parsed.data] : [];
  });
}

function getVoteId(featureKey: string, address: string): string {
  return `${featureKey}:${address}`;
}

export class FirebaseFeatureInterestsRepository implements IFeatureInterestsRepository {
  constructor(private client: FirestoreClient) {}

  async vote(input: FeatureInterestVoteInput): Promise<FeatureInterestStatus> {
    const address = input.address.trim();

    const statusBeforeVote = await this.getStatus({
      featureKey: input.featureKey,
      address,
    });

    if (statusBeforeVote.hasVoted) {
      return statusBeforeVote;
    }

    const voteId = getVoteId(input.featureKey, address);
    const nowMs = Date.now();

    await this.client.collection(FEATURE_INTEREST_COLLECTION).doc(voteId).set({
      featureKey: input.featureKey,
      address,
      createdAtMs: nowMs,
    });

    return {
      featureKey: input.featureKey,
      hasVoted: true,
      totalInterested: statusBeforeVote.totalInterested + 1,
    };
  }

  async getStatus(input: FeatureInterestStatusInput): Promise<FeatureInterestStatus> {
    type WhereClause = { field: string; op: string; value: unknown };

    const allVotesForFeatureResponse = await this.client.query(FEATURE_INTEREST_COLLECTION, {
      where: [{ field: "featureKey", op: "EQUAL", value: input.featureKey }],
    });
    const allVotesForFeature = toStoredFeatureInterestVotes(allVotesForFeatureResponse);

    if (!input.address) {
      return {
        featureKey: input.featureKey,
        hasVoted: false,
        totalInterested: allVotesForFeature.length,
      };
    }

    const address = input.address.trim();
    const hasVotedQuery: WhereClause[] = [
      { field: "featureKey", op: "EQUAL", value: input.featureKey },
      { field: "address", op: "EQUAL", value: address },
    ];

    const votesByAddressResponse = await this.client.query(FEATURE_INTEREST_COLLECTION, {
      where: hasVotedQuery,
      limit: 1,
    });
    const votesByAddress = toStoredFeatureInterestVotes(votesByAddressResponse);

    return {
      featureKey: input.featureKey,
      hasVoted: votesByAddress.length > 0,
      totalInterested: allVotesForFeature.length,
    };
  }
}
