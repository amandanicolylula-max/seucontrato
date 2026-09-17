// PDF profissional Corplaw — timbrado CorpLaw em todas as páginas.
// IMPORTANTE: NÃO use wrap={false} em Views de conteúdo grande (texto de risco,
// descrições, etc.) — @react-pdf/renderer precisa quebrar naturalmente para não
// transbordar cabeçalho/rodapé do timbrado. Só use wrap={false} em elementos
// pequenos e coesos (badge, header curto que deve ficar junto do próximo bloco).

import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { AnaliseDocumento, RiscoDetalhado, Gravidade } from '@/lib/corplaw/types'
import { TIMBRADO_CORPLAW } from '@/assets/corplaw-timbrado'

// Sanitiza número para evitar erro "unsupported number" do Yoga (@react-pdf).
// A IA às vezes retorna exposicao_brl em notação científica ou fora do range int32.
function safeMoney(v: number | null | undefined): string | null {
  if (v == null) return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  const clamped = Math.max(-1e15, Math.min(1e15, Math.round(n)))
  return clamped.toLocaleString('pt-BR')
}

const COLORS = {
  navy: '#0f2137',
  navyLight: '#1e3a5f',
  slate: '#334155',
  slateLight: '#64748b',
  gray: '#e2e8f0',
  bgSoft: '#f8fafc',
  critico: '#dc2626',
  alto: '#ea580c',
  medio: '#d97706',
  baixo: '#16a34a',
  positivo: '#059669',
  border: '#cbd5e1',
}

const GRAV_COLOR: Record<Gravidade, string> = {
  CRÍTICO: COLORS.critico,
  ALTO: COLORS.alto,
  MÉDIO: COLORS.medio,
  BAIXO: COLORS.baixo,
}

const styles = StyleSheet.create({
  page: {
    // Barra teal à esquerda + logo topo pequeno + marca d'água canto inf. direito.
    // Margens ajustadas pra respeitar essas áreas.
    paddingTop: 55,
    paddingBottom: 55,
    paddingLeft: 90,   // barra teal + folga
    paddingRight: 50,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: COLORS.slate,
    lineHeight: 1.45,
  },
  bg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  content: { position: 'relative' },
  // Header (só na página 1)
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.navy,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.navyLight,
    marginBottom: 3,
  },
  meta: {
    fontSize: 9,
    color: COLORS.slateLight,
    marginBottom: 20,
  },
  // Metadata grid
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTop: `1px solid ${COLORS.gray}`,
    paddingTop: 10,
    marginBottom: 16,
  },
  metaCell: { width: '50%', marginBottom: 8, paddingRight: 10 },
  metaLabel: {
    fontSize: 8,
    color: COLORS.slateLight,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  metaValue: { fontSize: 10, color: COLORS.navy },
  // Section
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.navy,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingBottom: 3,
    borderBottom: `1.5px solid ${COLORS.navy}`,
  },
  // Blocos destacados
  highlight: {
    padding: 10,
    backgroundColor: COLORS.bgSoft,
    borderLeft: `3px solid ${COLORS.navy}`,
    marginBottom: 8,
  },
  highlightText: { fontSize: 10, color: COLORS.slate, lineHeight: 1.5 },
  // Rating
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  ratingLabel: { fontSize: 9, color: COLORS.slateLight, marginRight: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  star: { fontSize: 14, marginRight: 1 },
  // Bullets
  bullet: { flexDirection: 'row', marginBottom: 4 },
  bulletDot: { width: 10, fontSize: 10, color: COLORS.positivo },
  bulletText: { flex: 1, fontSize: 10, color: COLORS.slate },
  // Recomendação
  recRow: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottom: `0.5px solid ${COLORS.gray}`,
  },
  recNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.navy,
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingTop: 4,
    marginRight: 8,
  },
  recBody: { flex: 1 },
  recAcao: { fontSize: 10, color: COLORS.navy, fontWeight: 'bold', marginBottom: 2 },
  recImpacto: { fontSize: 9, color: COLORS.slateLight },
  // Risco
  riscoBox: {
    marginBottom: 14,
    padding: 10,
    borderLeft: `3px solid ${COLORS.gray}`,
    backgroundColor: COLORS.bgSoft,
  },
  riscoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  riscoCodigo: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.navy,
    marginRight: 6,
  },
  riscoTitulo: {
    flex: 1,
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.navy,
  },
  gravBadge: {
    fontSize: 8,
    color: 'white',
    paddingLeft: 6,
    paddingRight: 6,
    paddingTop: 2,
    paddingBottom: 2,
    borderRadius: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: 'bold',
  },
  riscoMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 6,
    fontSize: 8,
    color: COLORS.slateLight,
  },
  riscoMetaItem: { marginRight: 12 },
  riscoField: { marginBottom: 4 },
  fieldLabel: {
    fontSize: 8,
    color: COLORS.slateLight,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  fieldText: { fontSize: 9.5, color: COLORS.slate, lineHeight: 1.5 },
  // Footer (page number)
  pageNumber: {
    position: 'absolute',
    fontSize: 8,
    bottom: 25,
    left: 90,
    right: 50,
    textAlign: 'center',
    color: COLORS.slateLight,
  },
})

function Stars({ n }: { n: number }) {
  const full = Math.max(0, Math.min(5, Math.round(n)))
  return (
    <View style={{ flexDirection: 'row' }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Text key={i} style={[styles.star, { color: i < full ? '#f59e0b' : COLORS.gray }]}>
          {i < full ? '★' : '☆'}
        </Text>
      ))}
    </View>
  )
}

function MetaRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <View style={styles.metaCell}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  )
}

function Risco({ r }: { r: RiscoDetalhado }) {
  const cor = GRAV_COLOR[r.gravidade] || COLORS.slate
  return (
    <View style={[styles.riscoBox, { borderLeftColor: cor }]}>
      <View style={styles.riscoHeader}>
        <Text style={styles.riscoCodigo}>{r.codigo}</Text>
        <Text style={styles.riscoTitulo}>{r.titulo}</Text>
        <Text style={[styles.gravBadge, { backgroundColor: cor }]}>{r.gravidade}</Text>
      </View>
      <View style={styles.riscoMeta}>
        <Text style={styles.riscoMetaItem}>Probabilidade: {r.probabilidade}</Text>
        <Text style={styles.riscoMetaItem}>Impacto: {r.impacto}</Text>
        <Text style={styles.riscoMetaItem}>Tipo: {r.tipo}</Text>
        {safeMoney(r.exposicao_brl) && (
          <Text style={styles.riscoMetaItem}>
            Exposição: R$ {safeMoney(r.exposicao_brl)}
          </Text>
        )}
      </View>
      {r.origem && (
        <View style={styles.riscoField}>
          <Text style={styles.fieldLabel}>Origem</Text>
          <Text style={styles.fieldText}>{r.origem}</Text>
        </View>
      )}
      {r.descricao && (
        <View style={styles.riscoField}>
          <Text style={styles.fieldLabel}>Descrição</Text>
          <Text style={styles.fieldText}>{r.descricao}</Text>
        </View>
      )}
      {r.cruzamento && (
        <View style={styles.riscoField}>
          <Text style={styles.fieldLabel}>Cruzamento entre cláusulas</Text>
          <Text style={styles.fieldText}>{r.cruzamento}</Text>
        </View>
      )}
      {r.cenario && (
        <View style={styles.riscoField}>
          <Text style={styles.fieldLabel}>Cenário concreto</Text>
          <Text style={styles.fieldText}>{r.cenario}</Text>
        </View>
      )}
      {r.impacto_potencial && (
        <View style={styles.riscoField}>
          <Text style={styles.fieldLabel}>Impacto potencial</Text>
          <Text style={styles.fieldText}>{r.impacto_potencial}</Text>
        </View>
      )}
      {r.recomendacao && (
        <View style={styles.riscoField}>
          <Text style={styles.fieldLabel}>Recomendação</Text>
          <Text style={styles.fieldText}>{r.recomendacao}</Text>
        </View>
      )}
      {r.clausulas && r.clausulas.length > 0 && (
        <View style={styles.riscoField}>
          <Text style={styles.fieldLabel}>Cláusulas envolvidas</Text>
          <Text style={styles.fieldText}>{r.clausulas.join(' · ')}</Text>
        </View>
      )}
    </View>
  )
}

interface Props {
  title: string
  clientName?: string
  createdAt?: string
  analise: AnaliseDocumento
}

export default function CorplawPDF({ title, clientName, createdAt, analise }: Props) {
  return (
    <Document title={`Parecer — ${title}`} author="CorpLaw Advogados">
      <Page size="A4" style={styles.page} wrap>
        <Image src={TIMBRADO_CORPLAW} style={styles.bg} fixed />
        <View style={styles.content}>
          {/* Cabeçalho — só aparece na primeira página */}
          <Text style={styles.title}>Parecer Contratual</Text>
          <Text style={styles.subtitle}>{title}</Text>
          <Text style={styles.meta}>
            {clientName ? `${clientName} · ` : ''}
            {createdAt || new Date().toLocaleDateString('pt-BR')}
          </Text>

          {/* Metadata */}
          <View style={styles.metaGrid}>
            <MetaRow label="Tipo de documento" value={analise.tipo_documento} />
            <MetaRow label="Objeto" value={analise.objeto} />
            <MetaRow label="Partes" value={analise.partes?.join(' · ')} />
            <MetaRow label="Valor total" value={analise.valor_total || undefined} />
            <MetaRow label="Vigência" value={analise.vigencia || undefined} />
            <MetaRow label="Estrutura de pagamento" value={analise.estrutura_pagamento || undefined} />
          </View>

          {/* Avaliação geral */}
          <View style={styles.section}>
            <View style={styles.ratingRow}>
              <Text style={styles.ratingLabel}>Avaliação geral do contrato:</Text>
              <Stars n={analise.avaliacao_geral || 0} />
            </View>
            {analise.avaliacao_texto && (
              <Text style={{ fontSize: 9.5, color: COLORS.slate, marginTop: 2 }}>{analise.avaliacao_texto}</Text>
            )}
          </View>

          {/* Resumo da operação */}
          {analise.resumo_operacao && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Resumo da operação</Text>
              <View style={styles.highlight}>
                <Text style={styles.highlightText}>{analise.resumo_operacao}</Text>
              </View>
            </View>
          )}

          {/* Contexto do negócio */}
          {analise.contexto_negocio && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Contexto do negócio</Text>
              <Text style={styles.fieldText}>{analise.contexto_negocio}</Text>
            </View>
          )}

          {/* Pontos positivos */}
          {analise.pontos_positivos && analise.pontos_positivos.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Pontos positivos</Text>
              {analise.pontos_positivos.map((p, i) => (
                <View key={i} style={styles.bullet}>
                  <Text style={styles.bulletDot}>✓</Text>
                  <Text style={styles.bulletText}>{p}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Recomendações prioritárias */}
          {analise.recomendacoes_prioritarias && analise.recomendacoes_prioritarias.length > 0 && (
            <View style={styles.section} break>
              <Text style={styles.sectionTitle}>Recomendações prioritárias</Text>
              {[...analise.recomendacoes_prioritarias]
                .sort((a, b) => (a.urgencia || 0) - (b.urgencia || 0))
                .map((rec, i) => (
                  <View key={i} style={styles.recRow}>
                    <Text style={styles.recNum}>{rec.urgencia || i + 1}</Text>
                    <View style={styles.recBody}>
                      <Text style={styles.recAcao}>{rec.acao}</Text>
                      {rec.impacto_se_ignorado && (
                        <Text style={styles.recImpacto}>Se ignorado: {rec.impacto_se_ignorado}</Text>
                      )}
                    </View>
                  </View>
                ))}
            </View>
          )}

          {/* Riscos */}
          {analise.riscos && analise.riscos.length > 0 && (
            <View style={styles.section} break>
              <Text style={styles.sectionTitle}>
                Riscos identificados ({analise.riscos.length})
                {safeMoney(analise.exposicao_total_brl) &&
                  ` — Exposição total estimada: R$ ${safeMoney(analise.exposicao_total_brl)}`}
              </Text>
              {analise.riscos.map((r, i) => (
                <Risco key={r.codigo || i} r={r} />
              ))}
            </View>
          )}

          {/* Prazo relevante */}
          {analise.prazo_relevante && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Prazo relevante</Text>
              <View style={styles.highlight}>
                <Text style={styles.highlightText}>{analise.prazo_relevante}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Rodapé com numeração */}
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  )
}
