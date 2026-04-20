/**
 * UNIFED - PROBATUM · v13.12.2-i18n · MÓDULO DE EXPORTAÇÃO — TRÍADE DOCUMENTAL
 * ============================================================================
 * Ficheiro      : unifed_triada_export.js
 * Versão        : 1.0.21-TRIADA-FIX (Restauro de toolbar + força revelação)
 * ============================================================================
 */

'use strict';

(function _unifedTriadaModule() {
    const _VERSION = '1.0.21-TRIADA-FIX';

    function _log(msg, type = 'log') { ... } // mantido

    function getStableMasterHash() { ... } // mantido

    function _resolveLabels() { ... } // mantido

    async function gerarAnexoCustodia() { ... } // mantido

    function restoreOriginalToolbar() { ... } // mantido

    function initInterface() { ... } // mantido

    function _startMutationObserver() { ... } // mantido

    // Registo global das funções
    window.addEventListener('UNIFED_CORE_READY', function _triadaRegisterGlobals() {
        window.gerarAnexoCustodia     = gerarAnexoCustodia;
        window.initTriadaButtons      = initInterface;
        window._restoreOriginalToolbar = restoreOriginalToolbar;
        window.UNIFEDSystem           = window.UNIFEDSystem || {};
        window.UNIFEDSystem.triadaUpdateLabels = initInterface;
        _log('Funções globais registadas em UNIFED_CORE_READY (sem DOM manipulation).');
    }, { once: true });

    // Injecção de UI após compliance
    window.addEventListener('unifed:compliance:accepted', function _triadaActivateUI() {
        _log('FIX-TR-01 · unifed:compliance:accepted recebido — iniciando injecção de UI da Tríade.');
        if (initInterface()) return;
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                if (!initInterface()) _startMutationObserver();
            }, { once: true });
        } else {
            if (!initInterface()) _startMutationObserver();
        }
    }, { once: true });

    _log(`Módulo Tríade Documental ${_VERSION} carregado com sucesso. Aguarda unifed:compliance:accepted para activação de UI.`, 'success');
})();

// =============================================================================
// [PATCH #5] REFORÇO DE IDEMPOTÊNCIA DA TRÍADE – COM BLOQUEIO REMOVIDO
// =============================================================================
(function _enhanceTriadaIdempotency() {
    const _originalInitTriada = window.initTriadaButtons || function() {};

    window.initTriadaButtons = function() {
        // =============================================================
        // BLOQUEIO DE IDEMPOTÊNCIA REMOVIDO PARA PERMITIR REINICIALIZAÇÃO
        // =============================================================
        // if (window._UNIFED_TRIADA_INITIALIZED === true) {
        //     console.log('[UNIFED-TRIADA] ✓ Tríade já inicializada. Ignorando re-inicialização.');
        //     return true;
        // }

        const result = _originalInitTriada();

        // Ainda marcamos como inicializada para evitar loops excessivos,
        // mas a verificação acima foi removida.
        if (result === true || result === false) {
            window._UNIFED_TRIADA_INITIALIZED = true;
        }
        return result;
    };

    if (window.UNIFEDSystem) {
        window.UNIFEDSystem.triadaUpdateLabels = window.initTriadaButtons;
    }

    console.log('[UNIFED-TRIADA] ✓ Camada de idempotência instalada com BLOQUEIO REMOVIDO (reinicialização permitida).');
})();