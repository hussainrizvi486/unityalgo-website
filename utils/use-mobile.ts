import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribe(onStoreChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onStoreChange);
  return () => mql.removeEventListener("change", onStoreChange);
}

/**
 * Whether the viewport is below the mobile breakpoint.
 *
 * A media query is an external store, so useSyncExternalStore is the right
 * primitive: it avoids the setState-in-effect cascade the previous
 * useState + useEffect version caused, and it cannot render a stale value on
 * the first paint. Server rendering has no viewport, so it reports false and
 * the real value arrives on hydration.
 */
export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
