const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('vi', { granularity: 'grapheme' }) : null

export default function GreetingText({ text, animatedIcons }: { text: string; animatedIcons: readonly string[] }) {
  const parts = segmenter ? [...segmenter.segment(text)].map((part) => part.segment) : Array.from(text)
  return <span className="greeting-text">{parts.map((part, index) => /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(part)
    ? <span key={index} className={`greeting-emoji${animatedIcons.includes(part) ? ' is-animated' : ''}`} style={{ animationDelay: `${(index % 5) * -0.3}s` }}>{part}</span>
    : part)}</span>
}
