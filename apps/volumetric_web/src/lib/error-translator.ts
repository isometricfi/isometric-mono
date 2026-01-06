import { type CanisterError, ErrorCode, getErrorMessage } from "@volumetric/canister-types";
import { getTranslations } from "next-intl/server";

const errorCodeToTranslationKey: Record<number, string> = {
  [ErrorCode.UNAUTHORIZED_CONTROLLER]: "unauthorizedController",
  [ErrorCode.UNAUTHORIZED_WHITELISTED]: "unauthorizedWhitelisted",
  [ErrorCode.INVALID_SIGNATURE]: "invalidSignature",
  [ErrorCode.PROFILE_NOT_FOUND]: "profileNotFound",
  [ErrorCode.PROFILE_ALREADY_REGISTERED]: "profileAlreadyRegistered",
  [ErrorCode.INTER_CANISTER_CALL_FAILED]: "interCanisterCallFailed",
  [ErrorCode.CONFIG_ERROR]: "configError",
  [ErrorCode.INSUFFICIENT_BALANCE]: "insufficientBalance",
  [ErrorCode.OFFER_NOT_FOUND]: "offerNotFound",
  [ErrorCode.OFFER_EXPIRED]: "offerExpired",
  [ErrorCode.OFFER_CANCELLED]: "offerCancelled",
  [ErrorCode.OFFER_FILLED]: "offerFilled",
  [ErrorCode.QUANTITY_BELOW_MINIMUM]: "quantityBelowMinimum",
  [ErrorCode.QUANTITY_EXCEEDS_AVAILABLE]: "quantityExceedsAvailable",
  [ErrorCode.NOT_OFFER_OWNER]: "notOfferOwner",
  [ErrorCode.OPTION_NOT_FOUND]: "optionNotFound",
  [ErrorCode.OPTION_NOT_EXPIRED]: "optionNotExpired",
  [ErrorCode.OPTION_ALREADY_SETTLED]: "optionAlreadySettled",
  [ErrorCode.CANNOT_ACCEPT_OWN_OFFER]: "cannotAcceptOwnOffer",
  [ErrorCode.OFFER_PROCESSING]: "offerProcessing",
  [ErrorCode.OPTION_SETTLING]: "optionSettling",
  [ErrorCode.PARTIAL_FILLING_DISABLED]: "partialFillingDisabled",
  [ErrorCode.STITCHING_DISABLED]: "stitchingDisabled",
  [ErrorCode.OFFER_LIMIT_EXCEEDED]: "offerLimitExceeded",
  [ErrorCode.INTERNAL_ERROR]: "internalError",
};

export async function translateCanisterError(err: CanisterError | Error): Promise<string> {
  if (!(err instanceof Error && "code" in err)) {
    return err.message || "An unexpected error occurred";
  }

  const canisterError = err as CanisterError;
  const baseMessage = getErrorMessage(canisterError);
  const errorCode = canisterError.code as ErrorCode;
  const translationKey = errorCodeToTranslationKey[errorCode];

  if (!translationKey) {
    return baseMessage;
  }

  try {
    const t = await getTranslations("Errors");
    const translated = t(translationKey);
    if (canisterError.message && canisterError.message !== baseMessage) {
      return `${translated}: ${canisterError.message}`;
    }
    return translated;
  } catch {
    return baseMessage;
  }
}
