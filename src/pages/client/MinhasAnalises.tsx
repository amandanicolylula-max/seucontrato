import { FileScan } from 'lucide-react'

export default function MinhasAnalises() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-navy-900">Minhas Análises</h1>
        <p className="text-slate-500 text-sm mt-1">Acompanhe as análises contratuais solicitadas.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
        <FileScan className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-navy-800 mb-2">Nenhuma análise solicitada</h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Solicite uma análise contratual a partir de um dos seus contratos. Nossa equipe jurídica irá validar e liberar o parecer.
        </p>
      </div>
    </div>
  )
}
