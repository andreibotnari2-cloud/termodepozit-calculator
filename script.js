/* ===================================================
   TermoDepozit — Calculator kW + costuri + grafic lunar
   =================================================== */

/* ===== TARIFE ACTUALE MD ===== */
const TARIFF = {
    electricNord:  3.95,   // FEE Nord (lei/kWh)
    electricSud:   3.56,   // Premier Energy centru & sud (lei/kWh)
    gaz:           14.42,  // lei/m³ cu TVA
    lemn:          1000,   // lei/m³ster (medie lemn tare)
};

/* ===== ORE ECHIVALENT SEZON COMPLET (full-load hours) =====
   Bazat pe HDD/CDD Moldova și temperatura de calcul:
   Nord (Bălți):    iarnă -24°C, vară +28°C
   Centru (Chișinău): iarnă -22°C, vară +30°C
   Sud (Causeni):   iarnă -20°C, vară +33°C  */
const HEAT_HOURS = { nord: 1900, centru: 1750, sud: 1580 };
const COOL_HOURS = { nord: 550,  centru: 680,  sud: 860  };

/* ===== DISTRIBUȚIE LUNARĂ (% din total anual)
   Calculat din grad-zile reale ale Republicii Moldova ===== */
const MONTHLY_HEAT_PCT = {
    nord:   [24, 21, 16,  7,  1,  0,  0,  0,  1,  7, 12, 11],
    centru: [22, 19, 15,  7,  1,  0,  0,  0,  1,  8, 14, 13],
    sud:    [21, 18, 14,  8,  2,  0,  0,  0,  2,  9, 14, 12],
};
const MONTHLY_COOL_PCT = {
    nord:   [ 0,  0,  0,  0,  1, 16, 42, 30,  9,  2,  0,  0],
    centru: [ 0,  0,  0,  0,  2, 18, 40, 30,  8,  2,  0,  0],
    sud:    [ 0,  0,  0,  0,  3, 17, 37, 32,  9,  2,  0,  0],
};

const MONTHS_RO = ['Ian','Feb','Mar','Apr','Mai','Iun','Iul','Aug','Sep','Oct','Nov','Dec'];

let heatChart = null;
let coolChart = null;

/* ===== STATE ===== */
const state = {
    serviciu: null, tip: null, etaj: 'mijloc', etaje: '1',
    area: null, izolatie: null, expunere: null, zona: null,
    category: null, kwHeat: null, kwCool: null,
    annualHeatKwh: 0, annualCoolKwh: 0,
};

/* ===== HEADER ===== */
function toggleMenu() {
    document.getElementById('nav').classList.toggle('open');
    document.getElementById('hamburger').classList.toggle('open');
}
document.querySelectorAll('.nav a').forEach(a =>
    a.addEventListener('click', () => {
        document.getElementById('nav').classList.remove('open');
        document.getElementById('hamburger').classList.remove('open');
    })
);
window.addEventListener('scroll', () => {
    document.getElementById('header').style.boxShadow =
        window.scrollY > 10 ? '0 2px 20px rgba(0,0,0,.1)' : 'none';
});

/* ===== STEP NAVIGATION ===== */
const STEP_PROGRESS = { step1: 16.6, step2: 33, step3: 50, step4: 66, step5: 83, step6: 100, stepResult: 100 };
const STEP_INDEX    = { step1: 1, step2: 2, step3: 3, step4: 4, step5: 5, step6: 6 };

function showStep(id) {
    document.querySelectorAll('.c-step').forEach(el => el.classList.remove('active'));
    document.getElementById(id)?.classList.add('active');

    document.getElementById('cpFill').style.width = (STEP_PROGRESS[id] || 16) + '%';

    const cur = STEP_INDEX[id] || 99;
    for (let i = 1; i <= 6; i++) {
        const dot = document.getElementById('cps' + i);
        if (!dot) continue;
        dot.classList.remove('active', 'done');
        if (i < cur)  dot.classList.add('done');
        if (i === cur) dot.classList.add('active');
    }
    document.getElementById('calculator').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function goStep(from, to) {
    showStep(to === 'r' ? 'stepResult' : 'step' + to);
}

/* Serviciu predefinit per categorie */
const CATEGORY_SERVICIU = {
    gaz:   'incalzire',
    lemn:  'incalzire',
    podea: 'incalzire',
    ac:    'racire',
    pompa: 'ambele',
    cheie: 'ambele',
};

function goToCalcWithCategory(cat) {
    state.category = cat;
    const svc = CATEGORY_SERVICIU[cat] || null;
    state.serviciu = svc;

    document.getElementById('calculator').scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (svc) {
        document.querySelectorAll('.choice-btn[data-field="serviciu"]').forEach(b => {
            b.classList.toggle('selected', b.dataset.value === svc);
        });
        document.getElementById('next1').disabled = false;
        setTimeout(() => showStep('step2'), 320);
    }
}

/* ===== CHOICE CONTROLS ===== */
function pick(btn) {
    const { field, value } = btn.dataset;
    state[field] = value;

    btn.closest('.choice-grid').querySelectorAll(`.choice-btn[data-field="${field}"]`)
       .forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');

    if (field === 'tip') {
        document.getElementById('sqApart').style.display = value === 'apartament' ? 'block' : 'none';
        document.getElementById('sqHouse').style.display = value === 'casa'       ? 'block' : 'none';
    }
    const nxtMap = { serviciu: 'next1', tip: 'next2', izolatie: 'next4', expunere: 'next5', zona: 'next6' };
    const nb = nxtMap[field];
    if (nb) document.getElementById(nb).disabled = false;
}

function pickTag(btn) {
    state[btn.dataset.field] = btn.dataset.value;
    btn.closest('.tag-row').querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

/* ===== AREA INPUT ===== */
function onAreaInput() {
    const val = parseFloat(document.getElementById('areaInp').value);
    document.getElementById('next3').disabled = !(val > 0);
    if (val > 0) state.area = val;
}
function setArea(v) {
    document.getElementById('areaInp').value = v;
    onAreaInput();
}

/* ===== CALCULATE ===== */
function calculate() {
    const { tip, etaj, etaje, area, izolatie, expunere, zona } = state;

    /* --- Heating W/m² base --- */
    const baseHeat = {
        apartament: { slaba: 108, medie: 85, buna: 64 },
        casa:       { slaba: 148, medie: 115, buna: 84 },
    };
    let wH = baseHeat[tip][izolatie];
    wH *= { nord: 1.10, centru: 1.00, sud: 0.90 }[zona];
    if (tip === 'apartament' && etaj === 'extrem') wH *= 1.15;
    if (tip === 'casa') wH *= ({ '1': 1.15, '2': 1.00, '3': 0.95 })[etaje];
    wH *= { scazuta: 1.00, medie: 1.03, ridicata: 1.07 }[expunere];
    wH *= 1.15; // rezervă 15%
    const kwHeat = roundHalf((area * wH) / 1000);

    /* --- Cooling W/m² base --- */
    const baseCool = {
        apartament: { slaba: 95, medie: 78, buna: 62 },
        casa:       { slaba: 102, medie: 84, buna: 68 },
    };
    let wC = baseCool[tip][izolatie];
    wC *= { nord: 0.88, centru: 1.00, sud: 1.15 }[zona];
    wC *= { scazuta: 0.80, medie: 1.00, ridicata: 1.28 }[expunere];
    if (tip === 'apartament' && etaj === 'extrem') wC *= 1.22;
    if (tip === 'casa' && etaje === '1') wC *= 1.10;
    wC *= 1.10;
    const kwCool = roundHalf((area * wC) / 1000);

    /* Annual energy (kWh) = design_kW × equivalent_full_load_hours */
    const annualHeatKwh = kwHeat * HEAT_HOURS[zona];
    const annualCoolKwh = kwCool * COOL_HOURS[zona];

    Object.assign(state, { kwHeat, kwCool, annualHeatKwh, annualCoolKwh });

    renderResult();
    showStep('stepResult');
}

function roundHalf(v) { return Math.ceil(v * 2) / 2; }

/* ===== RENDER RESULT ===== */
function renderResult() {
    const { serviciu, tip, etaj, etaje, area, izolatie, expunere, zona,
            kwHeat, kwCool, annualHeatKwh, annualCoolKwh } = state;

    const needHeat = serviciu !== 'racire';
    const needCool = serviciu !== 'incalzire';

    /* Summary line */
    const svcMap = { incalzire: 'Încălzire', racire: 'Răcire', ambele: 'Încălzire + Răcire' };
    document.getElementById('rcSummaryLine').textContent =
        `${svcMap[serviciu]} · ${tip === 'apartament' ? 'Apartament' : 'Casă'} · ${area} m²`;

    /* KW blocks */
    const kwRow = document.getElementById('rcKwRow');
    kwRow.className = 'rc-kw-row' + (needHeat && needCool ? ' dual' : '');
    kwRow.innerHTML = (needHeat ? `
        <div class="kw-block kw-block-heat">
          <div class="kw-label">🔥 Încălzire</div>
          <div class="kw-value"><span class="kw-num" id="kwNumH">0</span><span class="kw-unit">kW</span></div>
          <div class="kw-sub">putere termică necesară</div>
        </div>` : '') +
        (needCool ? `
        <div class="kw-block kw-block-cool">
          <div class="kw-label">❄️ Răcire</div>
          <div class="kw-value"><span class="kw-num" id="kwNumC">0</span><span class="kw-unit">kW</span></div>
          <div class="kw-sub">putere de răcire necesară</div>
        </div>` : '');

    if (needHeat) animNum('kwNumH', kwHeat);
    if (needCool) animNum('kwNumC', kwCool);

    /* Tags */
    const izoMap  = { slaba: '🧱 Izolație slabă', medie: '🏗️ Standard', buna: '🌿 Izolație bună' };
    const solMap  = { scazuta: '🌑 Soare mic', medie: '⛅ Moderat', ridicata: '☀️ Soare mare' };
    const zonaMap = { nord: '❄️ Nord MD', centru: '🌡️ Centru MD', sud: '☀️ Sud MD' };
    const tipLabel = tip === 'apartament'
        ? `Apartament${etaj === 'extrem' ? ' (etaj extrem)' : ''}`
        : `Casă (${etaje === '3' ? '3+' : etaje} ${etaje === '1' ? 'etaj' : 'etaje'})`;

    document.getElementById('rcTags').innerHTML =
        `<span class="rc-tag">${tipLabel}</span>
         <span class="rc-tag">${area} m²</span>
         <span class="rc-tag">${izoMap[izolatie]}</span>
         <span class="rc-tag">${solMap[expunere]}</span>
         <span class="rc-tag">${zonaMap[zona]}</span>`;

    /* Recommendation */
    document.getElementById('rcRecText').innerHTML =
        getRecommendation(kwHeat, kwCool, serviciu, state.category);

    /* Pipe calc for underfloor heating */
    if (state.category === 'podea') {
        renderPipeCalc(area);
    } else {
        document.getElementById('pipeCalcSection').innerHTML = '';
    }

    /* Cost breakdown + monthly chart */
    renderCostBreakdown(needHeat, needCool, annualHeatKwh, annualCoolKwh, zona, kwHeat, kwCool);

    /* Pre-fill form message */
    const fMsg = document.getElementById('fMsg');
    if (fMsg && !fMsg.value) {
        const p = [];
        if (needHeat) p.push(`Încălzire: ${kwHeat} kW`);
        if (needCool) p.push(`Răcire: ${kwCool} kW`);
        fMsg.value = `${tipLabel}, ${area} m² — ${p.join(', ')}`;
    }
}

/* ===== COST BREAKDOWN + MONTHLY CHART ===== */
/* ===== PIPE CALC — Podele calde ===== */
function renderPipeCalc(area) {
    const MAX_LOOP = 100;

    const spacings = [
        { mm: 100, label: '10 cm', note: 'Baie / hol (densitate maximă)' },
        { mm: 150, label: '15 cm', note: 'Standard rezidențial' },
        { mm: 200, label: '20 cm', note: 'Camere bine izolate' },
    ];

    const rows = spacings.map(s => {
        const L    = Math.round((area / (s.mm / 1000)) * 1.10);
        const circ = Math.ceil(L / MAX_LOOP);
        return { ...s, L, circ };
    });

    const rec = rows[1]; // 150mm recomandat

    let html = `
    <div class="pipe-section">
        <div class="pipe-title">
            <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/></svg>
            Calcul țeavă podea caldă — ${area} m²
        </div>

        <div class="pipe-rec-card">
            <div class="pipe-rec-header">
                <span class="pipe-rec-badge">✓ Recomandat standard rezidențial</span>
                <span class="pipe-rec-spacing">Pas 15 cm · PE-X 16×2mm</span>
            </div>
            <div class="pipe-rec-values">
                <div class="pipe-rec-val">
                    <span class="prv-num">${rec.L.toLocaleString('ro-MD')}</span>
                    <span class="prv-unit">m țeavă</span>
                </div>
                <div class="pipe-rec-val">
                    <span class="prv-num">${rec.circ}</span>
                    <span class="prv-unit">${rec.circ === 1 ? 'circuit' : 'circuite'}</span>
                </div>
                <div class="pipe-rec-val">
                    <span class="prv-num">1/${rec.circ}</span>
                    <span class="prv-unit">distribuitor</span>
                </div>
            </div>
        </div>

        <div class="pipe-table-wrap">
            <table class="pipe-table">
                <thead>
                    <tr>
                        <th>Pas țeavă</th>
                        <th>Utilizare</th>
                        <th>Lungime totală</th>
                        <th>Circuite</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map((r, i) => `
                    <tr class="${i === 1 ? 'tr-rec' : ''}">
                        <td><strong>${r.label}</strong></td>
                        <td><span class="pipe-note">${r.note}</span></td>
                        <td><strong>${r.L.toLocaleString('ro-MD')} m</strong></td>
                        <td>${r.circ} × 100m</td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>

        <div class="pipe-offer-box">
            <div class="pipe-offer-text">
                <strong>Vrei cel mai bun preț la țeavă PE-X din Moldova?</strong>
                <span>Solicită oferta TermoDepozit — livrare rapidă, materiale certificate, montaj la cheie.</span>
            </div>
            <button class="btn btn-primary pipe-offer-btn" onclick="document.getElementById('offerForm').scrollIntoView({behavior:'smooth'})">
                Cere ofertă gratuită
            </button>
        </div>

        <div class="pipe-notes">
            <div class="pipe-note-item">🔧 <strong>Distribuitor</strong>: colector cu ${rec.circ} ${rec.circ === 1 ? 'circuit' : 'circuite'} — robineți termostatici incluși în oferta noastră.</div>
            <div class="pipe-note-item">🏗️ <strong>Șapă</strong>: min 5–7 cm peste țeavă (autonivelantă sau tradițională).</div>
            <div class="pipe-note-item">📐 <strong>Notă</strong>: calculul e pentru ${area} m² cu o singură zonă. Camere separate cu termostate individuale pot necesita mai multe circuite.</div>
        </div>
    </div>`;

    document.getElementById('pipeCalcSection').innerHTML = html;
}


function renderCostBreakdown(needHeat, needCool, heatKwh, coolKwh, zona, kwHeat, kwCool) {
    const tariffEl = zona === 'nord' ? TARIFF.electricNord : TARIFF.electricSud;

    /* Annual costs per system */
    const costs = {};

    if (needHeat) {
        /* Pompă căldură — SCOP sezonier 3.4 */
        costs.hpHeat  = heatKwh / 3.4 * tariffEl;
        /* Cazan gaz — eff 93%, 1m³ = 10.35 kWh */
        costs.gazHeat = heatKwh / (10.35 * 0.93) * TARIFF.gaz;
        /* Cazan lemn tare — 1 m³ster = 1600 kWh util net */
        costs.lemnHeat = heatKwh / 1600 * TARIFF.lemn;
    }
    if (needCool) {
        /* Pompă căldură — SEER sezonier 4.5 */
        costs.hpCool  = coolKwh / 4.5 * tariffEl;
        /* AC Inverter — SEER 5.0 */
        costs.acInvCool = coolKwh / 5.0 * tariffEl;
        /* AC Standard — SEER 3.5 */
        costs.acStdCool = coolKwh / 3.5 * tariffEl;
    }

    /* Build HTML */
    let html = `<div class="cost-wrap">`;

    /* Annual summary cards */
    html += `<div class="cost-annual">
        <div class="cost-annual-title">💸 Estimare costuri anuale — sezon complet</div>
        <div class="cost-annual-grid">`;

    if (needHeat) {
        html += `
          <div class="cost-sys-card">
            <div class="cost-sys-header heat-header">🔥 Încălzire · ${kwHeat} kW · ${Math.round(heatKwh).toLocaleString('ro-MD')} kWh/an</div>
            <div class="cost-sys-rows">
              <div class="cost-sys-row best-row">
                <span class="cost-sys-ico">♻️</span>
                <span class="cost-sys-name">Pompă de căldură <span class="best-tag">Cel mai ieftin</span></span>
                <span class="cost-sys-val">${fmtLei(costs.hpHeat)} lei/an</span>
              </div>
              <div class="cost-sys-row">
                <span class="cost-sys-ico">🔥</span>
                <span class="cost-sys-name">Cazan pe gaz</span>
                <span class="cost-sys-val">${fmtLei(costs.gazHeat)} lei/an</span>
              </div>
              <div class="cost-sys-row">
                <span class="cost-sys-ico">🪵</span>
                <span class="cost-sys-name">Cazan pe lemn</span>
                <span class="cost-sys-val">${fmtLei(costs.lemnHeat)} lei/an</span>
              </div>
            </div>
          </div>`;
    }

    if (needCool) {
        html += `
          <div class="cost-sys-card">
            <div class="cost-sys-header cool-header">❄️ Răcire · ${kwCool} kW · ${Math.round(coolKwh).toLocaleString('ro-MD')} kWh/an</div>
            <div class="cost-sys-rows">
              <div class="cost-sys-row best-row">
                <span class="cost-sys-ico">♻️</span>
                <span class="cost-sys-name">Pompă de căldură <span class="best-tag">Cel mai ieftin</span></span>
                <span class="cost-sys-val">${fmtLei(costs.hpCool)} lei/an</span>
              </div>
              <div class="cost-sys-row">
                <span class="cost-sys-ico">❄️</span>
                <span class="cost-sys-name">AC Inverter</span>
                <span class="cost-sys-val">${fmtLei(costs.acInvCool)} lei/an</span>
              </div>
              <div class="cost-sys-row">
                <span class="cost-sys-ico">🌀</span>
                <span class="cost-sys-name">AC Standard</span>
                <span class="cost-sys-val">${fmtLei(costs.acStdCool)} lei/an</span>
              </div>
            </div>
          </div>`;
    }

    html += `</div>`; // cost-annual-grid

    /* Tariff note */
    const tariffLabel = zona === 'nord' ? 'FEE Nord — 3,95 lei/kWh' : 'Premier Energy — 3,56 lei/kWh';
    html += `<p class="cost-note">Curent electric: ${tariffLabel} · Gaz: 14,42 lei/m³ · Lemn tare: ~1.000 lei/m³ster<br>Estimare bazată pe condiții climatice medii ale Republicii Moldova. Costurile reale pot varia ±15%.</p>`;
    html += `</div>`; // cost-annual

    /* Heating monthly chart */
    if (needHeat) {
        html += `
        <div class="monthly-wrap">
            <div class="monthly-header">
                <div class="monthly-title">🔥 Cost lunar Încălzire (lei)</div>
                <div class="monthly-selector" id="heatSelector"></div>
            </div>
            <div class="chart-container"><canvas id="monthlyHeatChart"></canvas></div>
        </div>`;
    }

    /* Cooling monthly chart */
    if (needCool) {
        html += `
        <div class="monthly-wrap">
            <div class="monthly-header">
                <div class="monthly-title">❄️ Cost lunar Răcire (lei)</div>
                <div class="monthly-selector" id="coolSelector"></div>
            </div>
            <div class="chart-container"><canvas id="monthlyCoolChart"></canvas></div>
        </div>`;
    }

    html += `</div>`; // cost-wrap

    const container = document.getElementById('costBreakdown');
    container.innerHTML = html;

    buildCharts(needHeat, needCool, costs, zona);
}

/* ===== CHARTS — separate heating & cooling ===== */
function buildCharts(needHeat, needCool, costs, zona) {
    const heatPct = MONTHLY_HEAT_PCT[zona].map(p => p / 100);
    const coolPct = MONTHLY_COOL_PCT[zona].map(p => p / 100);

    if (needHeat) {
        const systems = [
            { id: 'hp',   label: '\u267b\ufe0f Pomp\u0103 c\u0103ldur\u0103', annual: costs.hpHeat   },
            { id: 'gaz',  label: '\uD83D\uDD25 Cazan gaz',     annual: costs.gazHeat  },
            { id: 'lemn', label: '\uD83E\uDEB5 Cazan lemn',    annual: costs.lemnHeat },
        ];
        if (heatChart) { heatChart.destroy(); heatChart = null; }
        heatChart = makeChart('monthlyHeatChart', 'heatSelector', systems, heatPct,
            'rgba(255,107,53,0.88)', '#FF6B35',
            (id) => { heatChart.data.datasets[0].data = calcData(systems, id, heatPct); heatChart.update(); });
    }

    if (needCool) {
        const systems = [
            { id: 'hp_c', label: '\u267b\ufe0f Pomp\u0103 c\u0103ldur\u0103', annual: costs.hpCool    },
            { id: 'ac_i', label: '\u2744\ufe0f AC Inverter',   annual: costs.acInvCool },
            { id: 'ac_s', label: '\uD83C\uDF00 AC Standard',   annual: costs.acStdCool },
        ];
        if (coolChart) { coolChart.destroy(); coolChart = null; }
        coolChart = makeChart('monthlyCoolChart', 'coolSelector', systems, coolPct,
            'rgba(11,197,234,0.85)', '#0BC5EA',
            (id) => { coolChart.data.datasets[0].data = calcData(systems, id, coolPct); coolChart.update(); });
    }
}

function calcData(systems, activeId, pct) {
    const sys = systems.find(s => s.id === activeId) || systems[0];
    return pct.map(p => Math.round(p * sys.annual));
}

function makeChart(canvasId, selectorId, systems, pct, color, borderColor, onSwitch) {
    let activeId = systems[0].id;
    const sel = document.getElementById(selectorId);
    if (sel) {
        sel.innerHTML = systems.map(s =>
            `<button class="sys-btn${s.id === activeId ? ' active' : ''}" data-sid="${s.id}">${s.label}</button>`
        ).join('');
        sel.addEventListener('click', e => {
            const btn = e.target.closest('.sys-btn');
            if (!btn) return;
            activeId = btn.dataset.sid;
            sel.querySelectorAll('.sys-btn').forEach(b => b.classList.toggle('active', b.dataset.sid === activeId));
            onSwitch(activeId);
        });
    }

    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return null;

    return new Chart(ctx, {
        type: 'bar',
        data: {
            labels: MONTHS_RO,
            datasets: [{
                data: calcData(systems, activeId, pct),
                backgroundColor: color,
                borderColor,
                borderWidth: 0,
                borderRadius: 7,
                borderSkipped: false,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 24 } },
            plugins: {
                legend: { display: false },
                datalabels: {
                    anchor: 'end',
                    align: 'end',
                    offset: 2,
                    formatter: v => v > 0 ? v.toLocaleString('ro-MD') : '',
                    font: { size: 9.5, weight: '700' },
                    color: '#2D3748',
                    clamp: true,
                },
                tooltip: {
                    backgroundColor: '#1A202C',
                    titleColor: '#fff',
                    bodyColor: 'rgba(255,255,255,.85)',
                    padding: 12,
                    cornerRadius: 10,
                    displayColors: false,
                    callbacks: {
                        label: ctx => ctx.parsed.y.toLocaleString('ro-MD') + ' lei',
                    },
                },
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 11, weight: '600' }, color: '#4A5568' },
                },
                y: {
                    grid: { color: 'rgba(0,0,0,.05)', lineWidth: 1 },
                    border: { dash: [4, 4] },
                    ticks: { font: { size: 10 }, color: '#718096', callback: v => v.toLocaleString('ro-MD') },
                },
            },
        },
        plugins: [ChartDataLabels],
    });
}


/* ===== RECOMMENDATION ===== */
function getRecommendation(kwHeat, kwCool, serviciu, pref) {
    const needHeat = serviciu !== 'racire';
    const needCool = serviciu !== 'incalzire';

    if (needHeat && needCool) {
        const kw = kwHeat;
        if (kw <= 14) return `<strong>Pompă de căldură aer-apă 12–14 kW</strong> — un singur sistem pentru iarnă și vară. COP 3.5–4.5, economii 60–70% față de gaz. Include răcire completă vara.`;
        if (kw <= 26) return `<strong>Pompă de căldură aer-apă 18–24 kW</strong> — soluție completă încălzire + răcire. Investiția se amortizează în 4–6 ani față de gaz + AC separat.`;
        return `<strong>Pompă de căldură aer-apă 25–35 kW</strong> sau <strong>sistem VRF</strong> — acoperă integral ambele nevoi cu eficiență ridicată.`;
    }

    if (needHeat) {
        const k = kwHeat;
        if (pref === 'gaz') {
            if (k <= 14) return `<strong>Cazan gaz condensat 18–24 kW</strong> — eficiență &gt;96%, cost redus lunar.`;
            if (k <= 30) return `<strong>Cazan gaz condensat 24–35 kW</strong> — recomandat modele Viessmann sau Bosch cu control WiFi.`;
            return `<strong>Cazan gaz 35–70 kW</strong> — puere mare pentru suprafețe extinse.`;
        }
        if (pref === 'lemn') {
            if (k <= 20) return `<strong>Cazan pe lemn gazeificare 20–25 kW</strong> — randament ridicat, autonomie bună.`;
            if (k <= 40) return `<strong>Cazan lemn-cărbune 25–45 kW</strong> — flexibil, combustibili multipli.`;
            return `<strong>Cazan lemn-cărbune 50–100+ kW</strong> — pentru suprafețe mari, solicită consultație gratuită.`;
        }
        if (pref === 'pompa') return `<strong>Pompă de căldură aer-apă ${k} kW</strong> — cea mai eficientă soluție. COP 3.5+, include răcire vara.`;
        if (k <= 12) return `<strong>Pompă de căldură 10–12 kW</strong> sau <strong>cazan gaz 18–24 kW</strong>.`;
        if (k <= 25) return `<strong>Pompă de căldură 18–24 kW</strong> sau <strong>cazan gaz 24–32 kW</strong>. Pompa recomandat pentru economii pe termen lung.`;
        return `<strong>Cazan gaz 32+ kW</strong> sau <strong>cazan lemn-cărbune</strong> — solicită consultație gratuită.`;
    }

    if (needCool) {
        const k = kwCool;
        if (pref === 'ac') {
            if (k <= 7)  return `<strong>AC inverter split 7–9 kW</strong> (1–2 unități) — SEER 5+, control WiFi.`;
            if (k <= 14) return `<strong>Multi-split 12–14 kW</strong> — 3–4 unități interioare, control independent pe camere.`;
            return `<strong>Sistem VRF/VRV 15–30 kW</strong> — eficiență maximă pentru suprafețe mari.`;
        }
        if (k <= 7)  return `<strong>AC inverter split 7–9 kW</strong> sau <strong>pompă de căldură aer-aer 8 kW</strong>.`;
        if (k <= 14) return `<strong>Multi-split 12–16 kW</strong> sau <strong>pompă de căldură aer-apă</strong> — include și căldură iarna.`;
        return `<strong>Sistem VRF 15–30 kW</strong> — pentru suprafețe mari. Solicită consultație gratuită.`;
    }

    return 'Solicită o consultație gratuită — echipa noastră îți recomandă soluția optimă.';
}

/* ===== HELPERS ===== */
function fmtLei(v) { return Math.round(v).toLocaleString('ro-MD'); }
function animNum(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    let v = 0;
    const timer = setInterval(() => {
        v = Math.min(v + target / 40, target);
        el.textContent = v >= target ? target : v.toFixed(1);
        if (v >= target) clearInterval(timer);
    }, 18);
}

/* ===== FORM SUBMIT ===== */
async function submitForm(e) {
    e.preventDefault();
    const name  = document.getElementById('fName').value.trim();
    const phone = document.getElementById('fPhone').value.trim();
    if (!name || !phone) { alert('Te rugăm completează numele și telefonul.'); return; }

    const { serviciu, tip, area, izolatie, expunere, zona, kwHeat, kwCool } = state;
    const payload = {
        name, phone,
        email:   document.getElementById('fEmail').value.trim(),
        city:    document.getElementById('fCity').value.trim(),
        message: document.getElementById('fMsg').value.trim(),
        calc:    { serviciu, tip, area: area + ' m²', izolatie, expunere, zona,
                   kwHeat: kwHeat + ' kW', kwCool: kwCool + ' kW' },
        sentAt:  new Date().toLocaleString('ro-MD'),
    };

    /* === TELEGRAM BOT (completează și decomentează) ===
    const BOT_TOKEN = 'YOUR_BOT_TOKEN';
    const CHAT_ID   = 'YOUR_CHAT_ID';
    const svcLabel  = { incalzire: '🔥 Încălzire', racire: '❄️ Răcire', ambele: '🔥❄️ Ambele' };
    const text = `
🔔 *Cerere nouă — TermoDepozit*
👤 *Nume:* ${name}
📞 *Telefon:* ${phone}
📧 *Email:* ${payload.email || '—'}
📍 *Localitate:* ${payload.city || '—'}

📊 *Calcul:* ${svcLabel[serviciu]}
🏠 ${tip} · ${area} m² · ${izolatie} · ${expunere} · ${zona}
⚡ Încălzire: *${kwHeat} kW* · Răcire: *${kwCool} kW*

💬 ${payload.message || '—'}
🕐 ${payload.sentAt}`.trim();

    await fetch(\`https://api.telegram.org/bot\${BOT_TOKEN}/sendMessage\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'Markdown' }),
    });
    */

    console.log('Cerere nouă:', payload);

    document.getElementById('offerForm').style.display   = 'none';
    document.getElementById('formSuccess').style.display = 'block';
    document.getElementById('costBreakdown').style.display = 'none';
}

/* ===== RESET ===== */
function resetCalc() {
    Object.assign(state, {
        serviciu: null, tip: null, etaj: 'mijloc', etaje: '1',
        area: null, izolatie: null, expunere: null, zona: null,
        kwHeat: null, kwCool: null, annualHeatKwh: 0, annualCoolKwh: 0,
    });
    document.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));

    [['sqApart','etaj','mijloc'],['sqHouse','etaje','1']].forEach(([id,f,v]) => {
        document.getElementById(id)?.querySelector(`.tag-btn[data-value="${v}"]`)?.classList.add('active');
    });

    document.getElementById('areaInp').value = '';
    for (let i = 1; i <= 6; i++) {
        const b = document.getElementById('next' + i);
        if (b) b.disabled = true;
    }
    document.getElementById('offerForm').style.display   = 'block';
    document.getElementById('formSuccess').style.display = 'none';
    document.getElementById('costBreakdown').innerHTML    = '';
    ['fName','fPhone','fCity','fEmail','fMsg'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    if (heatChart) { heatChart.destroy(); heatChart = null; }
    if (coolChart) { coolChart.destroy(); coolChart = null; }
    showStep('step1');
}

/* ===== SCROLL ANIMATIONS ===== */
const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
        if (e.isIntersecting) {
            e.target.style.opacity   = '1';
            e.target.style.transform = 'translateY(0)';
        }
    });
}, { threshold: 0.1 });

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.cat-card, .adv-card, .loc-card').forEach((el, i) => {
        el.style.opacity   = '0';
        el.style.transform = 'translateY(28px)';
        el.style.transition = `opacity .5s ease ${i * 0.06}s, transform .5s ease ${i * 0.06}s`;
        io.observe(el);
    });
});
