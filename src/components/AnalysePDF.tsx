import { Document, Page, Text, View, Image, StyleSheet, Font } from '@react-pdf/renderer'
import { TIMBRADO_P1, TIMBRADO_PN } from '@/assets/bd-timbrado'
import type { AnalysisAISections } from '@/types'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// Registrar fonte padrão (Helvetica já está built-in, mas Courier dá toque mais formal)
// Usamos Helvetica built-in para evitar carregamento de fonte externa

const NAVY = '#1B2B5B'
const DARK = '#1a1a1a'
const MUTED = '#555555'
const DIVIDER = '#D1D5DB'

const styles = StyleSheet.create({
  page: {
    position: 'relative',
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: DARK,
    lineHeight: 1.5,
  },
  // Imagem de fundo (timbrado)
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  // Área de conteúdo — primeira página: margem top maior (limpa o logo)
  contentFirst: {
    marginTop: 100,
    marginBottom: 80,
    marginLeft: 65,
    marginRight: 55,
  },
  // Área de conteúdo — páginas seguintes
  contentNext: {
    marginTop: 55,
    marginBottom: 80,
    marginLeft: 65,
    marginRight: 55,
  },
  // Cabeçalho do documento (título + data + linha divisória)
  docTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  docSubtitle: {
    fontSize: 9,
    color: MUTED,
    marginBottom: 12,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: NAVY,
    marginBottom: 14,
  },
  dividerLight: {
    borderBottomWidth: 0.5,
    borderBottomColor: DIVIDER,
    marginBottom: 10,
    marginTop: 10,
  },
  // Bloco de partes e objeto
  metaRow: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  metaLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
    width: 90,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  metaValue: {
    fontSize: 9,
    color: DARK,
    flex: 1,
  },
  // Resumo executivo
  resumoBox: {
    backgroundColor: '#F0F4FF',
    borderLeftWidth: 3,
    borderLeftColor: NAVY,
    padding: 10,
    marginBottom: 16,
    marginTop: 8,
  },
  resumoLabel: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  resumoText: {
    fontSize: 9,
    color: DARK,
    lineHeight: 1.6,
  },
  // Seções
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
    marginTop: 14,
  },
  sectionContent: {
    fontSize: 9.5,
    color: DARK,
    lineHeight: 1.65,
    textAlign: 'justify',
  },
  // Badge de risco
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  riskLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginRight: 6,
  },
  riskValueAlto: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#DC2626',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  riskValueMedio: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#D97706',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  riskValueBaixo: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#16A34A',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  // Data e rodapé de página
  pageNumber: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 8,
    color: MUTED,
  },
})

function getRiskStyle(level?: string) {
  if (level === 'alto') return styles.riskValueAlto
  if (level === 'baixo') return styles.riskValueBaixo
  return styles.riskValueMedio
}

function getRiskLabel(level?: string) {
  if (level === 'alto') return 'Alto'
  if (level === 'baixo') return 'Baixo'
  return 'Médio'
}

interface AnalysePDFProps {
  title: string
  clientName?: string
  sections: AnalysisAISections
}

export function AnalysePDF({ title, clientName, sections }: AnalysePDFProps) {
  const today = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
  const allSections = sections.secoes || []

  // Dividir seções: as 2 primeiras ficam na primeira página, resto nas seguintes
  const firstPageSections = allSections.slice(0, 2)
  const remainingSections = allSections.slice(2)

  return (
    <Document
      title={title}
      author="Seu Contrato"
      subject="Parecer Contratual"
      creator="Seu Contrato"
    >
      {/* ── Página 1: metadados + primeiras seções ── */}
      <Page size="A4" style={styles.page}>
        <Image src={TIMBRADO_P1} style={styles.background} fixed />

        <View style={styles.contentFirst}>
          {/* Cabeçalho */}
          <Text style={styles.docTitle}>PARECER CONTRATUAL</Text>
          <Text style={styles.docSubtitle}>
            {title} · {today}{clientName ? ` · Cliente: ${clientName}` : ''}
          </Text>
          <View style={styles.divider} />

          {/* Metadados: partes e objeto */}
          {sections.partes?.contratante && (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Contratante</Text>
              <Text style={styles.metaValue}>{sections.partes.contratante}</Text>
            </View>
          )}
          {sections.partes?.contratada && (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Contratada</Text>
              <Text style={styles.metaValue}>{sections.partes.contratada}</Text>
            </View>
          )}
          {sections.objeto && (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Objeto</Text>
              <Text style={styles.metaValue}>{sections.objeto}</Text>
            </View>
          )}

          {/* Badge de risco */}
          <View style={[styles.riskBadge, { marginTop: 8 }]}>
            <Text style={styles.riskLabel}>Risco Geral:</Text>
            <Text style={getRiskStyle(sections.nivel_risco_geral)}>
              {getRiskLabel(sections.nivel_risco_geral)}
            </Text>
          </View>

          {/* Resumo executivo */}
          {sections.resumo_executivo && (
            <View style={styles.resumoBox}>
              <Text style={styles.resumoLabel}>Resumo Executivo</Text>
              <Text style={styles.resumoText}>{sections.resumo_executivo}</Text>
            </View>
          )}

          <View style={styles.dividerLight} />

          {/* Primeiras 2 seções */}
          {firstPageSections.map((secao) => (
            <View key={secao.id} wrap={false}>
              <Text style={styles.sectionTitle}>{secao.titulo}</Text>
              <Text style={styles.sectionContent}>{secao.conteudo}</Text>
            </View>
          ))}
        </View>

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>

      {/* ── Páginas seguintes: seções restantes ── */}
      {remainingSections.length > 0 && (
        <Page size="A4" style={styles.page}>
          <Image src={TIMBRADO_PN} style={styles.background} fixed />

          <View style={styles.contentNext}>
            {remainingSections.map((secao) => (
              <View key={secao.id} wrap={false}>
                <Text style={styles.sectionTitle}>{secao.titulo}</Text>
                <Text style={styles.sectionContent}>{secao.conteudo}</Text>
                <View style={styles.dividerLight} />
              </View>
            ))}
          </View>

          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
            fixed
          />
        </Page>
      )}
    </Document>
  )
}
