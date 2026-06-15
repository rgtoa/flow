import { ImageResponse } from "next/og";
import { FlowIconArt } from "@/lib/icon-art";

// iOS "Add to Home Screen" icon. iOS applies its own rounded-rect mask, so we
// render a full-bleed square. 180×180 is the size iOS reads for the home screen.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<FlowIconArt size={180} />, { ...size });
}
