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
 * Convenience over a live canvas element.
 * @param {number} clientX
 * @param {number} clientY
 * @param {{ getBoundingClientRect(): DOMRect, width: number, height: number }} canvas
 */
export function clientToCanvasEl(clientX, clientY, canvas) {
  return clientToCanvas(clientX, clientY, canvas.getBoundingClientRect(), canvas.width, canvas.height);
}
