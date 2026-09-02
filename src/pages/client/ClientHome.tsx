import { FileText, FileScan, Users, CreditCard } from 'lucide-react'

const summaryCards = [
  { label: 'Contratos', value: 0, icon: FileText, color: 'bg-navy-900 text-white' },
  { label: 'Análises', value: 0, icon: FileScan, color: 'bg-accent text-white' },
  { label: 'Equipe', value: 1, icon: Users, color: 'bg-navy-700 text-white' },
  { label: 'Créditos', value: 0, icon: CreditCard, color: 'bg-navy-800 text-white' },
]

export default function ClientHome() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-navy-900">Bem-vindo ao Seu Contrato</h1>
        <p className="text-slate-500 text-sm mt-1">Gerencie seus contratos e solicite serviços jurídicos.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className={`rounded-2xl p-5 ${color} shadow-sm`}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center">
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            <p className="text-sm opacity-70 mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-navy-800 mb-2">Comece adicionando seus contratos</h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Faça upload dos seus contratos em PDF para ter uma visão completa das suas obrigações, prazos e oportunidades.
        </p>
      </div>
    </div>
  )
}
