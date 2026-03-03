import { createAppTelemetry } from "@volumetric/telemetry";

const botTelemetry = createAppTelemetry({
  serviceInstanceId: "volumetric-bot",
  methodNamespacePrefix: "bot",
});

export const initBotTelemetry = botTelemetry.ensureInitialized;
export const botLog = botTelemetry.log;
export const withBotSpan = botTelemetry.withSpan;
export const shutdownBotTelemetry = botTelemetry.shutdown;
