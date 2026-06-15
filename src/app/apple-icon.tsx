import { ImageResponse } from "next/og";

// iOS "Add to Home Screen" icon. iOS applies its own rounded-rect mask, so we
// render a full-bleed square. 180×180 is the size iOS reads for the home screen.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #ECC77F 0%, #E7A6B6 52%, #C98FB8 100%)",
          color: "#2A1E12",
          fontSize: 106,
          fontWeight: 700,
          letterSpacing: "-0.04em",
        }}
      >
        F
      </div>
    ),
    { ...size }
  );
}
