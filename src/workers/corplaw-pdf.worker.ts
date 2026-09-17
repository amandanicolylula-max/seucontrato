// Web Worker — gera o PDF Corplaw fora da main thread.
// Estratégia com fallback: tenta com timbrado; se falhar (bug conhecido
// do @react-pdf/renderer com data URIs de imagens grandes em Worker),
// tenta de novo SEM a imagem e ainda entrega o PDF.
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

async function render(props: Msg, withImage: boolean): Promise<ArrayBuffer> {
  const doc = createElement(CorplawPDF, { ...props, withImage })
  const blob = await pdf(doc).toBlob()
  return await blob.arrayBuffer()
}

self.onmessage = async (event: MessageEvent<Msg>) => {
  const props = event.data
  let firstError = ''
  try {
    const buffer = await render(props, true)
    ;(self as unknown as Worker).postMessage({ success: true, buffer, degraded: false }, [buffer])
    return
  } catch (err) {
    firstError = err instanceof Error ? (err.stack || err.message) : String(err)
    console.error('[corplaw-pdf.worker] falhou com timbrado, tentando sem:', firstError)
  }
  // Fallback: sem timbrado
  try {
    const buffer = await render(props, false)
    ;(self as unknown as Worker).postMessage({
      success: true,
      buffer,
      degraded: true,
      firstError: firstError.slice(0, 500),
    }, [buffer])
  } catch (err) {
    const secondError = err instanceof Error ? (err.stack || err.message) : String(err)
    ;(self as unknown as Worker).postMessage({
      success: false,
      error: `Com timbrado: ${firstError.slice(0, 300)} | Sem timbrado: ${secondError.slice(0, 300)}`,
    })
  }
}
