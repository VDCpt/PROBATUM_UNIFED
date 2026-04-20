/**
 * UNIFED - PROBATUM · CASO REAL ANONIMIZADO v13.12.3 (FIX DEMO + RAW DATA VISIBILITY)
 * ============================================================================
 * ... (cabeçalho mantido) ...
 */

(function() {
    'use strict';

    // ... (todo o código até à definição de _executePendingAnalysis mantido) ...

    // =========================================================================
    // FUNÇÃO CORRIGIDA: _executePendingAnalysis – única responsável por ativar a análise
    // =========================================================================
    async function _executePendingAnalysis() {
        if (!window._unifedAnalysisPending) {
            console.log('[UNIFED] Nenhuma análise pendente ou já executada.');
            return;
        }
        console.log('[UNIFED] Executando análise forense pendente...');
        const sys = window.UNIFEDSystem;
        if (!sys || !sys.analysis || !sys.analysis.totals) {
            console.warn('[UNIFED] Dados insuficientes para executar a análise.');
            return;
        }

        // 1. Executar o motor de cruzamento forense (performForensicCrossings)
        if (typeof window.performForensicCrossings === 'function') {
            await window.performForensicCrossings();
        } else {
            // Fallback: calcular crossings localmente (código mantido)
            // ...
        }

        // 2. Atualizar flags de estado
        window._unifedRawDataOnly = false;
        window._unifedAnalysisPending = false;

        // 3. Revelar módulos forenses e renderizar gráficos
        if (typeof window.updateForensicModulesVisibility === 'function') {
            window.updateForensicModulesVisibility(true);
        }

        if (typeof window.UNIFED_INTERNAL?.syncMetrics === 'function') {
            window.UNIFED_INTERNAL.syncMetrics();
        }
        if (typeof window.UNIFED_INTERNAL?.renderMatrix === 'function') {
            window.UNIFED_INTERNAL.renderMatrix();
        }
        if (typeof window.UNIFED_INTERNAL?.updateAuxiliaryUI === 'function') {
            window.UNIFED_INTERNAL.updateAuxiliaryUI();
        }

        // 4. Disparar eventos globais – a renderização dos gráficos será feita pelos listeners destes eventos
        window.dispatchEvent(new CustomEvent('UNIFED_ANALYSIS_COMPLETE', {
            detail: { timestamp: Date.now(), source: 'executePendingAnalysis', sessionId: sys.sessionId || 'N/A', masterHash: sys.masterHash || 'N/A' }
        }));
        window.dispatchEvent(new CustomEvent('UNIFED_EXECUTE_PERITIA', {
            detail: { timestamp: new Date().toISOString(), masterHash: sys.masterHash || 'N/A' }
        }));

        console.log('[UNIFED] Análise forense concluída e UI atualizada.');
    }

    // =========================================================================
    // NOVA GARANTIA: O listener UNIFED_EXECUTE_PERITIA já existe em enrichment.js
    // e chama renderDiscrepancyCharts. Garantimos que não há chamada antecipada.
    // =========================================================================

    // ... (restante do código, incluindo forceBindAnalyze, mantido) ...

    // Dentro de forceBindAnalyze, removemos qualquer chamada direta a renderDiscrepancyCharts
    function forceBindAnalyze() {
        const btn = document.getElementById('analyzeBtn');
        if (!btn) return;
        btn.disabled = false;
        btn.onclick = null;
        btn.addEventListener('click', async function _ret08Handler(e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            // ... (código de execução da perícia) ...
            // NÃO CHAMAR renderDiscrepancyCharts AQUI
            // Apenas disparar os eventos e deixar os listeners fazerem o trabalho
            window.dispatchEvent(new CustomEvent('UNIFED_EXECUTE_PERITIA', { detail: { timestamp: new Date().toISOString() } }));
            window.dispatchEvent(new CustomEvent('UNIFED_ANALYSIS_COMPLETE', { detail: { source: 'RET-08', timestamp: Date.now() } }));
        }, true);
    }

    // ... (restante do ficheiro inalterado) ...
})();