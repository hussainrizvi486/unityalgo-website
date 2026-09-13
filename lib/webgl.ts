/**
 * Whether this browser can give us a WebGL context.
 *
 * Its own module, deliberately: the hero has to decide whether to load the 3D
 * scene *before* importing it, and importing this check from the scene's file
 * would pull three.js into the bundle to answer the question — which is the
 * cost the check exists to avoid.
 *
 * three.js throws `Error creating WebGL context` outright when it cannot get
 * one — a locked-down browser, a blocklisted driver, a VM without
 * acceleration. That throw happens inside renderer construction, not React's
 * render phase, so an error boundary never sees it; the only reliable guard is
 * to not mount the canvas at all.
 */
export function detectWebGL() {
    if (typeof document === 'undefined') return false;
    try {
        const canvas = document.createElement('canvas');
        return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
    } catch {
        return false;
    }
}
