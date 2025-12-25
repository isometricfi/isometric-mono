import type { CreateOfferResponse as CanisterResponse } from "@volumetric/canister-types";
import type { CreateOfferResponse } from "./types";

export const mapCreateOffer = (data: CanisterResponse): CreateOfferResponse => ({
  offerId: data.offer.id.toString(),
});
