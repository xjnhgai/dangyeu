import { loveIcon } from '../core/love-icons'
const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('vi', { granularity: 'grapheme' }) : null

export default function GreetingText({ text, illustratedIcons }: { text: string; illustratedIcons: readonly string[] }) {
  const parts = segmenter ? [...segmenter.segment(text)].map((part) => part.segment) : Array.from(text)
  return <span className="greeting-text">{parts.map((part, index) => /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(part)
    ? illustratedIcons.includes(part) ? <span key={index} className="greeting-emoji greeting-sticker"><img src={loveIcon(part).still} alt={part} /></span> : <span key={index} className="greeting-emoji">{part}</span>
    : part)}</span>
}
