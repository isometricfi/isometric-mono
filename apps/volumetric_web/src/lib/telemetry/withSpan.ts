import { createWithSpan } from "@volumetric/telemetry";
import { WEB_APP_TRACER_NAME } from "./traceConstants";

export const withSpan = createWithSpan(WEB_APP_TRACER_NAME);
