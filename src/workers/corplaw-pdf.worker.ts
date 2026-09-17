// Web Worker — gera o PDF Corplaw fora da main thread.
import { pdf } from '@react-pdf/renderer'
import { createElement } from 'react'
import CorplawPDF from '@/components/CorplawPDF'
import type { AnaliseDocumento } from '@/lib/corplaw/types'

interface Msg {
  title: string
  clientName?: string
  createdAt?: string
  analise: AnaliseDocumento
}

self.onmessage = async (event: MessageEvent<Msg>) => {
  try {
    const { title, clientName, createdAt, analise } = event.data
    const doc = createElement(CorplawPDF, { title, clientName, createdAt, analise })
    const blob = await pdf(doc).toBlob()
    const buffer = await blob.arrayBuffer()
    ;(self as unknown as Worker).postMessage({ success: true, buffer }, [buffer])
  } catch (err) {
    ;(self as unknown as Worker).postMessage({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
