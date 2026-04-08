import { type EnvRecord, getOptionalEnv } from "./env";
import { parseOtlpHeaders } from "./parseOtlpHeaders";

export function createOtlpTraceConfig(env: EnvRecord, defaultServiceName: string) {
  const tracesEndpoint = getOptionalEnv(env, "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT");

  if (!tracesEndpoint) {
    return {
      service: {
        name: getOptionalEnv(env, "OTEL_SERVICE_NAME") ?? defaultServiceName,
      },
      spanProcessors: [],
    };
  }

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
