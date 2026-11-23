import Image from "next/image";
import type { ReactNode } from "react";
import { getArt, type ArtSlot } from "@/data/art-manifest";

interface ArtProps {
  slot: ArtSlot;
  /** Rendered when the manifest has no asset for the slot (the default: no art ships). */
  fallback: ReactNode;
  /** Forwarded to `next/image` for responsive sizing. */
  sizes?: string;
}

/** The only way UI renders imagery: resolves the slot through the art manifest. */
export function Art({ slot, fallback, sizes }: ArtProps) {
  const asset = getArt(slot);
  if (!asset) return <>{fallback}</>;
  return <Image src={asset.src} alt={asset.alt} width={asset.width} height={asset.height} sizes={sizes} />;
}
