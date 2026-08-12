export type UserRole = 'socio' | 'administrador' | 'advogado' | 'assistente'
export type ContractStatus = 'ativo' | 'em_renovacao' | 'encerrado' | 'arquivado'
export type ExtractionStatus = 'pendente' | 'processando' | 'concluido' | 'falhou'
export type OpportunityStatus = 'identificada' | 'em_abordagem' | 'convertida' | 'descartada'

export interface Profile {
  id: string; full_name: string; email: string; role: UserRole
  avatar_url?: string; is_active: boolean; created_at: string; updated_at: string
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
  created_at: string; profiles?: Profile
}

// ─── Módulo: Análise Contratual ───────────────────────────────────────────────

export type AnalysisStatus = 'processando' | 'rascunho' | 'finalizado' | 'falhou'

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
  context?: string
  ai_sections?: AnalysisAISections
  edited_sections?: AnalysisAISections
  status: AnalysisStatus
  risk_level?: 'alto' | 'medio' | 'baixo'
  created_by?: string
  created_at: string
  updated_at: string
  clients?: Client
}

// ─── Módulo: Banco de Problemas Contratuais ───────────────────────────────────

export interface MissingClause {
  clause_type: string
  description: string
  suggested_text?: string
}

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
  impact_category: 'multa' | 'rescisão' | 'litígio' | 'inadimplência' | 'reajuste' | 'garantia' | 'outro'
  missing_clauses?: MissingClause[]
  ai_recommendations?: string
  ai_analyzed_at?: string
  created_by?: string
  created_at: string
  clients?: Client
  contracts?: Contract
}
