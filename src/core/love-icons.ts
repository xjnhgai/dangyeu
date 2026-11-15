export function loveIcon(emoji: string) {
  const name = emoji === '🐻' ? 'bear' : emoji === '🐰' ? 'bunnies' : 'hearts'
  const base = `${import.meta.env.BASE_URL}love/${name}`
  return { gif: `${base}.gif`, still: `${base}.png` }
}
