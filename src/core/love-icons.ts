export const ICON_EMOJIS = ['🐻', '🐰', '💖', '🐱', '💏', '💑', '😻', '🐷', '👛', '🧮', '💰', '☕', '💻', '🏡', '🛍️', '📓', '🪴', '📅', '🚀'] as const
const files: Record<string, string> = { '🐻': 'bear', '🐰': 'bunnies', '💖': 'hearts', '🐱': 'corgi-hug', '💏': 'bunny-kiss', '💑': 'couple', '😻': 'heart-cat', '🐷': 'piggy', '👛': 'wallet', '🧮': 'calculator-bear', '💰': 'coin-sprout', '☕': 'coffee', '💻': 'laptop-bunny', '🏡': 'home', '🛍️': 'shopping', '📓': 'notebook', '🪴': 'plant', '📅': 'calendar', '🚀': 'rocket' }
export function loveIcon(emoji: string) {
  return { still: `${import.meta.env.BASE_URL}love/${files[emoji] ?? 'hearts'}.webp` }
}
