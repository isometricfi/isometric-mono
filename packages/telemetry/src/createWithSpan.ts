import { type Attributes, type Span, SpanStatusCode, trace } from "@opentelemetry/api";

import { getErrorMessage } from "./_internal/getErrorMessage";

type SpanCallback<T> = (span: Span) => Promise<T> | T;

export interface WithSpan {
  <T>(name: string, fn: SpanCallback<T>): Promise<T>;
  <T>(name: string, attributes: Attributes, fn: SpanCallback<T>): Promise<T>;
}

export function createWithSpan(tracerName: string): WithSpan {
  const tracer = trace.getTracer(tracerName);

  async function withSpan<T>(
    name: string,
    attributesOrFn: Attributes | SpanCallback<T>,
    fn?: SpanCallback<T>,
  ): Promise<T> {
    const attributes = typeof attributesOrFn === "function" ? undefined : attributesOrFn;
    const spanCallback = typeof attributesOrFn === "function" ? attributesOrFn : fn;

    if (!spanCallback) {
      throw new Error("withSpan requires a callback");
    }

    return tracer.startActiveSpan(name, async (span) => {
      if (attributes) {
        span.setAttributes(attributes);
      }

      try {
        return await spanCallback(span);
      } catch (error) {
        const message = getErrorMessage(error);

        span.recordException(error instanceof Error ? error : new Error(message));
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message,
        });

        throw error;
      } finally {
        span.end();
      }
    });
  }

  return withSpan;
}
