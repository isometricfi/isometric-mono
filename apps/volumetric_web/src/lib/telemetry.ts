import { createAppTelemetry } from "@volumetric/telemetry";

const webTelemetry = createAppTelemetry({
  serviceInstanceId: "volumetric-web",
  methodNamespacePrefix: "web.backend",
});

export const ensureWebTelemetryInitialized = webTelemetry.ensureInitialized;
export const withWebSpan = webTelemetry.withSpan;
export const webLog = webTelemetry.log;
export const shutdownWebTelemetry = webTelemetry.shutdown;
export const withWebSpanWrappedMethods = webTelemetry.withSpanWrappedMethods;
