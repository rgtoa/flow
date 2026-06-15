import { ImageResponse } from "next/og";
import { FlowIconArt } from "@/lib/icon-art";

// Browser tab / Android home-screen icon. Generated from code at request time
// (Satori → PNG) so there are no binary asset files to maintain.
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<FlowIconArt size={512} />, { ...size });
}
