// Renderizador mínimo de markdown pras bolhas do assistente.
// Monta elementos React (sem dangerouslySetInnerHTML). Não suporta _itálico_
// de propósito — os campos da análise têm underscore.

import { Fragment } from 'react'

type Node = string | { tag: 'strong' | 'em' | 'code'; children: string }

function parseInline(text: string): Node[] {
  const out: Node[] = []
  let i = 0
  while (i < text.length) {
    // **bold**
    const bold = text.indexOf('**', i)
    // `code`
    const code = text.indexOf('`', i)
    // *italic* (asterisk only, não underscore)
    const ital = text.indexOf('*', i)

    const positions = [
      { pos: bold, len: 2, tag: 'strong' as const, marker: '**' },
      { pos: code, len: 1, tag: 'code' as const, marker: '`' },
      { pos: ital !== bold ? ital : -1, len: 1, tag: 'em' as const, marker: '*' },
    ].filter(p => p.pos >= 0 && (p.tag !== 'em' || (p.pos !== bold && p.pos !== bold + 1)))
     .sort((a, b) => a.pos - b.pos)

    if (positions.length === 0) { out.push(text.slice(i)); break }
    const { pos, len, tag, marker } = positions[0]
    if (pos > i) out.push(text.slice(i, pos))
    const closeIdx = text.indexOf(marker, pos + len)
    if (closeIdx === -1) { out.push(text.slice(i)); break }
    out.push({ tag, children: text.slice(pos + len, closeIdx) })
    i = closeIdx + len
  }
  return out
}

function renderInline(text: string) {
  return parseInline(text).map((n, i) => {
    if (typeof n === 'string') return <Fragment key={i}>{n}</Fragment>
    if (n.tag === 'strong') return <strong key={i}>{n.children}</strong>
    if (n.tag === 'em') return <em key={i}>{n.children}</em>
    if (n.tag === 'code') return <code key={i} className="bg-slate-100 rounded px-1 py-0.5 text-xs font-mono">{n.children}</code>
    return null
  })
}

export function Markdown({ text }: { text: string }) {
  const lines = text.split('\n')
  const blocks: React.ReactNode[] = []
  let listBuf: string[] = []
  let listType: 'ul' | 'ol' | null = null

  const flushList = () => {
    if (listBuf.length === 0) return
    const Tag = listType === 'ol' ? 'ol' : 'ul'
    blocks.push(
      <Tag key={blocks.length} className={Tag === 'ol' ? 'list-decimal list-inside space-y-1 my-2' : 'list-disc list-inside space-y-1 my-2'}>
        {listBuf.map((item, i) => <li key={i}>{renderInline(item)}</li>)}
      </Tag>
    )
    listBuf = []
    listType = null
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line.trim()) { flushList(); continue }

    // headings
    const h = /^(#{1,4})\s+(.+)/.exec(line)
    if (h) {
      flushList()
      const level = h[1].length
      const content = renderInline(h[2])
      if (level === 1) blocks.push(<h3 key={blocks.length} className="font-semibold text-base mt-2 mb-1">{content}</h3>)
      else if (level === 2) blocks.push(<h4 key={blocks.length} className="font-semibold text-sm mt-2 mb-1">{content}</h4>)
      else blocks.push(<p key={blocks.length} className="font-semibold text-sm mt-2 mb-1">{content}</p>)
      continue
    }
    // ol
    const ol = /^(\d+)\.\s+(.+)/.exec(line)
    if (ol) {
      if (listType && listType !== 'ol') flushList()
      listType = 'ol'
      listBuf.push(ol[2])
      continue
    }
    // ul
    const ul = /^[-*]\s+(.+)/.exec(line)
    if (ul) {
      if (listType && listType !== 'ul') flushList()
      listType = 'ul'
      listBuf.push(ul[1])
      continue
    }
    // paragraph
    flushList()
    blocks.push(<p key={blocks.length} className="my-1">{renderInline(line)}</p>)
  }
  flushList()

  return <div className="text-sm leading-relaxed">{blocks}</div>
}
