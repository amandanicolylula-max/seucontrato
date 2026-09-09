export type InternalRole = 'socio' | 'advogado' | 'assistente'
export type ClientRole = 'cliente_owner' | 'cliente_member'
export type UserRole = InternalRole | ClientRole

export type PlanTipo = 'individual' | 'enterprise'
export type WorkspaceStatus = 'ativo' | 'suspenso' | 'cancelado'

export interface Plan {
  id: string
  tipo: PlanTipo
  nome: string
  limite_colaboradores: number
  creditos_mensais: number
  preco_mensal: number
  created_at: string
}

export interface Workspace {
  id: string
  nome: string
  cnpj?: string
  owner_id: string
  plan_id: string
  created_at: string
  updated_at: string
  plans?: Plan
  profiles?: Profile
}

export interface CreditBalance {
  workspace_id: string
  saldo_avulso: number
  saldo_mensal_ciclo: { creditos: number; expira_em: string }[]
  ultima_renovacao: string
  created_at: string
  updated_at: string
}

export type CreditTransactionTipo = 'compra' | 'consumo' | 'estorno' | 'renovacao' | 'bonus_corplaw' | 'expiracao'

export interface CreditTransaction {
  id: string
  workspace_id: string
  user_id?: string
  tipo: CreditTransactionTipo
  quantidade: number
  referencia_tipo?: string
  referencia_id?: string
  descricao?: string
  created_at: string
  profiles?: Profile
}

export interface MemberCreditLimit {
  workspace_id: string
  user_id: string
  limite_mensal: number | null
  consumido_mes: number
  reset_at: string
}
export type ContractStatus = 'ativo' | 'em_renovacao' | 'encerrado' | 'arquivado'
export type ExtractionStatus = 'pendente' | 'processando' | 'concluido' | 'falhou'
export type OpportunityStatus = 'identificada' | 'em_abordagem' | 'convertida' | 'descartada'

export interface Profile {
  id: string; full_name: string; email: string; role: UserRole
  workspace_id?: string
  supervisor_id?: string
  avatar_url?: string; is_active: boolean; created_at: string; updated_at: string
  supervisor?: Profile
}
export interface Client {
  id: string; name: string; document?: string; email?: string; phone?: string
  address?: string; notes?: string; created_by?: string; created_at: string; updated_at: string
  responsible_users?: Profile[]
}
export interface Contract {
  id: string; title: string; client_id?: string; contract_type?: string
  status: ContractStatus; file_path?: string; file_name?: string; file_size?: number
  extraction_status: ExtractionStatus; created_by?: string; created_at: string; updated_at: string
  clients?: Client
}
export interface ContractMetadata {
  id: string; contract_id: string; contracting_party?: string; contracting_party_document?: string
  contracted_party?: string; contracted_party_document?: string; object_description?: string
  start_date?: string; end_date?: string; total_duration?: string; auto_renewal?: boolean
  renewal_notice_days?: number; total_value?: number; installment_value?: number
  installment_count?: number; readjustment_index?: string; penalty_clause?: string
  termination_clause?: string; jurisdiction?: string; has_confidentiality_clause?: boolean
  has_liability_limitation?: boolean; raw_extraction?: Record<string, unknown>
  validated_by?: string; validated_at?: string; created_at: string; updated_at: string
}
export interface ContractObligation {
  id: string; contract_id: string; party: string; description: string
  due_date?: string; is_recurring?: boolean; recurrence_pattern?: string
  status: string; created_at: string; updated_at: string
}
export interface ContractOpportunity {
  id: string; contract_id: string; client_id?: string; type: string
  description: string; risk_level: string; status: OpportunityStatus
  notes?: string; created_at: string; updated_at: string
  contracts?: Contract; clients?: Client
}
export interface ContractMilestone {
  id: string; contract_id: string; title: string; milestone_date: string
  type: string; description?: string; created_by?: string; created_at: string
}
export interface ContractAlert {
  id: string; contract_id: string; alert_type: string; alert_date: string
  days_before?: number; message?: string; is_sent: boolean; sent_at?: string
  milestone_id?: string; created_at: string; contracts?: Contract
  contract_milestones?: ContractMilestone
}
export interface AuditLog {
  id: string; user_id?: string; action: string; entity_type: string
  entity_id?: string; old_data?: Record<string, unknown>; new_data?: Record<string, unknown>
  workspace_id?: string
  scope?: 'internal' | 'client'
  created_at: string; profiles?: Profile
  workspaces?: { nome: string }
}

// ─── Módulo: Análise Contratual ───────────────────────────────────────────────

export type AnalysisStatus = 'processando' | 'rascunho_estagiario' | 'aguardando_revisao' | 'rascunho' | 'finalizado' | 'falhou'

export interface AnalysisSection {
  id: string
  titulo: string
  conteudo: string
}

export interface AnalysisAISections {
  titulo: string
  objeto: string
  partes: { contratante: string; contratada: string }
  secoes: AnalysisSection[]
  nivel_risco_geral: 'alto' | 'medio' | 'baixo'
  resumo_executivo: string
}

export interface ContractAnalysis {
  id: string
  title: string
  client_id?: string
  workspace_id?: string
  context?: string
  ai_sections?: AnalysisAISections
  edited_sections?: AnalysisAISections
  status: AnalysisStatus
  risk_level?: 'alto' | 'medio' | 'baixo'
  created_by?: string
  reviewer_id?: string
  submitted_for_review_at?: string
  reviewed_at?: string
  created_at: string
  updated_at: string
  clients?: Client
  reviewer?: Profile
  author?: Profile
}

// ─── Módulo: Banco de Problemas Contratuais ───────────────────────────────────

export interface MissingClause {
  clause_type: string
  description: string
  suggested_text?: string
}

export type ProblemResolutionStatus = 'aberto' | 'em_acompanhamento' | 'prevenido' | 'materializou' | 'resolvido'

export interface ContractProblem {
  id: string
  client_id?: string
  contract_id?: string
  contract_type?: string
  counterparty_name?: string
  counterparty_document?: string
  event_date?: string
  description: string
  financial_impact?: number
  economia_gerada?: number
  resolution_status?: ProblemResolutionStatus
  workspace_id?: string
  impact_category: 'multa' | 'rescisão' | 'litígio' | 'inadimplência' | 'reajuste' | 'garantia' | 'outro'
  missing_clauses?: MissingClause[]
  ai_recommendations?: string
  ai_analyzed_at?: string
  created_by?: string
  created_at: string
  clients?: Client
  contracts?: Contract
  workspaces?: { nome: string }
}
