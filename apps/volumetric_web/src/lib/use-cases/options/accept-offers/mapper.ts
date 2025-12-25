import type { AcceptOffersResponse } from "@volumetric/canister-types";
import type { Output } from "./schema";

export function mapResult(data: AcceptOffersResponse): Output {
  return {
    fillGroupId: data.fill_group_id.toString(),
    activeOptionIds: data.active_options.map((o) => o.id.toString()),
  };
}
