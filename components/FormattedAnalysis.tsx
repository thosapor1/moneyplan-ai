'use client'

/**
 * Renders markdown-like text (## headers, - bullets, paragraphs) as formatted JSX.
 * Used for AI-generated analysis and advice.
 */
export default function FormattedAnalysis({ text }: { text: string }) {
  const lines = text.split('\n')
  const nodes: React.ReactNode[] = []
  let i = 0
  let key = 0
  while (i < lines.length) {
    const trimmed = lines[i].trim()
    if (trimmed.startsWith('## ')) {
      nodes.push(
        <h3 key={key++} className="text-sm font-semibold text-gray-800 mt-3 first:mt-0 mb-1">
          {trimmed.slice(3).trim()}
        </h3>
      )
      i += 1
      continue
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const items: string[] = []
      while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))) {
        items.push(lines[i].trim().slice(2).trim())
        i += 1
      }
      nodes.push(
        <ul key={key++} className="list-disc list-inside space-y-0.5 my-1.5 text-sm text-gray-700 leading-relaxed pl-1">
          {items.map((item, j) => (
            <li key={j}>{item}</li>
          ))}
        </ul>
      )
      continue
    }
    if (trimmed === '') {
      i += 1
      continue
    }
    const paragraphLines: string[] = []
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].trim().startsWith('## ') && !lines[i].trim().startsWith('- ') && !lines[i].trim().startsWith('* ')) {
      paragraphLines.push(lines[i])
      i += 1
    }
    if (paragraphLines.length > 0) {
      nodes.push(
        <p key={key++} className="text-sm text-gray-700 leading-relaxed my-1.5">
          {paragraphLines.map((ln, j) => (
            <span key={j}>
              {ln.trim()}
              {j < paragraphLines.length - 1 && <br />}
            </span>
          ))}
        </p>
      )
    }
  }
  return <div className="space-y-0 text-sm text-gray-700">{nodes}</div>
}
