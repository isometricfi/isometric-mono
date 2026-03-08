import { type EnvRecord, getOptionalEnv, getRequiredEnv } from "./env";
import { parseOtlpHeaders } from "./parseOtlpHeaders";

export function createOtlpTraceConfig(env: EnvRecord, defaultServiceName: string) {
  const tracesEndpoint = getRequiredEnv(env, "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT");

  return {
    exporter: {
      url: tracesEndpoint,
      headers: parseOtlpHeaders(getOptionalEnv(env, "OTEL_EXPORTER_OTLP_HEADERS")),
    },
    service: {
      name: getOptionalEnv(env, "OTEL_SERVICE_NAME") ?? defaultServiceName,
    },
  };
}
