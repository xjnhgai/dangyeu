export const MIN_PAPER_ZOOM = 1
export const MAX_PAPER_ZOOM = 3

export function clampPaperZoom(value: number): number {
  return Math.max(MIN_PAPER_ZOOM, Math.min(MAX_PAPER_ZOOM, Number.isFinite(value) ? value : MIN_PAPER_ZOOM))
}
