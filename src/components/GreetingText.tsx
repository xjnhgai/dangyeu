import { loveIcon } from '../core/love-icons'
const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('vi', { granularity: 'grapheme' }) : null

export default function GreetingText({ text, animatedIcons }: { text: string; animatedIcons: readonly string[] }) {
  const parts = segmenter ? [...segmenter.segment(text)].map((part) => part.segment) : Array.from(text)
  return <span className="greeting-text">{parts.map((part, index) => /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(part)
    ? animatedIcons.includes(part) ? <picture key={index} className="greeting-emoji greeting-gif"><source media="(prefers-reduced-motion: reduce)" srcSet={loveIcon(part).still} /><img src={loveIcon(part).gif} alt={part} /></picture> : <span key={index} className="greeting-emoji">{part}</span>
    : part)}</span>
}
