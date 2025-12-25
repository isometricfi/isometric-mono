import type { CreateOfferResponse } from "@volumetric/canister-types";
import type { Output } from "./schema";

export function mapResult(data: CreateOfferResponse): Output {
  return {
    offerId: data.offer.id.toString(),
  };
}
