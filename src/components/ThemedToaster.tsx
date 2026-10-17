"use client";

import { useSyncExternalStore } from "react";
import { Toaster } from "sonner";
import { getServerTheme, getTheme, subscribeTheme } from "@/lib/theme";

/** Toasts que siguen el tema activo de la central */
export default function ThemedToaster() {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, getServerTheme);
  return <Toaster position="top-right" theme={theme} duration={4200} />;
}
