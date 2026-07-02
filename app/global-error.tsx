"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary for errors thrown by the ROOT layout itself. It replaces
 * the whole document, so it must render its own <html>/<body> and can't rely on
 * global CSS — hence inline styles.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global error boundary]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#0A0E1A",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          padding: 24,
          textAlign: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: "#FF4E00",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 25px rgba(255,78,0,0.5)",
            fontSize: 28,
          }}
        >
          🔥
        </div>
        <h1 style={{ fontSize: 18, fontWeight: 900, fontStyle: "italic", textTransform: "uppercase", margin: 0 }}>
          Something went sideways
        </h1>
        <p style={{ fontSize: 13, color: "#8E9299", maxWidth: 320, lineHeight: 1.5, margin: 0 }}>
          A hiccup on our end. Your streak and picks are safe — give it another go.
        </p>
        <button
          onClick={reset}
          style={{
            background: "#FF4E00",
            color: "#fff",
            fontWeight: 900,
            fontStyle: "italic",
            fontSize: 13,
            padding: "10px 20px",
            borderRadius: 12,
            border: "none",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
