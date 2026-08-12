import { pdf } from '@react-pdf/renderer'
import { createElement } from 'react'
import { AnalysePDF } from '@/components/AnalysePDF'
import type { AnalysisAISections } from '@/types'

interface PDFWorkerInput {
  title: string
  clientName?: string
  sections: AnalysisAISections
}

self.onmessage = async (event: MessageEvent<PDFWorkerInput>) => {
  const { title, clientName, sections } = event.data
  try {
    const element = createElement(AnalysePDF, { title, clientName, sections })
    const blob = await pdf(element).toBlob()
    const arrayBuffer = await blob.arrayBuffer()
    // Transfer the buffer (zero-copy) back to the main thread
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scope = self as any
    scope.postMessage({ success: true, buffer: arrayBuffer }, [arrayBuffer])
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scope = self as any
    scope.postMessage({ success: false, error: String(error) })
  }
}
