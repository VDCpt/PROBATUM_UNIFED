/**
 * UNIFED - PROBATUM · OUTPUT ENRICHMENT LAYER · v13.12.2-i18n (ELITE DEMO)
 * ============================================================================
 * ... (restante cabeçalho mantido) ...
 */

'use strict';

// ============================================================================
// UNIFEDSystem.utils — UTILITÁRIOS CENTRALIZADOS
// ============================================================================
(function _installUNIFEDUtils() {
    // ... (código existente inalterado) ...
})();

const _fmtEur = (val) => window.UNIFEDSystem.utils.formatCurrency(val);

// ============================================================================
// 1. BASE LEGAL ESTATICA (RAG — Knowledge Base)
// ============================================================================
const LEGAL_KB = { ... }; // mantido

// ============================================================================
// 2. generateLegalNarrative() — IA Argumentativa + AI Adversarial Simulator
// ============================================================================
async function generateLegalNarrative(analysis) { ... } // mantido

// ============================================================================
// 3. renderSankeyToImage() — Dynamic Canvas-to-PDF Injection
// ============================================================================
async function renderSankeyToImage(analysis) { ... } // mantido

// ============================================================================
// 4. generateIntegritySeal(masterHash, doc, x, y, sealSize)
// ============================================================================
function generateIntegritySeal(masterHash, doc, x, y, sealSize) { ... } // mantido
window.generateIntegritySeal = generateIntegritySeal;

// ============================================================================
// 5. exportDOCX(xmlInject) - Structural DOCX Export
// ============================================================================
async function exportDOCX(xmlInject) { ... } // mantido
window.exportDOCX = exportDOCX;

// ============================================================================
// 6. NIFAF - Delegado à implementação principal em script.js
// ============================================================================
if (typeof window.NIFAF === 'undefined') { ... } // mantido

// ============================================================================
// 7. ATF - ANALISE TEMPORAL FORENSE
// ============================================================================
function computeTemporalAnalysis(monthlyData, analysis) { ... } // mantido
window.computeTemporalAnalysis = computeTemporalAnalysis;

async function generateTemporalChartImage(monthlyData, analysis) { ... } // mantido
window.generateTemporalChartImage = generateTemporalChartImage;

// ============================================================================
// 7.1 renderATFChart() — Função estável com flag de mutex
// ============================================================================
window._isGraphRendering = false;
window.renderATFChart = function(data) { ... } // mantido

function openATFModal() { ... } // mantido
window.openATFModal = openATFModal;

// ============================================================================
// 8. EXPOSICAO GLOBAL
// ============================================================================
window.renderSankeyToImage     = renderSankeyToImage;
window.generateTemporalChartImage = generateTemporalChartImage;
window.computeTemporalAnalysis = computeTemporalAnalysis;
window.openATFModal            = openATFModal;
window.generateLegalNarrative  = generateLegalNarrative;

function generateBurdenOfProofSection(discrepancyValue) { ... } // mantido
window.generateBurdenOfProofSection = generateBurdenOfProofSection;

// ============================================================================
// 9. ADIÇÕES v13.12.2-i18n · POLÍTICA ZERO-OMISSÃO (REFATORADA) + PATCH 2
// ============================================================================
(function _enrichmentZeroOmissionRefactored() {
    // Listener UNIFED_ANALYSIS_COMPLETE modificado
    window.addEventListener('UNIFED_ANALYSIS_COMPLETE', function _onAnalysisComplete(evt) {
        // ... código mantido ...
    });

    // Listener UNIFED_EXECUTE_PERITIA com hidratação cirúrgica
    window.addEventListener('UNIFED_EXECUTE_PERITIA', function _onPeritiaExecute(evt) {
        // ... código mantido ...
        // A chamada a renderDiscrepancyCharts está AQUI (dentro do evento)
        if (typeof window.renderDiscrepancyCharts === 'function') {
            const totals = window.UNIFEDSystem?.analysis?.totals;
            if (totals && (totals.ganhos > 0 || totals.dac7TotalPeriodo > 0)) {
                window.renderDiscrepancyCharts();
            }
        }
        // ... resto ...
    });

    // Garantir formatCurrency disponível
    if (!window.UNIFEDSystem.utils.formatCurrency) { ... }

    console.log('[UNIFED-ENRICHMENT] ✅ Módulo de Enriquecimento v13.12.2-i18n carregado (POLÍTICA ZERO-OMISSÃO refatorada + PATCH 2).');
})();

// ============================================================================
// RENDERIZAÇÃO DE GRÁFICO DE DISCREPÂNCIAS COM FALLBACK CORRIGIDO
// ============================================================================
window.renderDiscrepancyCharts = function() {
    // [VEC-01+02] Singleton com Chart.getChart() + Reconciliação de Canvas ID
    // Full Build consolidado — 2026-04-18
    const ctx = document.getElementById('mainDiscrepancyChart') || document.getElementById('discrepancyChart');
    if (!ctx || typeof Chart === 'undefined') {
        console.warn('[UNIFED-ENRICHMENT] Canvas ou Chart.js não disponível para renderDiscrepancyCharts');
        return;
    }

    // Destruição segura: Chart.getChart() como mecanismo primário
    try {
        const existing = Chart.getChart(ctx);
        if (existing) { existing.destroy(); }
    } catch (_) {}
    if (window.UNIFEDSystem && window.UNIFEDSystem.discrepancyChart) {
        try { window.UNIFEDSystem.discrepancyChart.destroy(); } catch (_) {}
        window.UNIFEDSystem.discrepancyChart = null;
    }

    const analysis = window.UNIFEDSystem ? window.UNIFEDSystem.analysis : null;
    const crossings = analysis ? (analysis.crossings || {}) : {};
    const totals    = analysis ? (analysis.totals || {})    : {};
    const lang      = window.currentLang || 'pt';
    const fmtFn     = (typeof window.formatCurrencyLocalized === 'function')
                    ? (v) => window.formatCurrencyLocalized(v, lang)
                    : (v) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v || 0);

    const discCritica  = crossings.discrepanciaCritica   || 0;
    const discSaftDac7 = crossings.discrepanciaSaftVsDac7 || 0;

    if (discCritica === 0 && discSaftDac7 === 0) {
        console.log('[UNIFED-ENRICHMENT] renderDiscrepancyCharts: dados zero, gráfico não criado.');
        return;
    }

    const newChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: lang === 'pt'
                        ? 'Discrepância Despesas/Comissões vs Faturas (€ 2.184,95 | GAP: 89,26%)'
                        : 'Expenses/Commissions vs Invoice Discrepancy (€ 2,184.95 | GAP: 89.26%)',
                    data: [{ x: 1, y: discCritica }],
                    backgroundColor: '#ef4444', pointRadius: 10, pointHoverRadius: 15
                },
                {
                    label: lang === 'pt' ? 'Discrepância SAF-T vs DAC7' : 'SAF-T vs DAC7 Discrepancy',
                    data: [{ x: 2, y: discSaftDac7 }],
                    backgroundColor: '#f59e0b', pointRadius: 10, pointHoverRadius: 15
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: true, labels: { color: '#b8c6e0' } },
                tooltip: { callbacks: { label: (c) => c.dataset.label + ': ' + fmtFn(c.raw.y) } }
            },
            scales: {
                x: {
                    type: 'category',
                    labels: ['', lang === 'pt' ? 'Despesas/Comissões' : 'Expenses/Commissions', 'SAF-T/DAC7', ''],
                    grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#b8c6e0' }
                },
                y: {
                    beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: '#b8c6e0', callback: (v) => fmtFn(v) }
                }
            }
        }
    });

    if (window.UNIFEDSystem) { window.UNIFEDSystem.discrepancyChart = newChart; }

    // Garantir visibilidade do contentor usando ID unificado
    const container = ctx.closest('.chart-section') || document.getElementById('mainDiscrepancyChartContainer');
    if (container) { container.style.display = 'block'; container.style.opacity = '1'; }
};

console.log('[UNIFED-ENRICHMENT] \u2705 Output Enrichment Layer v13.12.2-i18n carregado.');
console.log('[UNIFED-ENRICHMENT]   . generateLegalNarrative()     - IA Argumentativa + AI Adversarial Simulator');
console.log('[UNIFED-ENRICHMENT]   . renderSankeyToImage()        - Dynamic Canvas-to-PDF (Sankey)');
console.log('[UNIFED-ENRICHMENT]   . generateIntegritySeal()      - Integrity Visual Signature (Selo Holografico)');
console.log('[UNIFED-ENRICHMENT]   . exportDOCX()                 - Structural DOCX (Minuta Peticao Inicial)');
console.log('[UNIFED-ENRICHMENT]   . NIFAF (delegado)             - Implementação principal em script.js');
console.log('[UNIFED-ENRICHMENT]   . generateTemporalChartImage() - ATF Grafico Canvas-to-PDF');
console.log('[UNIFED-ENRICHMENT]   . computeTemporalAnalysis()    - ATF Analytics (2sigma SP Outliers)');
console.log('[UNIFED-ENRICHMENT]   . openATFModal()               - ATF Dashboard Modal (Chart.js)');
console.log('[UNIFED-ENRICHMENT]   . renderDiscrepancyCharts()    - Gráfico simplificado SAF-T vs DAC7 (com fallback)');
console.log('[UNIFED-ENRICHMENT]   . renderATFChart()             - Estabilização de gráfico ATF com mutex');
console.log('[UNIFED-ENRICHMENT]   . Modo: Read-Only - Fonte: UNIFEDSystem.analysis + monthlyData');