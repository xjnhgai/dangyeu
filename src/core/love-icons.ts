export const LOVE_ICON_EMOJIS = ['🐻', '🐰', '💖', '🐱', '💏', '💑', '😻'] as const
const files: Record<string, string> = { '🐻': 'bear', '🐰': 'bunnies', '💖': 'hearts', '🐱': 'corgi-hug', '💏': 'bunny-kiss', '💑': 'couple', '😻': 'heart-cat' }
export function loveIcon(emoji: string) {
  const base = `${import.meta.env.BASE_URL}love/${files[emoji] ?? 'hearts'}`
  return { gif: `${base}.gif`, still: `${base}.png` }
}
