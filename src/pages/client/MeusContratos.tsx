import { FileText, Upload } from 'lucide-react'

export default function MeusContratos() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-navy-900">Meus Contratos</h1>
          <p className="text-slate-500 text-sm mt-1">Gerencie todos os contratos do seu workspace.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-dark transition-colors">
          <Upload className="w-4 h-4" />
          Novo Contrato
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-navy-800 mb-2">Nenhum contrato ainda</h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Faça upload do seu primeiro contrato em PDF para começar a gerenciar suas obrigações e prazos.
        </p>
      </div>
    </div>
  )
}
