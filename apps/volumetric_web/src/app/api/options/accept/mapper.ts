import type { AcceptOffersResponse as CanisterResponse } from "@volumetric/canister-types";
import type { AcceptOffersResponse } from "./types";

export const mapAcceptOffers = (data: CanisterResponse): AcceptOffersResponse => ({
  fillGroupId: data.fill_group_id.toString(),
  activeOptionIds: data.active_options.map((o) => o.id.toString()),
});
