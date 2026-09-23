/**
 * Tiny WebGL capability probe for the section entry scripts. Deliberately has NO
 * imports: stage.ts pulls in all of three, and importing from it here would make
 * Three.js a static dependency of the hero / car entry chunks.
 *
 * The probe context is released straight away (WEBGL_lose_context) and the result
 * is cached, so the page never holds a throwaway context next to a real renderer.
 */
let cached: boolean | undefined;

export function webglAvailable(): boolean {
  if (cached !== undefined) return cached;
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext | null;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    cached = Boolean(gl);
  } catch {
    cached = false;
  }
  return cached;
}
