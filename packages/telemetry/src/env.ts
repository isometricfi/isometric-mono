export type EnvRecord = Record<string, unknown>;
export type EnvValue = string | undefined;

export function getOptionalEnv(env: EnvRecord, key: string): EnvValue {
  const bindingValue = env[key];

  if (typeof bindingValue === "string") {
    const trimmedBindingValue = bindingValue.trim();

    if (trimmedBindingValue) {
      return trimmedBindingValue;
    }
  }

  const processValue = process.env[key];

  if (!processValue) {
    return undefined;
  }

  const trimmedProcessValue = processValue.trim();
  return trimmedProcessValue || undefined;
}

export function getRequiredEnv(env: EnvRecord, key: string): string {
  const value = getOptionalEnv(env, key);

  if (!value) {
    throw new Error(`${key} environment variable is required for tracing`);
  }

  return value;
}
