import { ImageResponse } from "next/og";

// Browser tab / Android home-screen icon. Generated from code at request time
// (Satori → PNG) so there are no binary asset files to maintain.
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          // gold → rose: a blend of both themes (billionaire gold + girly rose)
          background: "linear-gradient(135deg, #ECC77F 0%, #E7A6B6 52%, #C98FB8 100%)",
          color: "#2A1E12",
          fontSize: 300,
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
