import type { BrandLogoId } from "@/types/orion";
import { ZettaLogo } from "./ZettaLogo";
export function BrandMark({ className = "size-9", tone = "light" }: { logoId?: BrandLogoId; tone?: "light" | "dark"; className?: string }) { return <ZettaLogo variant="icon" className={className} tone={tone} />; }
export function BrandLogo({ tone = "light" }: { logoId?: BrandLogoId; tone?: "light" | "default" }) { return <ZettaLogo tone={tone === "light" ? "light" : "dark"} />; }
