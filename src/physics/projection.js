/*
 * Perspective projection for the lake.
 *
 * A pinhole camera sits on the shoreline looking straight down +z at a height
 * of `camHeight`. The water plane's vanishing line is the horizon, so anything
 * at y = 0 converges on it as z grows, and anything at height y rises above it.
 * That is all the 2.5D this game needs, and it keeps pointer-to-world maths a
 * pure function of the throw parameters rather than of the rendered sprite.
 */

export const CAMERA = {
  width: 640,
  height: 940,
  horizonY: 256,
  focal: 1176,
  zNear: 4.8,
  camHeight: 3.2,
}

/** Screen-space size floor so a far stone stays visible and tappable. */
export const MIN_VISUAL = 0.34
export const MAX_VISUAL = 1.7

export function project(point, camera = CAMERA) {
  const depth = Math.max(0.5, (point.z ?? 0) + camera.zNear)
  const scale = camera.focal / depth
  return {
    x: camera.width / 2 + (point.x ?? 0) * scale,
    y: camera.horizonY + (camera.camHeight - (point.y ?? 0)) * scale,
    scale,
    depth,
    visual: Math.min(MAX_VISUAL, Math.max(MIN_VISUAL, scale / 120)),
  }
}

/** Screen point -> the water-plane world point under it (y = 0). */
export function unprojectToWater(screen, camera = CAMERA) {
  const belowHorizon = screen.y - camera.horizonY
  if (belowHorizon <= 0.5) return null
  // y - horizonY = camHeight * scale, so the scale inverts cleanly.
  const scale = belowHorizon / camera.camHeight
  const depth = camera.focal / Math.max(scale, 1e-6)
  return {
    x: (screen.x - camera.width / 2) / scale,
    z: depth - camera.zNear,
    scale,
  }
}

/** Widest lateral offset that still lands on screen at a given distance. */
export function laneWidthAt(z, camera = CAMERA) {
  const { scale } = project({ x: 0, y: 0, z }, camera)
  return (camera.width / 2 - 24) / scale
}
