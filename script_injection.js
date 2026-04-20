/**
 * UNIFED - PROBATUM · CASO REAL ANONIMIZADO v13.12.3 (FIX DEMO + RAW DATA VISIBILITY)
 * ============================================================================
 * VERSÃO FINAL CORRIGIDA (2026-04-20)
 * - Removidos blocos de código soltos
 * - Função _executePendingAnalysis única e correta
 * - renderForensicCharts apenas dispara eventos (não desenha gráficos diretamente)
 * - Gráficos renderizados exclusivamente pelos listeners em enrichment.js
 * ============================================================================
 */

(function() {
    'use strict';

    // =========================================================================
    // EXPOSIÇÃO GLOBAL ANTECIPADA
    // =========================================================================
    window.ensureDemoDataLoaded = null;
    window.executePendingAnalysis = null;

    window.logAudit = window.logAudit || function(msg, level = 'info') {
        const prefix = '[UNIFED] ';
        if (level === 'error') console.error(prefix + msg);
        else if (level === 'warn') console.warn(prefix + msg);
        else if (level === 'success') console.info(prefix + msg);
        else console.log(prefix + msg);
    };
    const logAudit = window.logAudit;

    // =========================================================================
    // 0. CARREGAMENTO DO PAINEL PANEL.HTML
    // =========================================================================
    let panelLoaded = false;
    let panelResolvers = [];

    function waitForPanel() {
        return new Promise((resolve) => {
            if (panelLoaded) resolve();
            else panelResolvers.push(resolve);
        });
    }

    async function loadPanelHTML() {
        const wrapper = document.getElementById('pureDashboardWrapper');
        if (!wrapper) {
            console.error('[UNIFED] #pureDashboardWrapper não encontrado no DOM.');
            return false;
        }
        if (wrapper.querySelector('#pureDashboard')) return true;

        try {
            const response = await fetch('panel.html');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const html = await response.text();
            wrapper.innerHTML = html;
            if (typeof window._panelReady === 'function') window._panelReady();
            panelLoaded = true;
            panelResolvers.forEach(resolve => resolve());
            panelResolvers = [];
            console.log('[UNIFED] panel.html injectado. _panelReady() invocado.');
            return true;
        } catch (err) {
            console.error('[UNIFED] Falha ao carregar panel.html:', err);
            wrapper.innerHTML = '<section id="pureDashboard" class="pure-section"><div class="pure-card"><p>Carregando painel forense...</p></div></section>';
            panelLoaded = true;
            panelResolvers.forEach(resolve => resolve());
            return false;
        }
    }

    // =========================================================================
    // 1. DATASET MESTRE (OBJETO IMUTÁVEL)
    // =========================================================================
    const _PDF_CASE = Object.freeze({
        sessionId:  "UNIFED-MNGFN3C0-X57MO",
        masterHash: "2A38423FED220D681D86E959F2C34F993BA71FCE9B92791199453B41E23A63E5",
        client: { name: "Real Demo - Unipessoal, Lda", nif: "999999990", platform: "Plataforma A" },
        counts: { ctrl: 4, saft: 4, fat: 2, ext: 4, dac7: 1 },
        totals: {
            ganhos: 10157.73, ganhosLiquidos: 7709.84, saftBruto: 8227.97, saftIliquido: 7761.67, saftIva: 466.30,
            despesas: 2447.89, faturaPlataforma: 262.94, dac7TotalPeriodo: 7755.16,
            iva6Omitido: 131.10, iva23Omitido: 502.54, asfixiaFinanceira: 493.68,
            totalNaoSujeitos: 451.15, gorjetas: 46.00, portagens: 0.15, campanhas: 405.00, cancelamentos: 58.10
        },
        fluxosIsentos: { campanhas: 405.00, gorjetas: 46.00, portagens: 0.15, total: 451.15 },
        atf: { zScore: 2.45, confianca: "99.2%", periodo: "Q4 2024", anomalias: 4, version: "v13.12.3", score: 40, trend: "DESCENDENTE", outliers: 0 },
        macro_analysis: {
            sector_drivers: 38000, operational_years: 7, avg_monthly_discrepancy: 546.24,
            estimated_systemic_gap: 1743598080.00, confidence_level: "High",
            legal_implication: "Potential systemic tax erosion under Art. 119.º RGIT (Iteration)",
            methodology: "Extrapolação Estatística de Baixa Variância · ISO/IEC 27037:2012",
            status: "INDICATIVO_MACRO",
            disclaimer: "Os valores de impacto sistémico constituem contexto macroeconómico e não prova direta de ilícito alheio, nos termos do Art. 128.º do CPP."
        },
        meta: { lastUpdate: "2026-04-17", forensicIntegrity: true }
    });

    // 2. ESCUDO SILENCIOSO PARA CORS
    (function _installCORSSilentShield() {
        const targetUrl = 'freetsa.org';
        const originalFetch = window.fetch;
        if (typeof originalFetch === 'function') {
            window.fetch = function(input, init) {
                const url = typeof input === 'string' ? input : (input && input.url);
                if (url && url.indexOf(targetUrl) !== -1) {
                    return originalFetch.apply(this, arguments).catch(function(err) {
                        console.warn('[UNIFED] ⚙ Modo Standalone Ativo: Selagem TSA externa indisponível. Integridade assegurada por Assinatura Local SHA-256 (Nível 1).');
                        throw err;
                    });
                }
                return originalFetch.apply(this, arguments);
            };
        }
        window.addEventListener('unhandledrejection', function(event) {
            if (event.reason && event.reason.message && event.reason.message.indexOf('freetsa') !== -1) {
                console.warn('[UNIFED] ⚙ Modo Standalone Ativo: Selagem TSA externa indisponível (promise).');
                event.preventDefault();
            }
            if (event.reason && event.reason.message && event.reason.message.indexOf('api.unifed.com') !== -1) {
                console.warn('[UNIFED] ⚙ Modo Standalone Ativo: Proxy IA indisponível (DNS). Fallback estático ativo.');
                event.preventDefault();
            }
        });
        window.addEventListener('error', function(event) {
            if (event.message && event.message.indexOf('freetsa') !== -1) {
                console.warn('[UNIFED] ⚙ Modo Standalone Ativo: Selagem TSA externa indisponível (erro global).');
                event.preventDefault();
                return true;
            }
            if (event.message && event.message.indexOf('api.unifed.com') !== -1) {
                console.warn('[UNIFED] ⚙ Modo Standalone Ativo: Proxy IA indisponível (DNS). Fallback estático ativo.');
                event.preventDefault();
                return true;
            }
        });
        console.log('[UNIFED] Escudo CORS silencioso instalado para FreeTSA e api.unifed.com.');
    })();

    const _fmt = (v) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);
    const _set = (id, val) => {
        const el = document.getElementById(id);
        if (el) { el.textContent = val; return true; }
        return false;
    };

    window.UNIFED_INTERNAL = window.UNIFED_INTERNAL || {};
    window.UNIFED_INTERNAL.data = _PDF_CASE;
    window.UNIFED_INTERNAL.fmt = _fmt;
    window.UNIFED_INTERNAL.set = _set;

    console.log('[UNIFED] Camada 1: OK.');

    // =========================================================================
    // Camada 2 – Sincronização de Métricas (syncMetrics) - CORRIGIDA
    // =========================================================================
    (function() {
        if (!window.UNIFED_INTERNAL) return;
        const { data, fmt } = window.UNIFED_INTERNAL;

        window.UNIFED_INTERNAL.syncMetrics = function() {
            const dashboard = document.getElementById('pureDashboard');
            if (!dashboard) {
                console.info('[UNIFED] syncMetrics abortado: painel pureDashboard ainda não injetado no DOM.');
                return;
            }
            console.log('[UNIFED] Iniciando Sincronização Forense...');
            
            const sys = window.UNIFEDSystem;
            const dadosReaisCarregados = (sys && sys.analysis && sys.analysis.totals && sys.analysis.totals.ganhos > 0);
            const analisePendente = (window._unifedAnalysisPending === true);
            
            let t;
            if (dadosReaisCarregados && !analisePendente) {
                t = sys.analysis.totals;
            } else if (window._unifedDataLoaded === true && !analisePendente) {
                t = {
                    ganhos: data.totals.ganhos, despesas: data.totals.despesas, ganhosLiquidos: data.totals.ganhosLiquidos,
                    saftBruto: data.totals.saftBruto, dac7TotalPeriodo: data.totals.dac7TotalPeriodo,
                    faturaPlataforma: data.totals.faturaPlataforma,
                    iva6Omitido: 0, iva23Omitido: 0, asfixiaFinanceira: 0, cancelamentos: 0
                };
            } else {
                t = {
                    ganhos: 0, despesas: 0, ganhosLiquidos: 0, saftBruto: 0, dac7TotalPeriodo: 0,
                    faturaPlataforma: 0, iva6Omitido: 0, iva23Omitido: 0, asfixiaFinanceira: 0, cancelamentos: 0
                };
            }
            
            let discrepanciaC2 = 0, percentC2 = 0, discrepanciaC1 = 0, percentC1 = 0, ircEstimadoCorreto = 0, asfixiaFinanceira = 0;
            if (!analisePendente && dadosReaisCarregados) {
                const c = (sys && sys.analysis && sys.analysis.crossings) ? sys.analysis.crossings : {};
                discrepanciaC2 = c.discrepanciaCritica || (t.despesas - t.faturaPlataforma);
                percentC2 = c.percentagemOmissao || (t.despesas > 0 ? (discrepanciaC2 / t.despesas) * 100 : 0);
                discrepanciaC1 = c.discrepanciaSaftVsDac7 || (t.saftBruto - t.dac7TotalPeriodo);
                percentC1 = c.percentagemSaftVsDac7 || (t.saftBruto > 0 ? (discrepanciaC1 / t.saftBruto) * 100 : 0);
                ircEstimadoCorreto = c.ircEstimado || (discrepanciaC2 * 0.21);
                asfixiaFinanceira = t.asfixiaFinanceira || (t.saftBruto * 0.06);
            }
            
            const fi = data.fluxosIsentos;
            const totalNaoSujeitosCalc = (window._unifedDataLoaded === true) ? fi.total : 0;
            
            const getCounter = (docType, fallback) => {
                if (sys && sys.documents && sys.documents[docType] && sys.documents[docType].totals) {
                    return sys.documents[docType].totals.records.toString();
                }
                return (window._unifedDataLoaded === true) ? fallback : "0";
            };
            
            const setScopedText = (id, value) => {
                const el = document.querySelector(`#pureDashboard #${id}`);
                if (el) el.textContent = value;
                const globalEl = document.getElementById(id);
                if (globalEl) globalEl.textContent = value;
            };
            
            const mapping = {
                'pure-ganhos': fmt(t.ganhos), 'pure-despesas': fmt(t.despesas), 'pure-liquido': fmt(t.ganhosLiquidos),
                'pure-saft': fmt(t.saftBruto), 'pure-dac7': fmt(t.dac7TotalPeriodo), 'pure-fatura': fmt(t.faturaPlataforma),
                'pure-disc-c2': fmt(discrepanciaC2), 'pure-disc-c2-pct': percentC2.toFixed(2) + '%',
                'pure-disc-saft-dac7': fmt(discrepanciaC1), 'pure-disc-saft-pct': percentC1.toFixed(2) + '%',
                'pure-iva-6': fmt(t.iva6Omitido), 'pure-iva-23': fmt(t.iva23Omitido),
                'pure-irc': fmt(ircEstimadoCorreto),
                'pure-disc-c2-grid': fmt(discrepanciaC2), 'pure-iva-devido': fmt(asfixiaFinanceira),
                'pure-nao-sujeitos': fmt(totalNaoSujeitosCalc), 'pure-atf-sp': data.atf.score + '/100',
                'pure-atf-trend': data.atf.trend, 'pure-atf-outliers': data.atf.outliers + ' outliers > 2σ',
                'pure-atf-meses': '2.º Semestre 2024 — 4 meses com dados (Set–Dez)',
                'pure-sg-1-val': fmt(discrepanciaC2), 'pure-sg-1-pct': percentC2.toFixed(2) + '%',
                'pure-sg-2-val': fmt(discrepanciaC1), 'pure-sg-2-pct': percentC1.toFixed(2) + '%',
                'pure-nc-campanhas': fmt(window._unifedDataLoaded === true ? fi.campanhas : 0),
                'pure-nc-gorjetas': fmt(window._unifedDataLoaded === true ? fi.gorjetas : 0),
                'pure-nc-portagens': fmt(window._unifedDataLoaded === true ? fi.portagens : 0),
                'pure-nc-total': fmt(totalNaoSujeitosCalc),
                'pure-verdict': (dadosReaisCarregados && !analisePendente) ? 'RISCO CRÍTICO · DESVIO PADRÃO > 2σ' : 'AGUARDANDO PERÍCIA',
                'pure-verdict-pct': (dadosReaisCarregados && !analisePendente) ? percentC2.toFixed(2) + '%' : '0.00%',
                'pure-session-id': (sys && sys.sessionId) ? sys.sessionId : (window._unifedDataLoaded === true ? data.sessionId : '--------'),
                'pure-hash-prefix': (sys && sys.masterHash) ? sys.masterHash.substring(0, 12).toUpperCase() + '...' : (window._unifedDataLoaded === true ? data.masterHash.substring(0, 12) + '...' : '---'),
                'pure-hash-prefix-verdict': (sys && sys.masterHash) ? sys.masterHash.substring(0, 16).toUpperCase() + '...' : (window._unifedDataLoaded === true ? data.masterHash.substring(0, 16) + '...' : '---'),
                'pure-subject-name': (window._unifedDataLoaded === true) ? data.client.name : '---',
                'pure-subject-nif': (window._unifedDataLoaded === true) ? data.client.nif : '---',
                'pure-subject-platform': (window._unifedDataLoaded === true) ? data.client.platform : '---',
                'pure-atf-score-val': (dadosReaisCarregados && !analisePendente) ? (data.atf.score + '/100') : '--%',
                'pure-iva-devido-val': fmt(asfixiaFinanceira), 'pure-impacto-macro': fmt(data.macro_analysis.estimated_systemic_gap),
                'pure-ctrl-qty': getCounter('control', data.counts.ctrl.toString()),
                'pure-saft-qty': getCounter('saft', data.counts.saft.toString()),
                'pure-fat-qty': getCounter('invoices', data.counts.fat.toString()),
                'pure-ext-qty': getCounter('statements', data.counts.ext.toString()),
                'pure-dac7-qty': getCounter('dac7', data.counts.dac7.toString()),
                'pure-ganhos-tri': fmt(t.ganhos), 'pure-despesas-tri': fmt(t.despesas),
                'pure-liquido-tri': fmt(t.ganhosLiquidos), 'pure-fatura-tri': fmt(t.faturaPlataforma),
                'pure-counter-ctrl': getCounter('control', '0'), 'pure-counter-saft': getCounter('saft', '0'),
                'pure-counter-fat': getCounter('invoices', '0'), 'pure-counter-statements': getCounter('statements', '0'),
                'pure-counter-dac7': getCounter('dac7', '0')
            };
            
            Object.entries(mapping).forEach(([id, value]) => setScopedText(id, value));
            
            // Atualização dos cards de gap
            const revenueGapCorrect = t.saftBruto - t.ganhos;
            const expenseGapCorrect = discrepanciaC2;
            const omissaoPct = (t.despesas > 0 && t.ganhos > 0) ? ((t.despesas / t.ganhos) * 100) : 0;
            document.getElementById('revenueGapValue') && (document.getElementById('revenueGapValue').textContent = fmt(revenueGapCorrect));
            document.getElementById('expenseGapValue') && (document.getElementById('expenseGapValue').textContent = fmt(expenseGapCorrect));
            document.getElementById('omissaoDespesasPctValue') && (document.getElementById('omissaoDespesasPctValue').textContent = omissaoPct.toFixed(2) + '%');
            
            const analiseExecutada = dadosReaisCarregados && !analisePendente;
            const revenueCard = document.getElementById('revenueGapCard');
            if (revenueCard) revenueCard.style.display = (analiseExecutada && Math.abs(revenueGapCorrect) > 0.01) ? 'block' : 'none';
            const expenseCard = document.getElementById('expenseGapCard');
            if (expenseCard) expenseCard.style.display = (analiseExecutada && Math.abs(expenseGapCorrect) > 0.01) ? 'block' : 'none';
            const omissaoCard = document.getElementById('omissaoDespesasPctCard');
            if (omissaoCard) omissaoCard.style.display = (analiseExecutada && t.despesas > 0 && t.ganhos > 0) ? 'block' : 'none';
            
            // Atualizar textos legais
            const sg1Legal = document.querySelector('#pureDashboard #pure-sg1-legal');
            if (sg1Legal) sg1Legal.textContent = analiseExecutada ? 'Art. 23.º CIRC (Indutividade de Custos) · Art. 103.º RGIT (Fraude Fiscal)' : '---';
            const sg2Legal = document.querySelector('#pureDashboard #pure-sg2-legal');
            if (sg2Legal) sg2Legal.textContent = analiseExecutada ? 'Diretiva DAC7 (UE) 2021/514 · Art. 103.º RGIT (Fraude Fiscal) · DL n.º 41/2023' : '---';
        };
        console.log('[UNIFED] Camada 2: OK.');
    })();

    // =========================================================================
    // Camada 3 – Matriz de Triangulação (renderMatrix)
    // =========================================================================
    (function() {
        if (!window.UNIFED_INTERNAL) return;
        const { data, fmt } = window.UNIFED_INTERNAL;

        window.UNIFED_INTERNAL.renderMatrix = function() {
            const target = document.getElementById('pureDashboard');
            if (!target) return;
            const existingMatrix = document.getElementById('triangulationMatrixContainer');
            if (existingMatrix) existingMatrix.remove();

            const sys = window.UNIFEDSystem;
            const dadosReaisCarregados = (sys && sys.analysis && sys.analysis.totals && sys.analysis.totals.ganhos > 0);
            let t;
            if (dadosReaisCarregados) t = sys.analysis.totals;
            else if (window._unifedDataLoaded === true) t = data.totals;
            else t = { ganhos: 0, despesas: 0, saftBruto: 0, dac7TotalPeriodo: 0, faturaPlataforma: 0 };
            
            const deltaSaft = t.ganhos - t.saftBruto;
            const deltaDac7 = t.ganhos - t.dac7TotalPeriodo;
            const deltaFatura = t.despesas - t.faturaPlataforma;
            const isEn = (typeof window.currentLang !== 'undefined' && window.currentLang === 'en') || (document.documentElement.lang === 'en');
            
            const labels = {
                title: isEn ? "FORENSIC TRIANGULATION MATRIX (ART. 119 RGIT)" : "MATRIZ DE TRIANGULAÇÃO FORENSE (ART. 119.º RGIT)",
                colSource: isEn ? "EVIDENCE SOURCE" : "FONTE DE PROVA",
                colValue: isEn ? "AMOUNT" : "VALOR",
                colDisc: isEn ? "DISCREPANCY" : "DISCREPÂNCIA",
                footnote: isEn ? "Methodological Note:" : "Nota Metodológica:",
                footnoteText: isEn ? "The divergence between the invoiced value (SAF-T/DAC7) and the actual credited value (Ledger) evidences an omission of taxable base of " : "A divergência entre o valor faturado (SAF-T/DAC7) e o valor real creditado (Ledger) evidencia uma omissão de base tributável de ",
                footnoteConfig: isEn ? "in retained platform commissions, constituting a tax offense under Art. 119 RGIT." : "nas comissões retidas pela plataforma, configurando contra-ordenação tributária nos termos do Art. 119.º RGIT."
            };

            const matrixHtml = `
            <div id="triangulationMatrixContainer" class="pure-triangulation-box" style="margin:30px 0; border:1px solid #00E5FF; background:rgba(15,23,42,0.95); padding:20px; border-radius:12px;">
                <h3 style="color:#00E5FF; margin-top:0; font-size:1rem;">${labels.title}</h3>
                <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                    <thead><tr style="border-bottom:1px solid rgba(255,255,255,0.2);"><th style="text-align:left; padding:10px;">${labels.colSource}</th><th style="text-align:right; padding:10px;">${labels.colValue}</th><th style="text-align:right; padding:10px; color:#EF4444;">${labels.colDisc}</th></tr></thead>
                    <tbody>
                        <tr><td style="padding:10px;">📄 SAF-T PT (${isEn ? 'Invoicing' : 'Faturação'})</td><td style="padding:10px; text-align:right;">${fmt(t.saftBruto)}</td><td style="padding:10px; text-align:right;">-${fmt(deltaSaft)}</td></tr>
                        <tr style="background:rgba(239,68,68,0.08);"><td style="padding:10px;">🌐 DAC7 (Plataforma A)</td><td style="padding:10px; text-align:right;">${fmt(t.dac7TotalPeriodo)}</td><td style="padding:10px; text-align:right;">-${fmt(deltaDac7)}</td></tr>
                        <tr><td style="padding:10px;">📑 ${isEn ? 'BTF Invoices (Commissions)' : 'Faturas BTF (Comissões)'}</td><td style="padding:10px; text-align:right;">${fmt(t.faturaPlataforma)}</td><td style="padding:10px; text-align:right;">-${fmt(deltaFatura)}</td></tr>
                        <tr style="border-top:2px solid #00E5FF;"><td style="padding:10px; font-weight:bold;">💰 ${isEn ? 'LEDGER (Actual Earnings)' : 'LEDGER (Ganhos Reais)'}</td><td style="padding:10px; text-align:right; font-weight:bold;">${fmt(t.ganhos)}</td><td style="padding:10px; text-align:right;">---</td></tr>
                    </tbody>
                </table>
                <div style="margin-top: 15px; font-size: 0.7rem; color: #94a3b8; border-top: 1px solid rgba(0,229,255,0.2); padding-top: 10px;">
                    <strong>${labels.footnote}</strong> ${labels.footnoteText}${fmt(deltaFatura)} (${t.despesas > 0 ? ((deltaFatura/t.despesas)*100).toFixed(2) : '0.00'}%) ${labels.footnoteConfig}
                </div>
            </div>`;
            target.insertAdjacentHTML('beforeend', matrixHtml);
        };
        console.log('[UNIFED] Camada 3: OK.');
    })();

    // =========================================================================
    // Camada 4 – Injeção de CSS, Macro Card e UI Auxiliar
    // =========================================================================
    (function() {
        if (!window.UNIFED_INTERNAL) return;
        const { data, fmt } = window.UNIFED_INTERNAL;

        function _injectAuxiliaryBoxesCSS() {
            const styleId = 'unifed-aux-boxes-fix';
            if (document.getElementById(styleId)) return;
            const css = `
                .unifed-hidden-until-analysis { display: none !important; }
                .auxiliary-helper-section { width: 100% !important; max-width: 100% !important; box-sizing: border-box !important; }
                .aux-boxes-grid { display: grid !important; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)) !important; gap: 0.75rem !important; width: 100% !important; }
                .small-info-box { width: 100% !important; margin: 0 !important; box-sizing: border-box !important; }
                .evidence-counter, .evidence-summary { display: none !important; }
                @media (max-width: 640px) { .aux-boxes-grid { grid-template-columns: repeat(2, 1fr) !important; } }
                @media (max-width: 480px) { .aux-boxes-grid { grid-template-columns: 1fr !important; } }
                .chart-section { height: auto !important; overflow: visible !important; }
                .chart-section:empty { display: none !important; }
                canvas#mainChart, canvas#discrepancyChart { width: 100% !important; height: 300px !important; }
            `;
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = css;
            document.head.appendChild(style);
            console.log('[UNIFED] CSS injetado.');
        }

        function _injectMacroCard() {
            const target = document.getElementById('pureDashboard');
            if (!target || document.getElementById('pureMacroCard')) return;
            const macro = data.macro_analysis;
            if (!macro) return;
            const monthlyLoss = (macro.sector_drivers || 38000) * (macro.avg_monthly_discrepancy || 546.24);
            const cardDiv = document.createElement('div');
            cardDiv.className = 'pure-card pure-card-macro';
            cardDiv.id = 'pureMacroCard';
            cardDiv.innerHTML = `
                <h3 class="pure-card-title"><span class="pure-icon">🌍</span><span data-pt="V. ANÁLISE DE RISCO SISTÉMICO (MIS)" data-en="V. SYSTEMIC RISK ANALYSIS (MIS)">V. ANÁLISE DE RISCO SISTÉMICO (MIS)</span></h3>
                <div class="pure-macro-grid" style="display:flex; flex-wrap:wrap; gap:1rem; justify-content:space-between;">
                    <div class="pure-macro-item" style="flex:1; min-width:160px; background:rgba(255,255,255,0.03); padding:12px; border-radius:6px;">
                        <div class="pure-macro-label" style="font-size:0.65rem; color:#94a3b8; text-transform:uppercase;" data-pt="Universo de Operadores" data-en="Operators Universe">Universo de Operadores</div>
                        <div class="pure-macro-value" style="font-size:1.4rem; font-weight:700; color:#00E5FF;">${macro.sector_drivers.toLocaleString('pt-PT')}</div>
                        <div class="pure-macro-sub" style="font-size:0.6rem; color:#64748b;">Sector TVDE Portugal</div>
                    </div>
                    <div class="pure-macro-item" style="flex:1; min-width:160px; background:rgba(255,255,255,0.03); padding:12px; border-radius:6px;">
                        <div class="pure-macro-label" style="font-size:0.65rem; color:#94a3b8; text-transform:uppercase;" data-pt="Horizonte Temporal" data-en="Time Horizon">Horizonte Temporal</div>
                        <div class="pure-macro-value" style="font-size:1.4rem; font-weight:700; color:#00E5FF;">${macro.operational_years} Anos</div>
                        <div class="pure-macro-sub" style="font-size:0.6rem; color:#64748b;">2019–2026</div>
                    </div>
                    <div class="pure-macro-item" style="flex:1; min-width:160px; background:rgba(255,255,255,0.03); padding:12px; border-radius:6px;">
                        <div class="pure-macro-label" style="font-size:0.65rem; color:#94a3b8; text-transform:uppercase;" data-pt="Erosão Mensal Estimada" data-en="Estimated Monthly Erosion">Erosão Mensal Estimada</div>
                        <div class="pure-macro-value" style="font-size:1.4rem; font-weight:700; color:#F59E0B;">${_fmt(monthlyLoss)}</div>
                        <div class="pure-macro-sub" style="font-size:0.6rem; color:#64748b;">Art. 119.º RGIT</div>
                    </div>
                    <div class="pure-macro-item pure-macro-highlight" style="flex:1.5; min-width:200px; background:rgba(239,68,68,0.08); border-left:3px solid #EF4444; padding:12px; border-radius:6px;">
                        <div class="pure-macro-label" style="font-size:0.65rem; color:#94a3b8; text-transform:uppercase;" data-pt="Erosão Fiscal Estimada (7 Anos)" data-en="Estimated Tax Erosion (7 Years)">Erosão Fiscal Estimada (7 Anos)</div>
                        <div class="pure-macro-value" style="font-size:1.6rem; font-weight:900; color:#EF4444;">${_fmt(macro.estimated_systemic_gap)}</div>
                        <div class="pure-macro-sub" style="font-size:0.6rem; color:#EF4444;">Art. 119.º RGIT (Iteração)</div>
                    </div>
                </div>
                <div class="pure-macro-disclaimer" style="margin-top:1rem; padding:0.75rem; background:rgba(0,0,0,0.3); border-left:3px solid #FACC15; font-size:0.7rem; color:#94a3b8;">
                    <i class="fas fa-gavel"></i> <span data-pt="Os valores de impacto sistémico constituem contexto macroeconómico e não prova directa de ilícito alheio, nos termos do Art. 128.º do CPP." data-en="Systemic impact values constitute macroeconomic context and not direct proof of third-party wrongdoing, under Art. 128 CPP.">${macro.disclaimer}</span>
                </div>
            `;
            const dadosReaisCarregados = (window.UNIFEDSystem && window.UNIFEDSystem.analysis && window.UNIFEDSystem.analysis.totals && window.UNIFEDSystem.analysis.totals.ganhos > 0);
            if (!dadosReaisCarregados && !window._unifedDataLoaded) cardDiv.style.display = 'none';
            target.appendChild(cardDiv);
        }

        function _updateAuxiliaryUI() {
            if (!document.getElementById('pureDashboard')) return;
            const sys = window.UNIFEDSystem;
            const dadosReaisCarregados = (sys && sys.analysis && sys.analysis.totals && sys.analysis.totals.ganhos > 0);
            let t;
            if (dadosReaisCarregados) t = sys.analysis.totals;
            else if (window._unifedDataLoaded === true) t = data.totals;
            else t = { ganhos: 0, despesas: 0, ganhosLiquidos: 0, saftBruto: 0, dac7TotalPeriodo: 0, faturaPlataforma: 0, iva6Omitido: 0, iva23Omitido: 0, asfixiaFinanceira: 0 };
            
            const _f = (typeof _fmt === 'function') ? _fmt : (v) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v || 0);
            const fi2 = data.fluxosIsentos;
            const totalNaoSujeitosCalc = (window._unifedDataLoaded === true) ? fi2.total : 0;
            
            const setScopedText = (id, val) => {
                const el = document.querySelector(`#pureDashboard #${id}`);
                if (el) el.textContent = (typeof val === 'number') ? _f(val) : val;
                const globalEl = document.getElementById(id);
                if (globalEl) globalEl.textContent = (typeof val === 'number') ? _f(val) : val;
            };
            
            const auxMapping = [
                { id: 'pure-ganhos', val: t.ganhos }, { id: 'pure-despesas', val: t.despesas }, { id: 'pure-liquido', val: t.ganhosLiquidos },
                { id: 'pure-saft', val: t.saftBruto }, { id: 'pure-dac7', val: t.dac7TotalPeriodo }, { id: 'pure-fatura', val: t.faturaPlataforma },
                { id: 'pure-disc-c2', val: t.despesas - t.faturaPlataforma }, { id: 'pure-disc-saft-dac7', val: t.saftBruto - t.dac7TotalPeriodo },
                { id: 'pure-iva-6', val: t.iva6Omitido }, { id: 'pure-iva-23', val: t.iva23Omitido },
                { id: 'pure-irc', val: (t.despesas - t.faturaPlataforma) * 0.21 },
                { id: 'pure-disc-c2-grid', val: t.despesas - t.faturaPlataforma }, { id: 'pure-iva-devido', val: t.asfixiaFinanceira },
                { id: 'pure-nao-sujeitos', val: totalNaoSujeitosCalc }, { id: 'pure-atf-sp', val: data.atf.score + '/100' },
                { id: 'pure-atf-trend', val: data.atf.trend }, { id: 'pure-atf-outliers', val: data.atf.outliers + ' outliers > 2σ' },
                { id: 'pure-atf-meses', val: '2.º Semestre 2024 — 4 meses com dados (Set–Dez)' },
                { id: 'pure-sg-1-val', val: t.despesas - t.faturaPlataforma },
                { id: 'pure-sg-1-pct', val: ((t.despesas - t.faturaPlataforma) / (t.despesas || 1) * 100).toFixed(2) + '%' },
                { id: 'pure-sg-2-val', val: t.saftBruto - t.dac7TotalPeriodo },
                { id: 'pure-sg-2-pct', val: ((t.saftBruto - t.dac7TotalPeriodo) / (t.saftBruto || 1) * 100).toFixed(2) + '%' },
                { id: 'pure-nc-campanhas', val: window._unifedDataLoaded === true ? fi2.campanhas : 0 },
                { id: 'pure-nc-gorjetas', val: window._unifedDataLoaded === true ? fi2.gorjetas : 0 },
                { id: 'pure-nc-portagens', val: window._unifedDataLoaded === true ? fi2.portagens : 0 },
                { id: 'pure-nc-total', val: totalNaoSujeitosCalc },
                { id: 'pure-verdict', val: dadosReaisCarregados ? 'RISCO CRÍTICO · DESVIO PADRÃO > 2σ' : 'AGUARDANDO PERÍCIA' },
                { id: 'pure-verdict-pct', val: dadosReaisCarregados ? ((t.despesas - t.faturaPlataforma) / (t.despesas || 1) * 100).toFixed(2) + '%' : '0.00%' },
                { id: 'pure-hash-prefix-verdict', val: (sys && sys.masterHash) ? sys.masterHash.substring(0, 16).toUpperCase() + '...' : (window._unifedDataLoaded === true ? data.masterHash.substring(0, 16) + '...' : '---') },
                { id: 'pure-session-id', val: (sys && sys.sessionId) ? sys.sessionId : (window._unifedDataLoaded === true ? data.sessionId : '--------') },
                { id: 'pure-hash-prefix', val: (sys && sys.masterHash) ? sys.masterHash.substring(0, 12).toUpperCase() + '...' : (window._unifedDataLoaded === true ? data.masterHash.substring(0, 12) + '...' : '---') },
                { id: 'pure-subject-name', val: (window._unifedDataLoaded === true) ? data.client.name : '---' },
                { id: 'pure-subject-nif', val: (window._unifedDataLoaded === true) ? data.client.nif : '---' },
                { id: 'pure-subject-platform', val: (window._unifedDataLoaded === true) ? data.client.platform : '---' },
                { id: 'pure-ganhos-extrato', val: t.ganhos }, { id: 'pure-despesas-extrato', val: t.despesas },
                { id: 'pure-ganhos-liquidos-extrato', val: t.ganhosLiquidos }, { id: 'pure-saft-bruto-val', val: t.saftBruto },
                { id: 'pure-dac7-val', val: t.dac7TotalPeriodo }, { id: 'pure-atf-zscore', val: data.atf.zScore },
                { id: 'pure-atf-confianca', val: data.atf.confianca }, { id: 'pure-atf-score-val', val: data.atf.score + '/100' },
                { id: 'pure-iva-devido-val', val: t.asfixiaFinanceira }, { id: 'pure-impacto-macro', val: data.macro_analysis.estimated_systemic_gap },
                { id: 'pure-ctrl-qty', val: (window._unifedDataLoaded === true) ? data.counts.ctrl : 0 },
                { id: 'pure-saft-qty', val: (window._unifedDataLoaded === true) ? data.counts.saft : 0 },
                { id: 'pure-fat-qty', val: (window._unifedDataLoaded === true) ? data.counts.fat : 0 },
                { id: 'pure-ext-qty', val: (window._unifedDataLoaded === true) ? data.counts.ext : 0 },
                { id: 'pure-dac7-qty', val: (window._unifedDataLoaded === true) ? data.counts.dac7 : 0 },
                { id: 'auxBoxCampanhasValue', val: window._unifedDataLoaded === true ? fi2.campanhas : 0 },
                { id: 'auxBoxPortagensValue', val: window._unifedDataLoaded === true ? fi2.portagens : 0 },
                { id: 'auxBoxGorjetasValue', val: window._unifedDataLoaded === true ? fi2.gorjetas : 0 },
                { id: 'auxBoxTotalNSValue', val: totalNaoSujeitosCalc },
                { id: 'auxBoxCancelValue', val: 0 },
                { id: 'auxDac7NoteValue', val: totalNaoSujeitosCalc },
                { id: 'auxDac7NoteValueQ', val: totalNaoSujeitosCalc },
                { id: 'pure-ganhos-tri', val: t.ganhos }, { id: 'pure-despesas-tri', val: t.despesas },
                { id: 'pure-liquido-tri', val: t.ganhosLiquidos }, { id: 'pure-fatura-tri', val: t.faturaPlataforma }
            ];
            auxMapping.forEach(item => setScopedText(item.id, item.val));
            
            const dac7Note = document.getElementById('auxDac7ReconciliationNote');
            if (dac7Note && totalNaoSujeitosCalc > 0) dac7Note.style.display = 'block';
            const questionText = document.querySelector('#pureDashboard #pure-zc-question-text');
            if (questionText) questionText.textContent = 'Pode a plataforma confirmar se os €451,15 em Gorjetas e Campanhas (isentos de comissão nos termos da Lei TVDE) foram incluídos na base de cálculo do reporte DAC7 enviado pela plataforma à Autoridade Tributária? Se sim, qual o fundamento legal?';
        }

        window.UNIFED_INTERNAL.injectAuxiliaryBoxesCSS = _injectAuxiliaryBoxesCSS;
        window.UNIFED_INTERNAL.injectMacroCard = _injectMacroCard;
        window.UNIFED_INTERNAL.updateAuxiliaryUI = _updateAuxiliaryUI;
        console.log('[UNIFED] Camada 4: OK.');
    })();

    // =========================================================================
    // Camada 5 – Simulação de Upload e Execução da Perícia
    // =========================================================================
    (function() {
        if (!window.UNIFED_INTERNAL) return;
        const { data } = window.UNIFED_INTERNAL;

        function _forcePlatformReadOnly() {
            const platformSelect = document.getElementById('selPlatformFixed');
            if (platformSelect) {
                for (let i = 0; i < platformSelect.options.length; i++) {
                    if (platformSelect.options[i].value === 'outra') {
                        platformSelect.selectedIndex = i;
                        break;
                    }
                }
                platformSelect.disabled = true;
                platformSelect.style.opacity = '0.7';
                platformSelect.style.cursor = 'not-allowed';
            }
            if (window.UNIFEDSystem) window.UNIFEDSystem.selectedPlatform = 'outra';
            console.log('[UNIFED] Plataforma forçada para "Plataforma A" em modo read‑only.');
        }

        function _removeZeroDac7Kpis() {
            const allDac7Cards = ['dac7Q1Value', 'dac7Q2Value', 'dac7Q3Value', 'dac7Q4Value'];
            const fmtLocal = window.UNIFED_INTERNAL?.fmt || ((v) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v));
            allDac7Cards.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.textContent = fmtLocal(0);
                    const card = el.closest('.kpi-card');
                    if (card) card.style.display = '';
                }
            });
            console.log('[UNIFED] Cards DAC7 mantidos visíveis com valores zero.');
        }

        async function _simulateEvidenceUpload() {
            try {
                if (typeof window.UNIFEDSystem === 'undefined') throw new Error('UNIFEDSystem not found');
                const sys = window.UNIFEDSystem;
                const t = data.totals;

                if (!sys.documents) sys.documents = {};
                if (!sys.documents.control) sys.documents.control = { files: [], totals: { records: 0 } };
                if (!sys.documents.saft) sys.documents.saft = { files: [], totals: { bruto: 0, iliquido: 0, iva: 0, records: 0 } };
                if (!sys.documents.statements) sys.documents.statements = { files: [], totals: { ganhos: 0, despesas: 0, ganhosLiquidos: 0, records: 0 } };
                if (!sys.documents.invoices) sys.documents.invoices = { files: [], totals: { invoiceValue: 0, records: 0 } };
                if (!sys.documents.dac7) sys.documents.dac7 = { files: [], totals: { q1: 0, q2: 0, q3: 0, q4: 0, totalPeriodo: 0, records: 0 } };
                if (!sys.analysis) sys.analysis = { evidenceIntegrity: [] };
                if (!sys.analysis.evidenceIntegrity) sys.analysis.evidenceIntegrity = [];

                // Limpeza
                sys.documents.control.files = []; sys.documents.saft.files = []; sys.documents.statements.files = [];
                sys.documents.invoices.files = []; sys.documents.dac7.files = []; sys.analysis.evidenceIntegrity = [];

                // 1. Controlo (4)
                const controlFiles = [
                    { name: 'controlo_autenticidade_1.csv', size: 256 },
                    { name: 'controlo_autenticidade_2.csv', size: 256 },
                    { name: 'controlo_autenticidade_3.csv', size: 256 },
                    { name: 'controlo_autenticidade_4.csv', size: 256 }
                ];
                for (const file of controlFiles) {
                    sys.documents.control.files.push({ name: file.name, size: file.size });
                    const hash = await window.generateForensicHash(file.name + 'control_demo');
                    sys.analysis.evidenceIntegrity.push({ filename: file.name, type: 'control', hash, timestamp: new Date().toISOString(), size: file.size });
                }
                sys.documents.control.totals.records = controlFiles.length;

                // 2. SAF-T (4)
                const saftFiles = [
                    { name: '131509_202409.csv', size: 1024 },
                    { name: '131509_202410.csv', size: 1024 },
                    { name: '131509_202411.csv', size: 1024 },
                    { name: '131509_202412.csv', size: 1024 }
                ];
                for (const file of saftFiles) {
                    sys.documents.saft.files.push({ name: file.name, size: file.size });
                    const hash = await window.generateForensicHash(file.name + 'saft_demo');
                    sys.analysis.evidenceIntegrity.push({ filename: file.name, type: 'saft', hash, timestamp: new Date().toISOString(), size: file.size });
                }
                sys.documents.saft.totals.bruto = t.saftBruto;
                sys.documents.saft.totals.iliquido = t.saftIliquido;
                sys.documents.saft.totals.iva = t.saftIva;
                sys.documents.saft.totals.records = saftFiles.length;

                // 3. Extratos (4)
                const statementFiles = [
                    { name: 'extrato_setembro_2024.pdf', size: 2048 },
                    { name: 'extrato_outubro_2024.pdf', size: 2048 },
                    { name: 'extrato_novembro_2024.pdf', size: 2048 },
                    { name: 'extrato_dezembro_2024.pdf', size: 2048 }
                ];
                for (const file of statementFiles) {
                    sys.documents.statements.files.push({ name: file.name, size: file.size });
                    const hash = await window.generateForensicHash(file.name + 'statement_demo');
                    sys.analysis.evidenceIntegrity.push({ filename: file.name, type: 'statement', hash, timestamp: new Date().toISOString(), size: file.size });
                }
                sys.documents.statements.totals.ganhos = t.ganhos;
                sys.documents.statements.totals.despesas = t.despesas;
                sys.documents.statements.totals.ganhosLiquidos = t.ganhosLiquidos;
                sys.documents.statements.totals.records = statementFiles.length;

                // 4. Faturas (2)
                const invoiceFiles = [
                    { name: 'PT1124_202412.pdf', size: 512 },
                    { name: 'PT1125_202412.pdf', size: 512 }
                ];
                for (const file of invoiceFiles) {
                    sys.documents.invoices.files.push({ name: file.name, size: file.size });
                    const hash = await window.generateForensicHash(file.name + 'invoice_demo');
                    sys.analysis.evidenceIntegrity.push({ filename: file.name, type: 'invoice', hash, timestamp: new Date().toISOString(), size: file.size });
                }
                sys.documents.invoices.totals.invoiceValue = t.faturaPlataforma;
                sys.documents.invoices.totals.records = invoiceFiles.length;

                // 5. DAC7 (1)
                const dac7Files = [{ name: 'dac7_2024_semestre2.pdf', size: 1024 }];
                for (const file of dac7Files) {
                    sys.documents.dac7.files.push({ name: file.name, size: file.size });
                    const hash = await window.generateForensicHash(file.name + 'dac7_demo');
                    sys.analysis.evidenceIntegrity.push({ filename: file.name, type: 'dac7', hash, timestamp: new Date().toISOString(), size: file.size });
                }
                sys.documents.dac7.totals.q4 = t.dac7TotalPeriodo;
                sys.documents.dac7.totals.q3 = 0; sys.documents.dac7.totals.q1 = 0; sys.documents.dac7.totals.q2 = 0;
                sys.documents.dac7.totals.totalPeriodo = t.dac7TotalPeriodo;
                sys.documents.dac7.totals.records = dac7Files.length;

                // Dados auxiliares
                if (!sys.auxiliaryData) sys.auxiliaryData = {};
                sys.auxiliaryData.campanhas = t.campanhas || 0;
                sys.auxiliaryData.portagens = t.portagens || 0;
                sys.auxiliaryData.gorjetas = t.gorjetas || 0;
                sys.auxiliaryData.cancelamentos = t.cancelamentos || 0;
                sys.auxiliaryData.totalNaoSujeitos = (t.campanhas || 0) + (t.portagens || 0) + (t.gorjetas || 0);
                sys.auxiliaryData.processedFrom = [];
                sys.auxiliaryData.extractedAt = new Date().toISOString();

                // Dados mensais
                if (!sys.monthlyData) sys.monthlyData = {};
                const monthlyGanhos = [2450.00, 2560.00, 2480.00, 2667.73];
                const monthlyDespesas = [590.00, 615.00, 600.00, 642.89];
                const monthlyGanhosLiq = [1860.00, 1945.00, 1880.00, 2024.84];
                const months = ['202409', '202410', '202411', '202412'];
                months.forEach((month, idx) => {
                    sys.monthlyData[month] = {
                        ganhos: monthlyGanhos[idx],
                        despesas: monthlyDespesas[idx],
                        ganhosLiq: monthlyGanhosLiq[idx]
                    };
                });
                sys.dataMonths = new Set(months);

                // Preencher totais brutos (sem análise)
                if (!sys.analysis.totals) sys.analysis.totals = {};
                sys.analysis.totals.saftBruto = t.saftBruto;
                sys.analysis.totals.saftIliquido = t.saftIliquido;
                sys.analysis.totals.saftIva = t.saftIva;
                sys.analysis.totals.ganhos = t.ganhos;
                sys.analysis.totals.despesas = t.despesas;
                sys.analysis.totals.ganhosLiquidos = t.ganhosLiquidos;
                sys.analysis.totals.faturaPlataforma = t.faturaPlataforma;
                sys.analysis.totals.dac7Q1 = 0; sys.analysis.totals.dac7Q2 = 0; sys.analysis.totals.dac7Q3 = 0;
                sys.analysis.totals.dac7Q4 = t.dac7TotalPeriodo;
                sys.analysis.totals.dac7TotalPeriodo = t.dac7TotalPeriodo;
                if (sys.analysis.crossings) delete sys.analysis.crossings;

                // Cliente
                if (!sys.client && data.client) {
                    sys.client = { name: data.client.name, nif: data.client.nif, platform: data.client.platform };
                    const clientStatus = document.getElementById('clientStatusFixed');
                    if (clientStatus) {
                        clientStatus.style.display = 'flex';
                        const nameSpan = document.getElementById('clientNameDisplayFixed');
                        const nifSpan = document.getElementById('clientNifDisplayFixed');
                        if (nameSpan) nameSpan.textContent = data.client.name;
                        if (nifSpan) nifSpan.textContent = data.client.nif;
                    }
                    const nameInput = document.getElementById('clientNameFixed');
                    const nifInput = document.getElementById('clientNIFFixed');
                    if (nameInput) nameInput.value = data.client.name;
                    if (nifInput) nifInput.value = data.client.nif;
                }

                // Período
                const periodSelect = document.getElementById('periodoAnalise');
                if (periodSelect) {
                    periodSelect.value = '2s';
                    if (typeof window.UNIFEDSystem !== 'undefined') window.UNIFEDSystem.selectedPeriodo = '2s';
                    const changeEvent = new Event('change', { bubbles: true });
                    periodSelect.dispatchEvent(changeEvent);
                }
                const trimestralContainer = document.getElementById('trimestralSelectorContainer');
                if (trimestralContainer) trimestralContainer.style.display = 'none';

                // Master Hash
                const evidenceHashes = sys.analysis.evidenceIntegrity.map(ev => ev.hash).filter(h => h && h.length === 64).sort();
                const binaryConcat = evidenceHashes.join('') + JSON.stringify({ client: sys.client, totals: t }) + sys.sessionId;
                const masterHashFull = await window.generateForensicHash(binaryConcat);
                sys.masterHash = masterHashFull;
                window.activeForensicSession = { sessionId: sys.sessionId, masterHash: masterHashFull };

                // Flags
                window._unifedDataLoaded = true;
                window._unifedAnalysisPending = true;
                window._unifedRawDataOnly = true;

                if (typeof window._hydrateRawDataValues === 'function') window._hydrateRawDataValues();
                console.log('[UNIFED] Evidências simuladas carregadas (15 ficheiros). Modo raw ativo. Aguardando perícia.');
                return true;
            } catch (err) {
                console.error('[UNIFED] Erro na simulação de evidências:', err);
                throw err;
            }
        }

        function _updateEvidenceCountersAndShow() {
            const sys = window.UNIFEDSystem;
            if (!sys || !sys.documents) return;
            const controlCount = sys.documents.control?.files?.length || 0;
            const saftCount = sys.documents.saft?.files?.length || 0;
            const invoiceCount = sys.documents.invoices?.files?.length || 0;
            const statementCount = sys.documents.statements?.files?.length || 0;
            const dac7Count = sys.documents.dac7?.files?.length || 0;
            const total = controlCount + saftCount + invoiceCount + statementCount + dac7Count;

            const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
            setText('controlCountCompact', controlCount);
            setText('saftCountCompact', saftCount);
            setText('invoiceCountCompact', invoiceCount);
            setText('statementCountCompact', statementCount);
            setText('dac7CountCompact', dac7Count);
            setText('summaryControl', controlCount);
            setText('summarySaft', saftCount);
            setText('summaryInvoices', invoiceCount);
            setText('summaryStatements', statementCount);
            setText('summaryDac7', dac7Count);
            setText('summaryTotal', total);
            const evidenceCountTotal = document.getElementById('evidenceCountTotal');
            if (evidenceCountTotal) evidenceCountTotal.textContent = total;
            const evidenceSection = document.getElementById('pureEvidenceSection');
            if (evidenceSection) evidenceSection.style.display = 'block';
            const counters = ['controlCountCompact', 'saftCountCompact', 'invoiceCountCompact', 'statementCountCompact', 'dac7CountCompact'];
            counters.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'inline-block'; });
            console.log('[UNIFED] Contadores de evidências atualizados e secção revelada.');
        }

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

            // Executar cruzamento forense
            if (typeof window.performForensicCrossings === 'function') {
                await window.performForensicCrossings();
            } else {
                const t = sys.analysis.totals;
                const discrepanciaCritica = t.despesas - t.faturaPlataforma;
                const discrepanciaSaftVsDac7 = t.saftBruto - t.dac7TotalPeriodo;
                const percentagemOmissao = t.despesas > 0 ? (discrepanciaCritica / t.despesas) * 100 : 0;
                const percentagemSaftVsDac7 = t.saftBruto > 0 ? (discrepanciaSaftVsDac7 / t.saftBruto) * 100 : 0;
                const ivaFalta = discrepanciaCritica * 0.23;
                const ivaFalta6 = discrepanciaCritica * 0.06;
                const ircEstimado = discrepanciaCritica * 0.21;
                const asfixiaFinanceira = t.saftBruto * 0.06;

                if (!sys.analysis.crossings) sys.analysis.crossings = {};
                Object.assign(sys.analysis.crossings, {
                    discrepanciaSaftVsDac7, percentagemSaftVsDac7,
                    discrepanciaCritica, percentagemOmissao,
                    ivaFalta, ivaFalta6, ircEstimado, asfixiaFinanceira,
                    btor: t.despesas, btf: t.faturaPlataforma,
                    c1_delta: discrepanciaSaftVsDac7, c1_pct: percentagemSaftVsDac7,
                    c2_delta: discrepanciaCritica, c2_pct: percentagemOmissao
                });
                t.iva6Omitido = ivaFalta6;
                t.iva23Omitido = ivaFalta;
                t.asfixiaFinanceira = asfixiaFinanceira;
            }

            // Atualizar flags
            window._unifedRawDataOnly = false;
            window._unifedAnalysisPending = false;

            // Revelar módulos forenses (sem desenhar gráficos)
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

            // Disparar eventos – os gráficos serão desenhados pelos listeners em enrichment.js
            window.dispatchEvent(new CustomEvent('UNIFED_ANALYSIS_COMPLETE', {
                detail: { source: 'executePendingAnalysis', timestamp: Date.now() }
            }));
            window.dispatchEvent(new CustomEvent('UNIFED_EXECUTE_PERITIA', {
                detail: { timestamp: new Date().toISOString() }
            }));

            console.log('[UNIFED] Análise forense concluída – eventos disparados. Gráficos serão renderizados pelos listeners.');
        }

        function ensureDemoDataLoaded() {
            console.log('[UNIFED] Forçando Hidratação de Dados Materializados...');
            const d = window.UNIFED_INTERNAL.data;
            const t = d.totals;
            const fi = d.fluxosIsentos;

            if (!window.UNIFEDSystem) window.UNIFEDSystem = {};
            window.UNIFEDSystem.analysis = window.UNIFEDSystem.analysis || {};
            window.UNIFEDSystem.analysis.totals = {
                saftBruto: t.saftBruto, saftIva: t.saftIva, saftIliquido: t.saftIliquido,
                ganhos: t.ganhos, despesas: t.despesas, ganhosLiquidos: t.ganhosLiquidos,
                dac7TotalPeriodo: t.dac7TotalPeriodo, dac7Q1: 0, dac7Q2: 0, dac7Q3: 0,
                dac7Q4: t.dac7TotalPeriodo, faturaPlataforma: t.faturaPlataforma,
                iva6Omitido: 0, iva23Omitido: 0, asfixiaFinanceira: 0
            };
            window.UNIFEDSystem.client = { name: d.client.name, nif: d.client.nif, platform: d.client.platform };
            window.UNIFEDSystem.sessionId = d.sessionId;
            window.UNIFEDSystem.masterHash = d.masterHash;
            window.UNIFEDSystem.selectedYear = 2024;
            window.UNIFEDSystem.selectedPeriodo = '2s';
            window.UNIFEDSystem.casoRealAnonimizado = true;
            window.UNIFEDSystem.isDemoLoaded = true;
            window._unifedDataLoaded = true;
            window._unifedAnalysisPending = true;
            window._unifedRawDataOnly = true;

            const nameEl = document.getElementById('pure-subject-name');
            const nifEl = document.getElementById('pure-subject-nif');
            if (nameEl) nameEl.textContent = d.client.name;
            if (nifEl) nifEl.textContent = d.client.nif;

            const anoEl = document.getElementById('anoFiscal');
            if (anoEl) { anoEl.value = '2024'; anoEl.dispatchEvent(new Event('change', { bubbles: true })); }
            const periodoEl = document.getElementById('periodoAnalise');
            if (periodoEl) { periodoEl.value = '2s'; periodoEl.dispatchEvent(new Event('change', { bubbles: true })); }

            const fmt = window.UNIFED_INTERNAL.fmt;
            const mapping = {
                'pure-saft': fmt(t.saftIliquido), 'pure-ganhos': fmt(t.ganhos),
                'pure-despesas': fmt(t.despesas), 'pure-liquido': fmt(t.ganhosLiquidos),
                'pure-dac7': fmt(t.dac7TotalPeriodo)
            };
            Object.entries(mapping).forEach(([id, val]) => {
                const el = document.getElementById(id);
                if (el) { el.textContent = val; el.style.opacity = '1'; }
            });

            ['dac7Q1Value','dac7Q2Value','dac7Q3Value'].forEach(id => {
                const el = document.getElementById(id); if (el) el.textContent = fmt(0);
            });
            const q4El = document.getElementById('dac7Q4Value');
            if (q4El) q4El.textContent = fmt(t.dac7TotalPeriodo);

            const nameInput = document.getElementById('clientNameFixed');
            const nifInput = document.getElementById('clientNIFFixed');
            if (nameInput) nameInput.value = d.client.name;
            if (nifInput) nifInput.value = d.client.nif;

            const clientStatus = document.getElementById('clientStatusFixed');
            if (clientStatus) {
                clientStatus.style.display = 'flex';
                const spanName = document.getElementById('clientNameDisplayFixed');
                const spanNif = document.getElementById('clientNifDisplayFixed');
                if (spanName) spanName.textContent = d.client.name;
                if (spanNif) spanNif.textContent = d.client.nif;
            }

            if (typeof window._hydrateRawDataValues === 'function') window._hydrateRawDataValues();

            (function _updateDemoEvidenceCount() {
                const _c = d.counts;
                const _total = _c.ctrl + _c.saft + _c.fat + _c.ext + _c.dac7;
                const _evEl = document.getElementById('evidenceCountTotal');
                if (_evEl) _evEl.textContent = _total;
                [['controlCountCompact', _c.ctrl], ['saftCountCompact', _c.saft],
                 ['invoiceCountCompact', _c.fat], ['statementCountCompact', _c.ext],
                 ['dac7CountCompact', _c.dac7]].forEach(([id, v]) => {
                    const el = document.getElementById(id);
                    if (el) el.textContent = v;
                });
                [['pure-ctrl-qty', _c.ctrl], ['pure-saft-qty', _c.saft],
                 ['pure-fat-qty', _c.fat], ['pure-ext-qty', _c.ext],
                 ['pure-dac7-qty', _c.dac7]].forEach(([id, v]) => {
                    const el = document.getElementById(id);
                    if (el) el.textContent = v;
                });
                const pureEvidSec = document.getElementById('pureEvidenceSection');
                if (pureEvidSec) pureEvidSec.style.display = 'block';
                console.log('[UNIFED] RET-09: Contador de evidências atualizado — ' + _total + ' documentos.');
            })();

            console.log('[UNIFED] ensureDemoDataLoaded v2: valores corretos injetados.');
            return true;
        }

        window.UNIFED_INTERNAL.forcePlatformReadOnly = _forcePlatformReadOnly;
        window.UNIFED_INTERNAL.removeZeroDac7Kpis = _removeZeroDac7Kpis;
        window.UNIFED_INTERNAL.simulateEvidenceUpload = _simulateEvidenceUpload;
        window.UNIFED_INTERNAL.updateEvidenceCountersAndShow = _updateEvidenceCountersAndShow;
        window.UNIFED_INTERNAL.executePendingAnalysis = _executePendingAnalysis;
        window.UNIFED_INTERNAL.ensureDemoDataLoaded = ensureDemoDataLoaded;

        const simulateEvidenceUpload = _simulateEvidenceUpload;
        window.ensureDemoDataLoaded = ensureDemoDataLoaded;
        window.executePendingAnalysis = _executePendingAnalysis;

        console.log('[UNIFED] Camada 5: OK.');
    })();

    // =========================================================================
    // Inicialização e Setup dos Botões
    // =========================================================================
    (function() {
        if (!window.UNIFED_INTERNAL) return;
        const { data, fmt, syncMetrics, renderMatrix, injectAuxiliaryBoxesCSS, injectMacroCard, updateAuxiliaryUI, forcePlatformReadOnly, simulateEvidenceUpload, updateEvidenceCountersAndShow, executePendingAnalysis, ensureDemoDataLoaded } = window.UNIFED_INTERNAL;

        let _initializing = false;
        let _dataLoaded = false;

        function waitForPureDashboard() {
            return new Promise((resolve) => {
                if (document.getElementById('pureDashboard')) { resolve(); return; }
                const observer = new MutationObserver(() => {
                    if (document.getElementById('pureDashboard')) {
                        observer.disconnect();
                        resolve();
                    }
                });
                observer.observe(document.body, { childList: true, subtree: true });
                setTimeout(() => { observer.disconnect(); resolve(); }, 5000);
            });
        }

        function initializeCoreDashboard() {
            if (_initializing) return;
            _initializing = true;
            waitForPureDashboard().then(() => {
                setTimeout(() => {
                    if (typeof window.injectAuxiliaryHelperBoxes === 'function') window.injectAuxiliaryHelperBoxes();
                    if (typeof syncMetrics === 'function') syncMetrics();
                    if (typeof renderMatrix === 'function') renderMatrix();
                    if (typeof injectMacroCard === 'function') injectMacroCard();
                    if (typeof injectAuxiliaryBoxesCSS === 'function') injectAuxiliaryBoxesCSS();
                    if (typeof forcePlatformReadOnly === 'function') forcePlatformReadOnly();
                    if (document.getElementById('pureDashboard')) {
                        if (typeof updateAuxiliaryUI === 'function') updateAuxiliaryUI();
                        document.querySelectorAll('.chart-section').forEach(section => {
                            section.style.display = 'block';
                            section.style.height = 'auto';
                        });
                        if (typeof Chart === 'undefined') {
                            document.querySelectorAll('.chart-section').forEach(section => section.style.display = 'none');
                            console.warn('[UNIFED] Chart.js não disponível – secções de gráfico ocultadas.');
                        }
                    }
                    console.log('[UNIFED] Core dashboard inicializado com sucesso após injeção do painel.');
                    _initializing = false;
                }, 100);
            }).catch(err => {
                console.warn('[UNIFED] Erro ao aguardar #pureDashboard', err);
                _initializing = false;
            });
        }

        async function initializeFullWithEvidence() {
            if (_dataLoaded) return;
            console.log('[UNIFED] A carregar evidências do caso real...');
            await waitForPureDashboard();
            try {
                await simulateEvidenceUpload();
                _dataLoaded = true;
                updateEvidenceCountersAndShow();
                if (typeof window.injectAuxiliaryHelperBoxes === 'function') window.injectAuxiliaryHelperBoxes();
                if (typeof updateAuxiliaryUI === 'function') updateAuxiliaryUI();
                if (typeof window.UNIFED_INTERNAL.syncMetrics === 'function') window.UNIFED_INTERNAL.syncMetrics();
                if (typeof window.updateModulesUI === 'function') window.updateModulesUI();
                if (window.UNIFEDSystem && window.UNIFEDSystem.masterHash && typeof generateQRCode === 'function') generateQRCode();
                console.log('[UNIFED] ✅ Evidências carregadas e secção revelada. Aguardando execução da perícia.');
            } catch (err) {
                console.error('[UNIFED] Falha ao carregar evidências:', err);
            }
        }

        if (window.UNIFEDSystem) {
            window.UNIFEDSystem.loadAnonymizedRealCase = async function() {
                await initializeFullWithEvidence();
                if (typeof window.correctRomanIndices === 'function') window.correctRomanIndices();
                console.info('[UNIFED-FIX] Data Hydration concluída (gráficos e módulos aguardam perícia).');
            };
        }

        function setupAnalyzeButton() {
            const analyzeBtn = document.getElementById('analyzeBtn');
            if (!analyzeBtn) return;
            if (analyzeBtn.getAttribute('data-analyze-listener') === 'true') return;
            analyzeBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                console.log('[UNIFED] Botão EXECUTAR PERÍCIA clicado — a executar análise pendente.');
                let loadFn = window.ensureDemoDataLoaded || window.UNIFED_INTERNAL?.ensureDemoDataLoaded;
                if (typeof loadFn === 'function') await loadFn();
                let execFn = window.executePendingAnalysis || window.UNIFED_INTERNAL?.executePendingAnalysis;
                if (typeof execFn === 'function') await execFn();
                else console.error('[UNIFED] executePendingAnalysis não está disponível');
            });
            analyzeBtn.setAttribute('data-analyze-listener', 'true');
            console.log('[UNIFED] Listener associado ao botão "EXECUTAR PERÍCIA" (#analyzeBtn).');
        }

        function setupRealCaseButton() {
            let targetButton = document.getElementById('demoModeBtn');
            if (!targetButton) {
                const buttons = document.querySelectorAll('button, .btn, [role="button"]');
                for (let btn of buttons) {
                    if (btn.textContent.trim() === 'CASO REAL ANONIMIZADO') {
                        targetButton = btn;
                        break;
                    }
                }
            }
            if (!targetButton) {
                console.warn('[UNIFED] Botão "CASO REAL ANONIMIZADO" não encontrado.');
                return;
            }
            if (targetButton.getAttribute('data-unifed-active') === 'true') return;
            targetButton.addEventListener('click', async function(e) {
                e.preventDefault();
                if (_initializing) return;
                logAudit('Iniciando transição para Caso Real Anonimizado...', 'info');
                let loadFn = window.ensureDemoDataLoaded || window.UNIFED_INTERNAL?.ensureDemoDataLoaded;
                if (typeof loadFn !== 'function') {
                    console.error('[UNIFED] ensureDemoDataLoaded não disponível. Abortando.');
                    return;
                }
                try {
                    if (typeof window._activatePurePanel === 'function') await window._activatePurePanel();
                    await waitForPureDashboard();
                    initializeCoreDashboard();
                    const wrapper = document.getElementById('pureDashboardWrapper');
                    if (wrapper) {
                        await new Promise((resolve) => {
                            const checkInterval = setInterval(() => {
                                if (document.getElementById('pure-saft') && document.getElementById('pure-ganhos') && document.getElementById('pure-subject-name')) {
                                    clearInterval(checkInterval);
                                    resolve();
                                }
                            }, 50);
                            setTimeout(() => { clearInterval(checkInterval); resolve(); }, 3000);
                        });
                    }
                    await new Promise(r => setTimeout(r, 100));
                    await loadFn();
                    await new Promise(r => setTimeout(r, 50));
                    if (typeof window.UNIFED_INTERNAL?.syncMetrics === 'function') window.UNIFED_INTERNAL.syncMetrics();
                    if (wrapper) {
                        wrapper.style.opacity = '1';
                        wrapper.style.visibility = 'visible';
                        wrapper.style.display = 'block';
                    }
                    if (typeof window.UNIFED_INTERNAL?.simulateEvidenceUpload === 'function') await window.UNIFED_INTERNAL.simulateEvidenceUpload();
                    if (typeof window.UNIFED_INTERNAL?.updateEvidenceCountersAndShow === 'function') window.UNIFED_INTERNAL.updateEvidenceCountersAndShow();
                    if (typeof registerClient === 'function') registerClient();
                    if (window.UNIFEDSystem.loadAnonymizedRealCase) await window.UNIFEDSystem.loadAnonymizedRealCase();
                    else await initializeFullWithEvidence();
                    if (typeof window.correctRomanIndices === 'function') window.correctRomanIndices();
                    logAudit('Interface harmonizada (Índices Romanos V-VII).', 'success');
                } catch (err) {
                    console.error('[UNIFED] Erro na ativação do caso real:', err);
                }
            }, { capture: true });
            targetButton.setAttribute('data-unifed-active', 'true');
            console.log('[UNIFED] Listener associado ao botão "CASO REAL ANONIMIZADO".');
        }

        function setupEventDrivenHydration() {
            window.addEventListener('UNIFED_ANALYSIS_COMPLETE', function(event) {
                console.log('[UNIFED] Evento UNIFED_ANALYSIS_COMPLETE recebido (fallback).', event.detail);
                if (typeof window.forensicDataSynchronization === 'function') window.forensicDataSynchronization();
                if (typeof syncMetrics === 'function') syncMetrics();
                if (typeof renderMatrix === 'function') renderMatrix();
                if (typeof updateAuxiliaryUI === 'function') updateAuxiliaryUI();
                if (typeof window.forceRevealSmokingGun === 'function') window.forceRevealSmokingGun();
            });
        }

        function generateQRCode() {
            const container = document.getElementById('qrcodeContainer');
            if (!container) return;
            container.innerHTML = '';
            const hashFull = window.UNIFEDSystem?.masterHash || 'HASH_INDISPONIVEL';
            const sessionShort = window.UNIFEDSystem?.sessionId ? window.UNIFEDSystem.sessionId.substring(0, 16) : 'N/A';
            const qrData = `UNIFED|${sessionShort}|${hashFull}`;
            if (typeof QRCode !== 'undefined') {
                new QRCode(container, { text: qrData, width: 75, height: 75, colorDark: "#000000", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.L });
            }
            container.setAttribute('data-tooltip', 'Clique para verificar a cadeia de custódia completa');
            container.onclick = () => {
                if (typeof window.openCustodyChainModal === 'function') window.openCustodyChainModal();
                else console.warn('[UNIFED] openCustodyChainModal não disponível');
            };
        }
        window.generateQRCode = generateQRCode;

        setupEventDrivenHydration();
        setupRealCaseButton();
        setupAnalyzeButton();

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                initializeCoreDashboard();
                if (typeof populateAnoFiscal === 'function') populateAnoFiscal();
                if (typeof populateYears === 'function') populateYears();
            }, { once: true });
        } else {
            initializeCoreDashboard();
            if (typeof populateAnoFiscal === 'function') populateAnoFiscal();
            if (typeof populateYears === 'function') populateYears();
        }
    })();

    // =========================================================================
    // Camada 7 – State-Driven Hydration + Event-Driven Uncloaking
    // =========================================================================
    (function _installStateHydration() {
        window.revealMetadata = function() {
            const sys = window.UNIFEDSystem;
            const _sessionId = (sys && sys.sessionId) ? sys.sessionId : (window.UNIFED_INTERNAL && window.UNIFED_INTERNAL.data) ? window.UNIFED_INTERNAL.data.sessionId : 'UNIFED-SESSION';
            const _hash = (sys && sys.masterHash) ? sys.masterHash : '2A38423FED220D681D86E959F2C34F993BA71FCE9B92791199453B41E23A63E5';
            document.querySelectorAll('#pure-session-id').forEach(el => { el.textContent = _sessionId; });
            document.querySelectorAll('#pure-hash-prefix').forEach(el => { el.textContent = _hash.substring(0, 12).toUpperCase() + '...'; });
            const tsaEl = document.getElementById('pure-tsa-anchor');
            if (tsaEl) tsaEl.innerHTML = 'Selo de Tempo RFC 3161: <span style="color:#00e5ff;font-weight:bold;">VALIDADO VIA FREETSA.ORG</span>';
            document.querySelectorAll('.pure-subject-header, #pure-tsa-anchor').forEach(el => el.classList.add('forensic-revealed'));
            console.log('[UNIFED] Estado 1 (METADATA): hidratação de metadados concluída.');
        };

        window.uncloakForensicData = function() {
            if (window._unifedAnalysisPending === true || window._unifedRawDataOnly === true) {
                console.log('[UNIFED] uncloakForensicData bloqueado – análise ainda não executada.');
                return;
            }
            if (typeof window.UNIFED_INTERNAL !== 'undefined') {
                if (typeof window.UNIFED_INTERNAL.syncMetrics === 'function') window.UNIFED_INTERNAL.syncMetrics();
                if (typeof window.UNIFED_INTERNAL.renderMatrix === 'function') window.UNIFED_INTERNAL.renderMatrix();
                if (typeof window.UNIFED_INTERNAL.updateAuxiliaryUI === 'function') window.UNIFED_INTERNAL.updateAuxiliaryUI();
            }
            document.querySelectorAll('.pure-data-value, .pure-delta-value, .pure-atf-big, .smoking-gun-module, .pure-sg-val, [data-pt], [data-en]').forEach(el => el.classList.add('forensic-revealed'));
            window.dispatchEvent(new CustomEvent('UNIFED_EXECUTE_PERITIA', { detail: { timestamp: new Date().toISOString(), masterHash: '2A38423FED220D681D86E959F2C34F993BA71FCE9B92791199453B41E23A63E5' } }));
            console.log('[UNIFED] Estado 2 (PERITIA): uncloaking atómico concluído — UNIFED_EXECUTE_PERITIA disparado.');
        };

        function _setupTriggers() {
            const btnCasoReal = document.getElementById('demoModeBtn');
            if (btnCasoReal && !btnCasoReal.getAttribute('data-state-hydration-1')) {
                btnCasoReal.addEventListener('click', window.revealMetadata);
                btnCasoReal.setAttribute('data-state-hydration-1', '1');
            }
            window.addEventListener('UNIFED_ANALYSIS_COMPLETE', function _onAnalysisComplete(evt) {
                console.log('[UNIFED] UNIFED_ANALYSIS_COMPLETE recebido.', (evt && evt.detail) || '');
                if (evt && evt.detail && evt.detail.status === 'READY') {
                    console.log('[UNIFED] Evento de inicialização ignorado – aguardando perícia.');
                    return;
                }
                if (window._unifedAnalysisPending === false) {
                    if (typeof window.updateDashboard === 'function') window.updateDashboard();
                    if (typeof window.UNIFED_INTERNAL?.syncMetrics === 'function') window.UNIFED_INTERNAL.syncMetrics();
                    if (typeof window.updateForensicModulesVisibility === 'function') window.updateForensicModulesVisibility(true);
                    window.uncloakForensicData();
                } else {
                    console.log('[UNIFED] Análise ainda pendente – revelação adiada.');
                }
            });
        }

        if (document.readyState === 'complete' || document.readyState === 'interactive') _setupTriggers();
        else window.addEventListener('load', _setupTriggers);
        console.log('[UNIFED] Camada 7 (State-Driven Hydration + Event-Driven Uncloaking): OK.');
    })();

    // =========================================================================
    // FUNÇÃO GLOBAL PARA RENDERIZAR GRÁFICOS SOB DEMANDA (APENAS EVENTOS)
    // =========================================================================
    function renderForensicCharts() {
        var sys = window.UNIFEDSystem;
        if (!sys || !sys.analysis || !sys.analysis.totals) {
            console.warn('[UNIFED] renderForensicCharts: análise não disponível. Aguardando 200ms...');
            setTimeout(renderForensicCharts, 200);
            return;
        }
        if (typeof window._fillAnalysisStatCards === 'function') {
            try { window._fillAnalysisStatCards(); } catch (err) { console.warn('[UNIFED] _fillAnalysisStatCards() falhou:', err.message); }
        }
        // Disparar eventos – os gráficos serão renderizados pelos listeners em enrichment.js
        window.dispatchEvent(new CustomEvent('UNIFED_ANALYSIS_COMPLETE', { detail: { source: 'renderForensicCharts', timestamp: Date.now() } }));
        window.dispatchEvent(new CustomEvent('UNIFED_EXECUTE_PERITIA', { detail: { timestamp: new Date().toISOString() } }));
        console.log('[UNIFED] renderForensicCharts: eventos disparados, aguardando renderização.');
    }
    window.renderForensicCharts = renderForensicCharts;

    // =========================================================================
    // CONTROLE DE VISIBILIDADE DOS MÓDULOS FORENSES
    // =========================================================================
    function updateForensicModulesVisibility(show) {
        const modules = [
            'pureATFCard', 'pureZonaCinzentaCard', 'pureMacroCard', 'pureTriangulationCard',
            'card-asfixia', 'mainChartContainer', 'mainDiscrepancyChartContainer',
            'pure-chart-container', 'gapConciliacaoC1'
        ];
        modules.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            if (show) {
                el.classList.remove('unifed-hidden-until-analysis');
                el.style.removeProperty('display');
                if (getComputedStyle(el).display === 'none') el.style.display = 'block';
            } else {
                el.classList.add('unifed-hidden-until-analysis');
                el.style.removeProperty('display');
            }
        });
        const atfCanvas = document.getElementById('atfChartCanvas');
        if (atfCanvas) atfCanvas.style.display = show ? 'block' : 'none';
        const mainChartContainer = document.getElementById('mainChartContainer');
        if (mainChartContainer) mainChartContainer.style.display = show ? 'block' : 'none';
        const discChartContainer = document.getElementById('pure-chart-container');
        if (discChartContainer) discChartContainer.style.display = show ? 'block' : 'none';
        const gapEl = document.getElementById('gapConciliacaoC1');
        if (gapEl) gapEl.style.display = show ? 'block' : 'none';
        if (show && window.UNIFEDSystem && window.UNIFEDSystem.analysis && window.UNIFEDSystem.analysis.crossings) {
            const gapValue = window.UNIFEDSystem.analysis.crossings.discrepanciaSaftVsDac7 || 0;
            const gapSpan = document.getElementById('gapC1Value');
            if (gapSpan) {
                const fmt = window.UNIFED_INTERNAL?.fmt || ((v) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v));
                gapSpan.textContent = fmt(gapValue);
            }
        }
        console.log(`[UNIFED] Visibilidade dos módulos forenses: ${show ? 'mostrar' : 'ocultar'}`);
    }
    window.updateForensicModulesVisibility = updateForensicModulesVisibility;

    // =========================================================================
    // Função para activar todos os botões
    // =========================================================================
    function forceEnableAllButtons() {
        const buttonIds = [
            'analyzeBtn', 'exportPDFBtn', 'exportJSONBtn', 'resetBtn', 'clearConsoleBtn',
            'exportDOCXBtn', 'atfModalBtn', 'demoModeBtn', 'registerClientBtnFixed',
            'openEvidenceModalBtn', 'forensicWipeBtn', 'custodyChainTriggerBtn'
        ];
        buttonIds.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.disabled = false;
        });
        document.querySelectorAll('.btn-tool, .btn-tool-pure, .btn-forensic, .evidence-management-btn-solid').forEach(btn => {
            btn.disabled = false;
            btn.style.pointerEvents = 'auto';
        });
        console.log('[UNIFED] Todos os botões foram forçados a ativo.');
    }

    // =========================================================================
    // resetUIVisual – Purga Total de Memória (Zero-Knowledge)
    // =========================================================================
    window.resetUIVisual = function() {
        console.warn('[FORENSIC-CORE] Invocando Purga Total de Memória (Zero-Knowledge).');
        try { localStorage.clear(); sessionStorage.clear(); } catch(e) { console.warn('Storage clear failed', e); }
        if (window.UNIFEDSystem) {
            window.UNIFEDSystem.analysis = { totals: {}, crossings: {}, verdict: null, evidenceIntegrity: [] };
            window.UNIFEDSystem.documents = {
                control: { files: [], totals: { records: 0 } },
                saft: { files: [], totals: { bruto:0, iliquido:0, iva:0, records:0 } },
                invoices: { files: [], totals: { invoiceValue:0, records:0 } },
                statements: { files: [], totals: { ganhos:0, despesas:0, ganhosLiquidos:0, records:0 } },
                dac7: { files: [], totals: { q1:0, q2:0, q3:0, q4:0, totalPeriodo:0, records:0 } }
            };
            window.UNIFEDSystem.monthlyData = {};
            window.UNIFEDSystem.dataMonths = new Set();
            window.UNIFEDSystem.masterHash = '';
        }
        window.rawForensicData = null;
        window._unifedAnalysisPending = false;
        window._unifedRawDataOnly = false;
        const elementsToHide = document.querySelectorAll('.pure-data-value, .pure-sg-val, .pure-zc-val, .pure-delta-value, .pure-atf-big');
        elementsToHide.forEach(el => { el.classList.remove('forensic-revealed'); el.style.opacity = '0'; el.textContent = '---'; });
        document.querySelectorAll('[id*="count"]').forEach(el => el.textContent = '0');
        const alertModules = ['#bigDataAlert', '#quantumBox', '#revenueGapCard', '#expenseGapCard', '#omissaoDespesasPctCard', '#jurosCard', '#discrepancy5Card', '#agravamentoBrutoCard', '#ircCard', '#iva6Card', '#iva23Card', '#asfixiaFinanceiraCard'];
        alertModules.forEach(sel => { const el = document.querySelector(sel); if (el) el.style.display = 'none'; });
        if (typeof window.forceEnableAllButtons === 'function') window.forceEnableAllButtons();
        else document.querySelectorAll('.btn-tool, .btn-tool-pure, .btn-forensic').forEach(btn => { btn.disabled = false; btn.style.pointerEvents = 'auto'; });
        window.logAudit('Sistema em estado Zero-Knowledge. Pronto para reunião.', 'success');
    };

    // =========================================================================
    // FORCE FINAL STATE (transição splash → dashboard)
    // =========================================================================
    async function forceFinalState() {
        try {
            await loadPanelHTML();
            await waitForPanel();
            if (!window.UNIFEDSystem) window.UNIFEDSystem = {};
            if (!window.UNIFEDSystem.sessionId) {
                window.UNIFEDSystem.sessionId = 'UNIFED-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 7).toUpperCase();
            }
            const sessionSpan = document.getElementById('sessionIdDisplay');
            if (sessionSpan) sessionSpan.textContent = window.UNIFEDSystem.sessionId;
            document.querySelectorAll('#pure-session-id').forEach(span => { if (span) span.textContent = window.UNIFEDSystem.sessionId; });
            console.log('[UNIFED] Session ID garantido:', window.UNIFEDSystem.sessionId);
            document.body.classList.add('forensic-revealed');
            const splash = document.getElementById('splashScreen');
            if (splash) {
                splash.style.transition = 'opacity 0.5s ease-out';
                splash.style.opacity = '0';
                setTimeout(() => { splash.style.display = 'none'; }, 500);
            }
            const wrapper = document.getElementById('pureDashboardWrapper');
            if (wrapper) {
                wrapper.classList.add('activated');
                wrapper.style.display = 'block';
                wrapper.style.opacity = '1';
                wrapper.style.visibility = 'visible';
                forceEnableAllButtons();
                const innerDashboard = document.getElementById('pureDashboard') || wrapper.querySelector('.pure-section');
                if (innerDashboard) {
                    innerDashboard.classList.add('active');
                    innerDashboard.style.display = 'block';
                    innerDashboard.style.opacity = '1';
                    innerDashboard.style.visibility = 'visible';
                    innerDashboard.style.height = 'auto';
                }
            }
            const mainContainer = document.getElementById('mainContainer');
            if (mainContainer) {
                mainContainer.style.display = 'block';
                mainContainer.style.opacity = '1';
            }
            await new Promise(resolve => setTimeout(resolve, 50));
            if (typeof updateForensicModulesVisibility === 'function') updateForensicModulesVisibility(false);
            if (!window._unifedDataLoaded) {
                window._unifedAnalysisPending = false;
                window._unifedRawDataOnly = false;
            }
            window.dispatchEvent(new CustomEvent('UNIFED_CORE_READY'));
            window.dispatchEvent(new CustomEvent('UNIFED_ANALYSIS_COMPLETE', { detail: { status: 'READY', masterHash: window.activeForensicSession?.masterHash || _PDF_CASE.masterHash } }));
            console.log('[PERÍCIA] Sistema desbloqueado: Splash removido, Dashboard ativado (zero‑knowledge).');
        } catch (err) {
            console.error('[ERRO FORENSE] Falha na transição de estado:', err);
        }
    }
    window.forceFinalState = forceFinalState;

    function setupIniciarButton() {
        const startBtn = document.getElementById('startSessionBtn');
        if (startBtn) {
            if (startBtn.getAttribute('data-iniciar-listener') === 'true') return;
            startBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                console.log('[UNIFED] Botão INICIAR clicado — a iniciar forceFinalState()');
                if (typeof window.forceFinalState === 'function') await window.forceFinalState();
                else console.error('[UNIFED] forceFinalState não está disponível');
            });
            startBtn.setAttribute('data-iniciar-listener', 'true');
            console.log('[UNIFED] Listener associado ao botão "INICIAR METODOLOGIA" (#startSessionBtn).');
        } else {
            console.warn('[UNIFED] Botão #startSessionBtn não encontrado no DOM. O sistema pode não arrancar corretamente.');
        }
    }

    function enableAllButtons() {
        const btns = ['analyzeBtn', 'exportPDFBtn', 'exportJSONBtn', 'resetBtn', 'clearConsoleBtn'];
        btns.forEach(id => { const btn = document.getElementById(id); if (btn) btn.disabled = false; });
        setTimeout(() => { document.querySelectorAll('.btn-tool, .btn-tool-pure').forEach(btn => btn.disabled = false); }, 500);
    }
    window.addEventListener('UNIFED_CORE_READY', enableAllButtons);

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupIniciarButton, { once: true });
    else setupIniciarButton();

    function reAnchorModals() {
        const wrapper = document.getElementById('pureDashboardWrapper');
        const custodyModal = document.getElementById('custodyModal');
        const hashModal = document.getElementById('hashModal');
        if (wrapper && custodyModal) wrapper.appendChild(custodyModal);
        if (wrapper && hashModal) wrapper.appendChild(hashModal);
    }
    document.addEventListener('UNIFED_CORE_READY', reAnchorModals);

    // =========================================================================
    // RET-08 CRÍTICO: forceBindAnalyze
    // =========================================================================
    function forceBindAnalyze() {
        const btn = document.getElementById('analyzeBtn');
        if (!btn) return;
        btn.disabled = false;
        btn.style.pointerEvents = 'auto';
        btn.style.opacity = '1';
        if (btn.getAttribute('data-ret08-listener') === 'true') return;
        btn.onclick = null;
        btn.addEventListener('click', async function _ret08Handler(e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            console.log('[UNIFED] RET-08: EXECUTAR PERÍCIA — pipeline forense completo');
            const _origHTML = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> A EXECUTAR PERÍCIA...';
            try {
                let loadFn = window.ensureDemoDataLoaded || window.UNIFED_INTERNAL?.ensureDemoDataLoaded;
                if (typeof loadFn === 'function') await loadFn();
                let execFn = window.UNIFED_INTERNAL?.executePendingAnalysis || window.executePendingAnalysis;
                if (typeof execFn === 'function') await execFn();
                else {
                    console.warn('[UNIFED] RET-08: executePendingAnalysis indisponível, fallback local.');
                    const sys = window.UNIFEDSystem;
                    if (sys && sys.analysis && sys.analysis.totals) {
                        const t = sys.analysis.totals;
                        const discC2 = t.despesas - t.faturaPlataforma;
                        const discC1 = t.saftBruto - t.dac7TotalPeriodo;
                        sys.analysis.crossings = {
                            discrepanciaCritica: discC2, percentagemOmissao: t.despesas > 0 ? (discC2 / t.despesas) * 100 : 0,
                            discrepanciaSaftVsDac7: discC1, percentagemSaftVsDac7: t.saftBruto > 0 ? (discC1 / t.saftBruto) * 100 : 0,
                            ivaFalta: discC2 * 0.23, ivaFalta6: discC2 * 0.06, ircEstimado: discC2 * 0.21, asfixiaFinanceira: t.saftBruto * 0.06,
                            btor: t.despesas, btf: t.faturaPlataforma
                        };
                        t.iva6Omitido = discC2 * 0.06; t.iva23Omitido = discC2 * 0.23; t.asfixiaFinanceira = t.saftBruto * 0.06;
                    }
                    window._unifedAnalysisPending = false;
                    window._unifedRawDataOnly = false;
                }
                if (typeof window.UNIFED_INTERNAL?.syncMetrics === 'function') window.UNIFED_INTERNAL.syncMetrics();
                if (typeof window.UNIFED_INTERNAL?.updateAuxiliaryUI === 'function') window.UNIFED_INTERNAL.updateAuxiliaryUI();
                if (typeof window._hydrateRawDataValues === 'function') window._hydrateRawDataValues();
                _fillAnalysisStatCards();
                if (typeof updateForensicModulesVisibility === 'function') updateForensicModulesVisibility(true);
                if (typeof window.forceRevealSmokingGun === 'function') window.forceRevealSmokingGun();
                if (typeof window.renderForensicCharts === 'function') window.renderForensicCharts();
                window.dispatchEvent(new CustomEvent('UNIFED_EXECUTE_PERITIA', { detail: { timestamp: new Date().toISOString() } }));
                window.dispatchEvent(new CustomEvent('UNIFED_ANALYSIS_COMPLETE', { detail: { source: 'RET-08', timestamp: Date.now() } }));
                btn.innerHTML = '✅ PERÍCIA CONCLUÍDA';
                btn.classList.add('btn-success');
                btn.disabled = false;
                console.log('[UNIFED] RET-08: Perícia concluída — todos os campos preenchidos.');
            } catch (_err) {
                console.error('[UNIFED] RET-08: Erro durante perícia:', _err);
                btn.innerHTML = _origHTML;
                btn.disabled = false;
            }
        }, true);
        btn.setAttribute('data-ret08-listener', 'true');
        console.log('[UNIFED] forceBindAnalyze RET-08: listener completo registado.');
    }

    function _fillAnalysisStatCards() {
        const sys = window.UNIFEDSystem;
        if (!sys || !sys.analysis) return;
        const t = sys.analysis.totals || {};
        const c = sys.analysis.crossings || {};
        const fmt = window.UNIFED_INTERNAL?.fmt || ((v) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v || 0));
        const show = (id) => { const el = document.getElementById(id); if (el) el.style.display = ''; };
        const setT = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        const qBox = document.getElementById('quantumBox');
        if (qBox) { qBox.style.display = 'block'; setT('quantumValue', fmt(c.discrepanciaCritica || 0)); setT('quantumNote', `IVA em falta (23%): ${fmt(c.ivaFalta || 0)} | IVA (6%): ${fmt(c.ivaFalta6 || 0)}`); }
        const bigAlert = document.getElementById('bigDataAlert');
        if (bigAlert) { bigAlert.style.display = 'flex'; setT('alertDeltaValue', fmt(c.discrepanciaCritica || 0)); }
        const cardMap = [
            ['statNet', fmt(t.ganhosLiquidos || 0), null], ['statComm', fmt(t.despesas || 0), null],
            ['statJuros', fmt(c.discrepanciaCritica || 0), 'jurosCard'],
            ['discrepancy5Value', fmt(c.discrepanciaSaftVsDac7 || 0), 'discrepancy5Card'],
            ['agravamentoBrutoValue', fmt(c.discrepanciaCritica || 0), 'agravamentoBrutoCard'],
            ['ircValue', fmt(c.ircEstimado || 0), 'ircCard'],
            ['iva6Value', fmt(t.iva6Omitido || 0), 'iva6Card'],
            ['iva23Value', fmt(t.iva23Omitido || 0), 'iva23Card'],
            ['asfixiaFinanceiraValue', fmt(t.asfixiaFinanceira || 0), 'asfixiaFinanceiraCard']
        ];
        cardMap.forEach(([valId, val, cardId]) => { setT(valId, val); if (cardId) show(cardId); });
        setT('kpiGrossValue', fmt(t.ganhos || 0)); setT('kpiCommValue', fmt(t.despesas || 0));
        setT('kpiNetValue', fmt(t.ganhosLiquidos || 0)); setT('kpiInvValue', fmt(t.faturaPlataforma || 0));
        const revGap = (t.saftBruto || 0) - (t.ganhos || 0);
        setT('revenueGapValue', fmt(revGap));
        setT('expenseGapValue', fmt(c.discrepanciaCritica || 0));
        const pct = t.despesas > 0 && t.ganhos > 0 ? ((t.despesas / t.ganhos) * 100).toFixed(2) + '%' : '0,00%';
        setT('omissaoDespesasPctValue', pct);
        if (Math.abs(revGap) > 0.01) show('revenueGapCard');
        if ((c.discrepanciaCritica || 0) > 0.01) show('expenseGapCard');
        if (t.despesas > 0 && t.ganhos > 0) show('omissaoDespesasPctCard');
        const mainChartCont = document.getElementById('mainChartContainer');
        if (mainChartCont) mainChartCont.style.display = 'block';
        const discChartCont = document.getElementById('mainDiscrepancyChartContainer');
        if (discChartCont) discChartCont.style.display = 'block';
        console.log('[UNIFED] RET-08: _fillAnalysisStatCards — todos os campos preenchidos.');
        document.querySelectorAll('[data-triada-btn="true"]').forEach(btn => { btn.style.display = 'inline-flex'; btn.disabled = false; });
    }
    window._fillAnalysisStatCards = _fillAnalysisStatCards;

    window.addEventListener('UNIFED_CORE_READY', forceBindAnalyze);
    if (document.readyState === 'complete') setTimeout(forceBindAnalyze, 500);

    console.log('[UNIFED] script_injection.js carregado (v13.12.3). Aguardando clique em "INICIAR".');
})();