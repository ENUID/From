"use client";

import { ReactNode } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";

// Normalize the deployment URL so a common misconfig doesn't silently break the
// WebSocket client (which would leave mutations hanging forever): strip trailing
// slashes and coerce a .convex.site URL (HTTP actions domain) to the
// .convex.cloud deployment URL the React client requires.
function convexUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_CONVEX_URL || "").trim().replace(/\/+$/, "");
  if (!raw) return "https://placeholder.convex.cloud";
  return raw.replace(/\.convex\.site$/, ".convex.cloud");
}

const convex = new ConvexReactClient(convexUrl());

export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
