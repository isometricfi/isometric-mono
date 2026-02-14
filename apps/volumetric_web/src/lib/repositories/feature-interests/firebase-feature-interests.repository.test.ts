import type { FirestoreClient } from "firebase-rest-firestore";
import { describe, expect, test } from "vitest";
import { FirebaseFeatureInterestsRepository } from "./firebase-feature-interests.repository";

const FEATURE_KEY = "put_options";
const FIRST_ADDRESS = "bc1qfirstaddress";
const SECOND_ADDRESS = "bc1qsecondaddress";
const FEATURE_INTEREST_COLLECTION = "feature_interest_votes";

interface StoredVote {
  featureKey: string;
  address: string;
  createdAtMs: number;
}

type QueryOptions = {
  where?: Array<{ field: string; op: string; value: unknown }>;
  limit?: number;
};

function makeMockFirestoreClient() {
  const votes = new Map<string, StoredVote>();

  const client = {
    collection: (collectionName: string) => ({
      doc: (id: string) => ({
        set: async (data: StoredVote) => {
          if (collectionName !== FEATURE_INTEREST_COLLECTION) {
            throw new Error("Unexpected collection");
          }

          votes.set(id, data);
        },
      }),
    }),
    query: async (collectionName: string, options?: QueryOptions) => {
      if (collectionName !== FEATURE_INTEREST_COLLECTION) {
        throw new Error("Unexpected collection");
      }

      const where = options?.where ?? [];
      const filtered = Array.from(votes.values()).filter((vote) =>
        where.every((clause) => {
          if (clause.op !== "EQUAL") {
            throw new Error("Only EQUAL supported in mock");
          }

          if (clause.field === "featureKey") {
            return vote.featureKey === clause.value;
          }

          if (clause.field === "address") {
            return vote.address === clause.value;
          }

          return false;
        }),
      );

      if (typeof options?.limit === "number") {
        return filtered.slice(0, options.limit);
      }

      return filtered;
    },
  } as unknown as FirestoreClient;

  return { client, votes };
}

describe("FirebaseFeatureInterestsRepository", () => {
  test("should increment count for first vote from an address", async () => {
    // given
    const { client } = makeMockFirestoreClient();
    const repository = new FirebaseFeatureInterestsRepository(client);

    // when
    const result = await repository.vote({
      featureKey: FEATURE_KEY,
      address: FIRST_ADDRESS,
    });

    // then
    expect(result.hasVoted).toBe(true);
    expect(result.totalInterested).toBe(1);
  });

  test("should not increment count when the same address votes twice", async () => {
    // given
    const { client } = makeMockFirestoreClient();
    const repository = new FirebaseFeatureInterestsRepository(client);

    await repository.vote({
      featureKey: FEATURE_KEY,
      address: FIRST_ADDRESS,
    });

    // when
    const result = await repository.vote({
      featureKey: FEATURE_KEY,
      address: FIRST_ADDRESS,
    });

    // then
    expect(result.hasVoted).toBe(true);
    expect(result.totalInterested).toBe(1);
  });

  test("should increment count when different addresses vote", async () => {
    // given
    const { client } = makeMockFirestoreClient();
    const repository = new FirebaseFeatureInterestsRepository(client);

    await repository.vote({
      featureKey: FEATURE_KEY,
      address: FIRST_ADDRESS,
    });

    // when
    const result = await repository.vote({
      featureKey: FEATURE_KEY,
      address: SECOND_ADDRESS,
    });

    // then
    expect(result.hasVoted).toBe(true);
    expect(result.totalInterested).toBe(2);
  });
});
