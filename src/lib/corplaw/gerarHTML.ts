import { AnaliseDocumento, Gravidade, Probabilidade, ImpactoNivel } from "./types";

const PROB_INDEX: Record<Probabilidade, number> = {
  "Baixa": 0, "Média": 1, "Alta": 2, "Muito Alta": 3,
};
const IMP_INDEX: Record<ImpactoNivel, number> = {
  "Baixo": 0, "Médio": 1, "Alto": 2, "Muito Alto": 3,
};

const GRAVIDADE_COLOR: Record<Gravidade, string> = {
  CRÍTICO: "#dc2626",
  ALTO:    "#ea580c",
  MÉDIO:   "#d97706",
  BAIXO:   "#16a34a",
};

const CELL_COLOR = (col: number, row: number): string => {
  const score = (col + 1) * (row + 1);
  if (score >= 9) return "#fee2e2";
  if (score >= 4) return "#fef9c3";
  return "#dcfce7";
};

function buildMatrix(analise: AnaliseDocumento): string {
  // grid[row][col] = list of risk codes (row 0 = Muito Alto, col 0 = Baixa)
  const grid: string[][][] = Array.from({ length: 4 }, () =>
    Array.from({ length: 4 }, () => [] as string[])
  );

  for (const r of analise.riscos) {
    const col = PROB_INDEX[r.probabilidade] ?? 0;
    const row = 3 - (IMP_INDEX[r.impacto] ?? 0); // inverted: Muito Alto at top
    grid[row][col].push(r.codigo);
  }

  const probLabels = ["Baixa", "Média", "Alta", "Muito Alta"];
  const impLabels  = ["Muito Alto", "Alto", "Médio", "Baixo"]; // top to bottom

  let html = `
  <div class="matrix-wrap">
    <div class="matrix-container">
      <div class="matrix-ylabel">← IMPACTO</div>
      <div class="matrix-inner">
        <div class="matrix-grid">`;

  for (let row = 0; row < 4; row++) {
    html += `<div class="matrix-row-label">${impLabels[row]}</div>`;
    for (let col = 0; col < 4; col++) {
      const bg = CELL_COLOR(col, 3 - row);
      const codes = grid[row][col];
      html += `<div class="matrix-cell" style="background:${bg}">`;
      for (const code of codes) {
        const risk = analise.riscos.find((r) => r.codigo === code)!;
        const color = GRAVIDADE_COLOR[risk.gravidade];
        html += `<span class="risk-dot" style="background:${color}" title="${risk.titulo}">${code}</span>`;
      }
      html += `</div>`;
    }
  }

  html += `</div>
        <div class="matrix-xlabel">`;
  for (const label of probLabels) {
    html += `<div class="matrix-col-label">${label}</div>`;
  }
  html += `</div>
        <div class="matrix-xlabel-title">PROBABILIDADE →</div>
      </div>
    </div>
    <div class="matrix-legend">
      <span class="legend-item" style="background:#fee2e2;border:1px solid #fca5a5">Zona crítica</span>
      <span class="legend-item" style="background:#fef9c3;border:1px solid #fde047">Atenção</span>
      <span class="legend-item" style="background:#dcfce7;border:1px solid #86efac">Baixo risco</span>
    </div>
  </div>`;

  return html;
}

function formatarBRL(valor: number | null) {
  if (!valor) return null;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL", minimumFractionDigits: 0,
  }).format(valor);
}

export function gerarHTML(analise: AnaliseDocumento, nomeArquivo: string, nomeCliente?: string): string {
  const brl = formatarBRL(analise.exposicao_total_brl);
  const estrelas = "★".repeat(analise.avaliacao_geral) + "☆".repeat(5 - analise.avaliacao_geral);
  const dataGeracao = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const matrizHTML = buildMatrix(analise);

  const riscosHTML = analise.riscos.map((r) => {
    const cor = GRAVIDADE_COLOR[r.gravidade];
    const expBrl = formatarBRL(r.exposicao_brl);
    return `
    <details class="risco-item" id="${r.codigo}">
      <summary class="risco-summary" style="border-left:4px solid ${cor}">
        <div class="risco-summary-inner">
          <span class="risco-code">${r.codigo}</span>
          <span class="risco-badge" style="background:${cor}20;color:${cor};border:1px solid ${cor}40">${r.gravidade}</span>
          <span class="risco-titulo">${r.titulo}</span>
          <span class="risco-tipo">${r.tipo}</span>
          ${expBrl ? `<span class="risco-exp">${expBrl}</span>` : ""}
          <span class="risco-arrow">›</span>
        </div>
        <div class="risco-meta">
          <span>Probabilidade: <strong>${r.probabilidade}</strong></span>
          <span>Impacto: <strong>${r.impacto}</strong></span>
        </div>
      </summary>
      <div class="risco-body">
        ${(r.clausulas ?? []).length ? `<div class="clausula-box"><strong>📌 Cláusulas:</strong> ${(r.clausulas ?? []).join(" · ")}</div>` : ""}
        ${r.origem ? `<div class="detail-block highlight-origin">
          <h4>🔎 De onde vem o risco</h4>
          <p>${r.origem}</p>
        </div>` : ""}
        <div class="detail-block">
          <h4>Problema identificado</h4>
          <p>${r.descricao}</p>
        </div>
        ${r.cruzamento ? `<div class="detail-block highlight-cross">
          <h4>⚠ Análise de cruzamento</h4>
          <p>${r.cruzamento}</p>
        </div>` : ""}
        ${r.cenario ? `<div class="detail-block">
          <h4>📌 Quando o risco acontece</h4>
          <p>${r.cenario}</p>
        </div>` : ""}
        <div class="detail-block">
          <h4>Impacto prático</h4>
          <p>${r.impacto_potencial}</p>
        </div>
        <div class="detail-block highlight-rec">
          <h4>✔ Como mitigar</h4>
          <p>${r.recomendacao}</p>
        </div>
      </div>
    </details>`;
  }).join("");

  const recsHTML = analise.recomendacoes_prioritarias.map((r, i) => `
    <tr>
      <td class="rec-num">${i + 1}</td>
      <td>${r.acao}</td>
      <td class="rec-risco">${r.impacto_se_ignorado}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Análise de Contrato${nomeCliente ? ` — ${nomeCliente}` : ""}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root {
    --navy: #1e2756;
    --navy-light: #2d3a7c;
    --teal: #0ba89a;
    --teal-light: #e4f7f6;
    --teal-mid: #b2e8e4;
    --gray-bg: #f6f7fb;
    --gray-border: #e0e3f0;
    --gray-text: #4b5563;
    --text: #111827;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Montserrat', Arial, sans-serif;
    background: var(--gray-bg);
    color: var(--text);
    font-size: 14px;
    line-height: 1.65;
  }

  /* ── LAYOUT ── */
  .page { max-width: 900px; margin: 0 auto; padding: 0 0 60px; }

  /* ── HEADER ── */
  .header {
    background: linear-gradient(135deg, var(--navy) 0%, var(--navy-light) 60%, #1a4a6e 100%);
    padding: 36px 40px 32px;
    color: white;
    position: relative;
    overflow: hidden;
  }
  .header::after {
    content: '';
    position: absolute;
    right: -40px; top: -40px;
    width: 220px; height: 220px;
    border-radius: 50%;
    background: var(--teal);
    opacity: 0.08;
  }
  .header-logo { font-size: 11px; font-weight: 700; letter-spacing: 3px; color: var(--teal); text-transform: uppercase; margin-bottom: 16px; }
  .header h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
  .header-sub { font-size: 13px; opacity: 0.7; font-weight: 300; }
  .header-meta { display: flex; gap: 20px; margin-top: 20px; flex-wrap: wrap; }
  .header-meta-item { font-size: 11px; }
  .header-meta-item span { display: block; color: var(--teal); font-weight: 600; text-transform: uppercase; letter-spacing: 1px; font-size: 10px; margin-bottom: 2px; }

  /* ── TABS ── */
  .tabs { background: white; border-bottom: 2px solid var(--gray-border); padding: 0 40px; display: flex; gap: 0; position: sticky; top: 0; z-index: 10; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
  .tab { padding: 14px 20px; font-size: 12px; font-weight: 600; color: var(--gray-text); cursor: pointer; border-bottom: 3px solid transparent; margin-bottom: -2px; text-transform: uppercase; letter-spacing: 0.5px; transition: all .2s; white-space: nowrap; }
  .tab:hover { color: var(--navy); }
  .tab.active { color: var(--navy); border-bottom-color: var(--teal); }

  /* ── SECTIONS ── */
  .section { display: none; padding: 32px 40px; }
  .section.active { display: block; }

  /* ── CARDS ── */
  .card { background: white; border: 1px solid var(--gray-border); border-radius: 10px; padding: 20px 24px; margin-bottom: 16px; }
  .card-title { font-size: 11px; font-weight: 700; color: var(--teal); text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px; }

  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; }
  .info-item label { display: block; font-size: 10px; font-weight: 700; color: var(--gray-text); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 3px; }
  .info-item p { font-size: 13px; color: var(--text); font-weight: 500; }

  /* ── EXPOSIÇÃO ── */
  .exposicao-card {
    background: linear-gradient(135deg, #1a0a0a, #3b0e0e);
    border-radius: 10px; padding: 20px 24px; color: white; margin-bottom: 16px;
  }
  .exposicao-card label { font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #fca5a5; display: block; margin-bottom: 6px; }
  .exposicao-valor { font-size: 32px; font-weight: 700; color: #fca5a5; }

  /* ── PRAZO ── */
  .prazo-card { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; padding: 14px 20px; display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
  .prazo-card .icon { font-size: 20px; }
  .prazo-card p { font-size: 13px; color: #92400e; }

  /* ── POSITIVOS ── */
  .positivos-list { list-style: none; }
  .positivos-list li { padding: 8px 0; border-bottom: 1px solid var(--gray-border); font-size: 13px; display: flex; align-items: flex-start; gap: 10px; }
  .positivos-list li:last-child { border-bottom: none; }
  .positivos-list li::before { content: '✓'; color: var(--teal); font-weight: 700; font-size: 14px; flex-shrink: 0; margin-top: 1px; }

  /* ── AVALIAÇÃO ── */
  .avaliacao-card {
    background: linear-gradient(135deg, var(--navy) 0%, var(--navy-light) 100%);
    border-radius: 10px; padding: 24px; text-align: center; color: white;
  }
  .estrelas { font-size: 28px; color: var(--teal); letter-spacing: 4px; display: block; margin-bottom: 10px; }
  .avaliacao-texto { font-size: 14px; font-weight: 500; opacity: 0.9; }

  /* ── MATRIZ ── */
  .matrix-wrap { display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .matrix-container { display: flex; align-items: center; gap: 10px; }
  .matrix-ylabel { font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: var(--gray-text); writing-mode: vertical-rl; transform: rotate(180deg); }
  .matrix-inner { display: flex; flex-direction: column; gap: 6px; }
  .matrix-grid { display: grid; grid-template-columns: 80px repeat(4, 90px); gap: 4px; }
  .matrix-row-label { display: flex; align-items: center; justify-content: flex-end; padding-right: 8px; font-size: 11px; font-weight: 600; color: var(--gray-text); }
  .matrix-cell { height: 72px; border-radius: 6px; display: flex; flex-wrap: wrap; align-content: center; justify-content: center; gap: 4px; border: 1px solid rgba(0,0,0,0.06); }
  .risk-dot { font-size: 10px; font-weight: 700; color: white; padding: 3px 6px; border-radius: 4px; cursor: default; }
  .matrix-xlabel { display: grid; grid-template-columns: 80px repeat(4, 90px); gap: 4px; margin-top: 4px; }
  .matrix-col-label { text-align: center; font-size: 10px; font-weight: 600; color: var(--gray-text); }
  .matrix-xlabel-title { text-align: center; font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: var(--gray-text); margin-top: 4px; padding-left: 80px; }
  .matrix-legend { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
  .legend-item { font-size: 11px; padding: 4px 12px; border-radius: 20px; font-weight: 600; }

  /* ── RISCOS ── */
  .risco-item { background: white; border: 1px solid var(--gray-border); border-radius: 10px; margin-bottom: 10px; overflow: hidden; }
  .risco-summary { padding: 14px 18px; cursor: pointer; list-style: none; user-select: none; }
  .risco-summary::-webkit-details-marker { display: none; }
  .risco-summary:hover { background: var(--gray-bg); }
  .risco-summary-inner { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .risco-code { font-size: 11px; font-weight: 700; background: var(--gray-bg); border: 1px solid var(--gray-border); padding: 2px 7px; border-radius: 4px; color: var(--navy); }
  .risco-badge { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; }
  .risco-titulo { font-size: 13px; font-weight: 600; color: var(--navy); flex: 1; min-width: 140px; }
  .risco-tipo { font-size: 11px; color: var(--gray-text); background: var(--gray-bg); padding: 2px 8px; border-radius: 4px; }
  .risco-exp { font-size: 12px; font-weight: 700; color: #dc2626; }
  .risco-arrow { margin-left: auto; font-size: 18px; color: var(--gray-text); transition: transform .2s; }
  details[open] .risco-arrow { transform: rotate(90deg); }
  .risco-meta { display: flex; gap: 16px; margin-top: 6px; font-size: 11px; color: var(--gray-text); }
  .risco-body { padding: 0 18px 18px; border-top: 1px solid var(--gray-border); }
  .clausula-box { background: var(--navy); color: white; padding: 8px 14px; border-radius: 6px; font-size: 12px; margin: 14px 0 10px; }
  .detail-block { margin-top: 12px; }
  .detail-block h4 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--navy); margin-bottom: 5px; }
  .detail-block p { font-size: 13px; color: var(--text); }
  .highlight-cross { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 14px; }
  .highlight-cross h4 { color: #92400e; }
  .highlight-origin { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 14px; }
  .highlight-origin h4 { color: #334155; }
  .highlight-rec { background: var(--teal-light); border: 1px solid var(--teal-mid); border-radius: 8px; padding: 12px 14px; }
  .highlight-rec h4 { color: #0a7a6e; }

  /* ── RECOMENDAÇÕES ── */
  table { width: 100%; border-collapse: collapse; }
  thead th { background: var(--navy); color: white; padding: 10px 14px; font-size: 11px; font-weight: 700; text-align: left; text-transform: uppercase; letter-spacing: 1px; }
  tbody tr:nth-child(even) { background: var(--gray-bg); }
  tbody td { padding: 12px 14px; border-bottom: 1px solid var(--gray-border); font-size: 13px; vertical-align: top; }
  .rec-num { width: 36px; font-weight: 700; color: var(--teal); font-size: 16px; }
  .rec-risco { color: #dc2626; font-size: 12px; }

  /* ── FOOTER ── */
  .footer { background: var(--navy); color: rgba(255,255,255,0.4); text-align: center; padding: 16px 40px; font-size: 11px; margin-top: 0; }
  .footer strong { color: rgba(255,255,255,0.7); }
</style>
</head>
<body>
<div class="page">

  <div class="header">
    <div class="header-logo">Corplaw · Análise Jurídica</div>
    <h1>${analise.tipo_documento}</h1>
    <div class="header-sub">${analise.partes.join(" × ")}</div>
    <div class="header-meta">
      ${nomeCliente ? `<div class="header-meta-item"><span>Cliente</span>${nomeCliente}</div>` : ""}
      <div class="header-meta-item"><span>Documento</span>${nomeArquivo}</div>
      ${analise.valor_total ? `<div class="header-meta-item"><span>Valor</span>${analise.valor_total}</div>` : ""}
      ${analise.vigencia ? `<div class="header-meta-item"><span>Vigência</span>${analise.vigencia}</div>` : ""}
      <div class="header-meta-item"><span>Gerado em</span>${dataGeracao}</div>
    </div>
  </div>

  <div class="tabs">
    <div class="tab active" onclick="showTab('resumo')">Resumo</div>
    <div class="tab" onclick="showTab('matriz')">Matriz de riscos</div>
    <div class="tab" onclick="showTab('riscos')">Riscos (${analise.riscos.length})</div>
    <div class="tab" onclick="showTab('recomendacoes')">Recomendações</div>
    <div class="tab" onclick="showTab('avaliacao')">Avaliação</div>
  </div>

  <!-- RESUMO -->
  <div class="section active" id="tab-resumo">
    ${brl ? `
    <div class="exposicao-card">
      <label>Exposição financeira estimada</label>
      <div class="exposicao-valor">${brl}</div>
    </div>` : ""}

    ${analise.prazo_relevante ? `
    <div class="prazo-card">
      <span class="icon">⏰</span>
      <p><strong>Prazo relevante:</strong> ${analise.prazo_relevante}</p>
    </div>` : ""}

    <div class="card">
      <div class="card-title">Resumo da operação</div>
      <p style="font-size:13px;line-height:1.7">${analise.resumo_operacao}</p>
    </div>

    <div class="card">
      <div class="card-title">Dados do contrato</div>
      <div class="info-grid">
        ${analise.objeto ? `<div class="info-item"><label>Objeto</label><p>${analise.objeto}</p></div>` : ""}
        ${analise.valor_total ? `<div class="info-item"><label>Valor total</label><p>${analise.valor_total}</p></div>` : ""}
        ${analise.vigencia ? `<div class="info-item"><label>Vigência</label><p>${analise.vigencia}</p></div>` : ""}
        ${analise.estrutura_pagamento ? `<div class="info-item"><label>Pagamento</label><p>${analise.estrutura_pagamento}</p></div>` : ""}
      </div>
    </div>

    <div class="card">
      <div class="card-title">Contexto e alinhamento com o negócio</div>
      <p style="font-size:13px;line-height:1.7">${analise.contexto_negocio}</p>
    </div>

    ${analise.pontos_positivos.length ? `
    <div class="card">
      <div class="card-title">Pontos positivos do contrato</div>
      <ul class="positivos-list">
        ${analise.pontos_positivos.map((p) => `<li>${p}</li>`).join("")}
      </ul>
    </div>` : ""}
  </div>

  <!-- MATRIZ -->
  <div class="section" id="tab-matriz">
    <div class="card">
      <div class="card-title">Matriz de risco — Probabilidade × Impacto</div>
      ${matrizHTML}
    </div>
    <div class="card" style="margin-top:0">
      <div class="card-title">Legenda</div>
      <table>
        <thead><tr><th>Código</th><th>Risco</th><th>Probabilidade</th><th>Impacto</th><th>Gravidade</th></tr></thead>
        <tbody>
          ${analise.riscos.map((r) => `
          <tr>
            <td><strong style="color:${GRAVIDADE_COLOR[r.gravidade]}">${r.codigo}</strong></td>
            <td>${r.titulo}</td>
            <td>${r.probabilidade}</td>
            <td>${r.impacto}</td>
            <td><strong style="color:${GRAVIDADE_COLOR[r.gravidade]}">${r.gravidade}</strong></td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
  </div>

  <!-- RISCOS -->
  <div class="section" id="tab-riscos">
    <p style="font-size:12px;color:var(--gray-text);margin-bottom:16px">Clique em cada risco para ver o detalhamento completo.</p>
    ${riscosHTML}
  </div>

  <!-- RECOMENDAÇÕES -->
  <div class="section" id="tab-recomendacoes">
    <div class="card" style="padding:0;overflow:hidden">
      <table>
        <thead><tr><th style="width:40px">#</th><th>Ação recomendada</th><th>Risco se ignorado</th></tr></thead>
        <tbody>${recsHTML}</tbody>
      </table>
    </div>
  </div>

  <!-- AVALIAÇÃO -->
  <div class="section" id="tab-avaliacao">
    <div class="avaliacao-card">
      <span class="estrelas">${estrelas}</span>
      <div style="font-size:18px;font-weight:700;margin-bottom:8px">${analise.avaliacao_geral} / 5</div>
      <div class="avaliacao-texto">${analise.avaliacao_texto}</div>
    </div>
  </div>

</div>

<div class="footer">
  <strong>Corplaw Advogados Associados</strong> · Análise gerada com suporte de IA · Este relatório não substitui orientação jurídica profissional
</div>

<script>
  function showTab(id) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById('tab-' + id).classList.add('active');
    event.target.classList.add('active');
  }
</script>
</body>
</html>`;
}
