import Image from "next/image";
import type { ComponentProps } from "react";

interface AvatarProps extends Omit<ComponentProps<typeof Image>, "src" | "alt" | "unoptimized"> {
  seed: string;
  alt?: string;
}

export function Avatar({ seed, alt = "Avatar", ...props }: AvatarProps) {
  const src = `/api/avatar?name=${encodeURIComponent(seed)}`;

  return <Image src={src} alt={alt} unoptimized {...props} />;
}
