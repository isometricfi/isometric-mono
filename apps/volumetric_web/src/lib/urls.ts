export function appUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  if (!base) {
    return path;
  }
  return `${base}${path}`;
}

export function marketingUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  if (!base) {
    return path;
  }
  return `${base}${path}`;
}
