/**
 * src/engine/pointer.js — one mapping from pointer (client CSS px) to canvas
 * backing-store px, shared by mouse aim, touch aim and end-card clicks.
 *
 * The canvas backing store is CSS size × devicePixelRatio (render.js
 * resizeToDisplay), so CSS-pixel pointer coordinates must be scaled by
 * canvas.width / rect.width before camera.screenToWorld(), which works in
 * canvas px. Pure; no DOM needed (pass the rect and sizes in).
 */

/**
 * @param {number} clientX  Pointer clientX (CSS px, viewport-relative).
 * @param {number} clientY  Pointer clientY.
 * @param {{ left: number, top: number, width: number, height: number }} rect  canvas.getBoundingClientRect()
 * @param {number} canvasW  canvas.width (device px)
 * @param {number} canvasH  canvas.height (device px)
 * @returns {{ x: number, y: number }} canvas px
 */
export function clientToCanvas(clientX, clientY, rect, canvasW, canvasH) {
  const sx = rect.width  > 0 ? canvasW / rect.width  : 1;
  const sy = rect.height > 0 ? canvasH / rect.height : 1;
  return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy };
}

/**
 * Convenience over a live canvas element (untransformed / native landscape).
 * @param {number} clientX
 * @param {number} clientY
 * @param {{ getBoundingClientRect(): DOMRect, width: number, height: number }} canvas
 */
export function clientToCanvasEl(clientX, clientY, canvas) {
  return clientToCanvas(clientX, clientY, canvas.getBoundingClientRect(), canvas.width, canvas.height);
}

/**
 * Map logical CSS px (origin top-left of the canvas layout box) into canvas
 * backing-store px. Use this when the canvas sits inside a CSS-transformed
 * shell: getBoundingClientRect() returns the post-transform AABB and is wrong.
 *
 * @param {number} localX  CSS px in the canvas layout box (0 = left edge).
 * @param {number} localY  CSS px in the canvas layout box (0 = top edge).
 * @param {{ clientWidth?: number, clientHeight?: number, width: number, height: number }} canvas
 */
export function clientToCanvasLayout(localX, localY, canvas) {
  const cssW = canvas.clientWidth || canvas.width || 0;
  const cssH = canvas.clientHeight || canvas.height || 0;
  return clientToCanvas(localX, localY, { left: 0, top: 0, width: cssW, height: cssH }, canvas.width, canvas.height);
}
