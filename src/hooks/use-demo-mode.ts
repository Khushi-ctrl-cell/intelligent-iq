import { useMemo } from "react";

/**
 * Detects demo mode via `?demo=true` URL parameter.
 * Demo mode provides read-only admin access without real authentication.
 */
export function useDemoMode(): boolean {
  return useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("demo") === "true";
  }, []);
}

/** Non-hook version for use outside React components */
export function isDemoMode(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get("demo") === "true";
}
