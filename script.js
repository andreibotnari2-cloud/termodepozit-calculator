/* ===================================================
   TermoDepozit — Calculator kW + estimare costuri
   =================================================== */

/* ===== TARIFE (lei) ===== */
const TARIFF = {
    electric_centru_sud: 3.56,  // Premier Energy
    electric_nord:       3.95,  // FEE Nord
    gaz_m3:              14.42, // lei/m³
    lemn_ster:           1000,  // lei/m³ ster (medie)
};

/* ===== STATE ===== */
const state = {
    serviciu:  null,          // 'incalzire' | 'racire' | 'ambele'
    tip:       null,          // 'apartament' | 'casa'
    etaj:      'mijloc',      // 'mijloc' | 'extrem'
    etaje:     '1',           // '1' | '2' | '3'
    area:      null,
    izolatie:  null,          // 'slaba' | 'medie' | 'buna'
    expunere:  null,          // 'scazuta' | 'medie' | 'ridicata'
    zona:      null,          // 'nord' | 'centru' | 'sud'
    category:  null,
    kwHeat:    null,
    kwCool:    null,
};

/* ===== HEADER — hamburger + scroll shadow ===== */
function toggleMenu() {
    document.getElementById('nav').classList.toggle('open');
    document.getElementById('hamburger').classList.toggle('open');
}
document.querySelectorAll('.nav a').forEach(a => {
    a.addEventListener('click', () => {
        document.getElementById('nav').classList.remove('open');
        document.getElementById('hamburger').classList.remove('open');
    });
});
window.addEventListener('scroll', () => {
    document.getElementById('header').style.boxShadow =
        window.scrollY > 10 ? '0 2px 20px rgba(0,0,0,.1)' : 'none';
});

/* ===== STEP MANAGEMENT ===== */
const STEP_PROGRESS = { step1: 16.6, step2: 33, step3: 50, step4: 66, step5: 83, step6: 100, stepResult: 100 };
const STEP_INDEX    = { step1: 1, step2: 2, step3: 3, step4: 4, step5: 5, step6: 6 };

function showStep(id) {
    document.querySelectorAll('.c-step').forEach(el => el.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');

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
    const id = (to === 'r') ? 'stepResult' : 'step' + to;
    showStep(id);
}

/* ===== CATEGORY CARDS → open calculator ===== */
function goToCalcWithCategory(cat) {
    state.category = cat;
    document.getElementById('calculator').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ===== CHOICE BUTTONS ===== */
function pick(btn) {
    const field = btn.dataset.field;
    const value = btn.dataset.value;
    state[field] = value;

    btn.closest('.choice-grid').querySelectorAll('.choice-btn[data-field="' + field + '"]')
       .forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');

    /* sub-questions for step 2 */
    if (field === 'tip') {
        const sqA = document.getElementById('sqApart');
        const sqH = document.getElementById('sqHouse');
        if (sqA) sqA.style.display = value === 'apartament' ? 'block' : 'none';
        if (sqH) sqH.style.display = value === 'casa'       ? 'block' : 'none';
    }

    const nextMap = { serviciu: 'next1', tip: 'next2', izolatie: 'next4', expunere: 'next5', zona: 'next6' };
    const nb = nextMap[field];
    if (nb) document.getElementById(nb).disabled = false;
}

function pickTag(btn) {
    const field = btn.dataset.field;
    state[field] = btn.dataset.value;
    btn.closest('.tag-row').querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

/* ===== AREA INPUT ===== */
function onAreaInput() {
    const val = parseFloat(document.getElementById('areaInp').value);
    const nb  = document.getElementById('next3');
    if (nb) nb.disabled = !(val > 0);
    if (val > 0) state.area = val;
}
function setArea(v) {
    const inp = document.getElementById('areaInp');
    if (inp) { inp.value = v; onAreaInput(); }
}

/* ===== CALCULATE ===== */
function calculate() {
    const { tip, etaj, etaje, area, izolatie, expunere, zona } = state;

    /* ---- HEATING kW ---- */
    const baseHeat = {
        apartament: { slaba: 105, medie: 82, buna: 62 },
        casa:       { slaba: 145, medie: 112, buna: 82 },
    };
    let wHeat = baseHeat[tip][izolatie];

    /* climate (heating design temp) */
    const climHeat = { nord: 1.10, centru: 1.00, sud: 0.90 };
    wHeat *= climHeat[zona];

    /* floor factor */
    if (tip === 'apartament' && etaj === 'extrem') wHeat *= 1.15;
    if (tip === 'casa') wHeat *= ({ '1': 1.15, '2': 1.00, '3': 0.95 })[etaje];

    /* solar adds a small factor to heating need (window losses) */
    const solarHeat = { scazuta: 1.0, medie: 1.03, ridicata: 1.07 };
    wHeat *= solarHeat[expunere];

    wHeat *= 1.15; /* safety reserve */
    let kwHeat = roundHalf((area * wHeat) / 1000);

    /* ---- COOLING kW ---- */
    const baseCool = {
        apartament: { slaba: 92, medie: 76, buna: 60 },
        casa:       { slaba: 100, medie: 82, buna: 66 },
    };
    let wCool = baseCool[tip][izolatie];

    const climCool = { nord: 0.88, centru: 1.00, sud: 1.15 };
    wCool *= climCool[zona];

    const solarCool = { scazuta: 0.82, medie: 1.00, ridicata: 1.28 };
    wCool *= solarCool[expunere];

    /* top floor/last apt adds significant solar load */
    if (tip === 'apartament' && etaj === 'extrem') wCool *= 1.20;
    if (tip === 'casa' && etaje === '1') wCool *= 1.10;

    wCool *= 1.10; /* safety reserve */
    let kwCool = roundHalf((area * wCool) / 1000);

    state.kwHeat = kwHeat;
    state.kwCool = kwCool;

    renderResult();
    showStep('stepResult');
}

function roundHalf(v) { return Math.ceil(v * 2) / 2; }

/* ===== RENDER RESULT ===== */
function renderResult() {
    const { serviciu, tip, etaj, etaje, area, izolatie, expunere, zona, kwHeat, kwCool, category } = state;

    const needHeat = serviciu === 'incalzire' || serviciu === 'ambele';
    const needCool = serviciu === 'racire'    || serviciu === 'ambele';

    /* Summary line */
    const svcLabel = { incalzire: 'Încălzire', racire: 'Răcire', ambele: 'Încălzire + Răcire' }[serviciu];
    document.getElementById('rcSummaryLine').textContent =
        `${svcLabel} · ${tip === 'apartament' ? 'Apartament' : 'Casă'} · ${area} m²`;

    /* KW blocks */
    const kwRow = document.getElementById('rcKwRow');
    kwRow.className = 'rc-kw-row' + (needHeat && needCool ? ' dual' : '');

    let kwHtml = '';
    if (needHeat) {
        kwHtml += `
          <div class="kw-block kw-block-heat">
            <div class="kw-label">🔥 Încălzire</div>
            <div class="kw-value">
              <span class="kw-num" id="kwNumHeat">0</span>
              <span class="kw-unit">kW</span>
            </div>
            <div class="kw-sub">putere termică necesară</div>
          </div>`;
    }
    if (needCool) {
        kwHtml += `
          <div class="kw-block kw-block-cool">
            <div class="kw-label">❄️ Răcire</div>
            <div class="kw-value">
              <span class="kw-num" id="kwNumCool">0</span>
              <span class="kw-unit">kW</span>
            </div>
            <div class="kw-sub">putere de răcire necesară</div>
          </div>`;
    }
    kwRow.innerHTML = kwHtml;

    if (needHeat) animNum('kwNumHeat', kwHeat);
    if (needCool) animNum('kwNumCool', kwCool);

    /* Tags */
    const tipLabel  = tip === 'apartament'
        ? `Apartament${etaj === 'extrem' ? ' (etaj extrem)' : ''}`
        : `Casă (${etaje === '3' ? '3+' : etaje} ${etaje === '1' ? 'etaj' : 'etaje'})`;
    const izoLabel  = { slaba: '🧱 Izolație slabă', medie: '🏗️ Standard', buna: '🌿 Izolație bună' }[izolatie];
    const solLabel  = { scazuta: '🌑 Soare mic', medie: '⛅ Soare moderat', ridicata: '☀️ Soare mare' }[expunere];
    const zonaLabel = { nord: '❄️ Nord MD', centru: '🌡️ Centru MD', sud: '☀️ Sud MD' }[zona];

    document.getElementById('rcTags').innerHTML =
        `<span class="rc-tag">${tipLabel}</span>
         <span class="rc-tag">${area} m²</span>
         <span class="rc-tag">${izoLabel}</span>
         <span class="rc-tag">${solLabel}</span>
         <span class="rc-tag">${zonaLabel}</span>`;

    /* Recommendation */
    const rec = getRecommendation(kwHeat, kwCool, serviciu, category);
    document.getElementById('rcRecText').innerHTML = rec;

    /* Cost estimates */
    renderCosts(needHeat, needCool, kwHeat, kwCool, zona, area, izolatie);

    /* Pre-fill form message */
    const fMsg = document.getElementById('fMsg');
    if (fMsg && !fMsg.value) {
        const parts = [];
        if (needHeat) parts.push(`Încălzire: ${kwHeat} kW`);
        if (needCool) parts.push(`Răcire: ${kwCool} kW`);
        fMsg.value = `${tipLabel}, ${area} m², ${izoLabel.replace(/^.+ /,'')} — ${parts.join(', ')}`;
    }
}

/* ===== COST ESTIMATES ===== */
function renderCosts(needHeat, needCool, kwHeat, kwCool, zona, area, izolatie) {
    /* Tarif electric */
    const tariffEl = zona === 'nord' ? TARIFF.electric_nord : TARIFF.electric_centru_sud;

    /* --- Heating annual energy (kWh) ---
       Moldova: ~180 zile sezon, ~12h/zi, factor sarcina 0.58 */
    const heatEnergy = kwHeat * 180 * 12 * 0.58;

    /* --- Cooling annual energy (kWh) ---
       ~90 zile vară, ~8h/zi, factor 0.65 */
    const coolEnergy = kwCool * 90 * 8 * 0.65;

    let html = '<div class="cost-section">';
    html += '<div class="cost-title">Estimare costuri anuale (sezon complet)</div>';
    html += '<div class="cost-grid' + (needHeat && needCool ? ' dual' : '') + '">';

    if (needHeat) {
        /* Pompă căldură — SCOP 3.6 */
        const hpHeat = lei(heatEnergy / 3.6 * tariffEl);
        /* Cazan gaz — eff 92%, 1 m³ = 10.35 kWh */
        const gazCost = lei((heatEnergy / (10.35 * 0.92)) * TARIFF.gaz_m3);
        /* Cazan lemn — 1 m³ster = 1688 kWh util */
        const lemnCost = lei((heatEnergy / 1688) * TARIFF.lemn_ster);

        html += `
          <div class="cost-block">
            <div class="cost-block-header cost-block-heat-h">🔥 Încălzire — ${kwHeat} kW</div>
            <div class="cost-rows">
              <div class="cost-row">
                <div class="cost-row-label"><span class="cost-row-icon">♻️</span>Pompă de căldură</div>
                <div class="cost-row-price">${hpHeat} lei <small>/an</small></div>
              </div>
              <div class="cost-row">
                <div class="cost-row-label"><span class="cost-row-icon">🔥</span>Cazan pe gaz</div>
                <div class="cost-row-price">${gazCost} lei <small>/an</small></div>
              </div>
              <div class="cost-row">
                <div class="cost-row-label"><span class="cost-row-icon">🪵</span>Cazan pe lemn</div>
                <div class="cost-row-price">${lemnCost} lei <small>/an</small></div>
              </div>
            </div>
          </div>`;
    }

    if (needCool) {
        /* Pompă căldură răcire — SEER 4.0 */
        const hpCool = lei(coolEnergy / 4.0 * tariffEl);
        /* AC inverter split — SEER 5.0 */
        const acCool = lei(coolEnergy / 5.0 * tariffEl);
        /* AC standard — SEER 3.5 */
        const acStd  = lei(coolEnergy / 3.5 * tariffEl);

        html += `
          <div class="cost-block">
            <div class="cost-block-header cost-block-cool-h">❄️ Răcire — ${kwCool} kW</div>
            <div class="cost-rows">
              <div class="cost-row">
                <div class="cost-row-label"><span class="cost-row-icon">♻️</span>Pompă de căldură</div>
                <div class="cost-row-price">${hpCool} lei <small>/an</small></div>
              </div>
              <div class="cost-row">
                <div class="cost-row-label"><span class="cost-row-icon">❄️</span>AC Inverter</div>
                <div class="cost-row-price">${acCool} lei <small>/an</small></div>
              </div>
              <div class="cost-row">
                <div class="cost-row-label"><span class="cost-row-icon">🌀</span>AC Standard</div>
                <div class="cost-row-price">${acStd} lei <small>/an</small></div>
              </div>
            </div>
          </div>`;
    }

    html += '</div>';
    html += `<p class="cost-note">* Estimare orientativă bazată pe prețurile actuale: curent ${tariffEl} lei/kWh (${zona === 'nord' ? 'FEE Nord' : 'Premier Energy'}), gaz 14,42 lei/m³, lemn tare ~1.000 lei/m³ster.<br>Costurile reale variază în funcție de comportamentul utilizatorilor și condițiile climatice.</p>`;
    html += '</div>';

    /* Insert before offer form */
    const offerForm = document.getElementById('offerForm');
    let existingCost = document.getElementById('costEstimates');
    if (existingCost) existingCost.remove();

    const costDiv = document.createElement('div');
    costDiv.id = 'costEstimates';
    costDiv.innerHTML = html;
    offerForm.parentNode.insertBefore(costDiv, offerForm);
}

function lei(v) {
    return Math.round(v).toLocaleString('ro-MD');
}

/* ===== RECOMMENDATION ===== */
function getRecommendation(kwHeat, kwCool, serviciu, pref) {
    const needHeat = serviciu === 'incalzire' || serviciu === 'ambele';
    const needCool = serviciu === 'racire'    || serviciu === 'ambele';
    const both     = needHeat && needCool;

    /* Both = always push heat pump */
    if (both) {
        if (kwHeat <= 16)
            return '<strong>Pompă de căldură aer-apă 12–16 kW</strong> — soluția ideală pentru ambele nevoi dintr-un singur sistem. Economii 60–70% față de gaz și răcire completă vara. COP 3.5–4.5.';
        if (kwHeat <= 28)
            return '<strong>Pompă de căldură aer-apă 18–24 kW</strong> — un singur sistem pentru iarnă și vară. Investiție rentabilă în 4–6 ani față de gaz + AC separat.';
        return '<strong>Pompă de căldură aer-apă 25–35 kW sau sistem VRF</strong> — pentru suprafețe mari, acoperă întreaga nevoie de încălzire și răcire cu eficiență ridicată.';
    }

    if (needHeat && !needCool) {
        if (pref === 'gaz') {
            if (kwHeat <= 14) return `<strong>Cazan pe gaz condensat 18–24 kW</strong> — eficiență >96%, consum redus, ideal pentru apartamente și case mici. Reglaj automat inclus.`;
            if (kwHeat <= 28) return `<strong>Cazan pe gaz condensat 24–35 kW</strong> — performanță excelentă pentru case medii. Recomandăm modele cu control WiFi.`;
            return `<strong>Cazan pe gaz 35–70 kW</strong> — putere mare, control precis, potrivit pentru suprafețe extinse sau clădiri.`;
        }
        if (pref === 'lemn') {
            if (kwHeat <= 20) return `<strong>Cazan pe lemn cu gazeificare 20–25 kW</strong> — combustibil accesibil, randament ridicat, autonomie excelentă.`;
            if (kwHeat <= 40) return `<strong>Cazan pe lemn-cărbune 25–45 kW</strong> — flexibil, acceptă combustibili multipli, potrivit pentru case mari.`;
            return `<strong>Cazan pe lemn-cărbune 50–100+ kW</strong> — pentru suprafețe foarte mari. Recomandăm consultație tehnică gratuită.`;
        }
        if (pref === 'pompa') {
            return `<strong>Pompă de căldură aer-apă ${kwHeat} kW</strong> — cea mai eficientă soluție de încălzire. COP 3.5–4.5, economii 60–70% față de gaz. Include și funcție de răcire vară.`;
        }
        if (pref === 'podea') {
            return `<strong>Sistem podea caldă hidraulic sau electric</strong> — distribuție uniformă a căldurii, confort maxim. Compatibil cu orice cazan sau pompă de căldură.`;
        }
        /* auto */
        if (kwHeat <= 15) return `<strong>Cazan pe gaz condensat 18–24 kW</strong> sau <strong>pompă de căldură 12–14 kW</strong> — ambele opțiuni excelente pentru suprafața ta.`;
        if (kwHeat <= 30) return `<strong>Cazan pe gaz condensat 24–35 kW</strong> sau <strong>pompă de căldură 18–24 kW</strong> — recomandat pompa pentru economii pe termen lung.`;
        return `<strong>Cazan pe gaz 35+ kW</strong>, <strong>cazan pe lemn-cărbune</strong> sau <strong>pompă de căldură industrială</strong> — solicită consultație tehnică gratuită.`;
    }

    if (!needHeat && needCool) {
        if (pref === 'ac') {
            if (kwCool <= 7)  return `<strong>Split AC inverter 7–9 kW</strong> (1–2 unități interioare) — răcire rapidă, consum redus, control WiFi. SEER 5.0+.`;
            if (kwCool <= 14) return `<strong>Multi-split 3–4 unități, 12–14 kW total</strong> — fiecare cameră principală cu unitate proprie, control independent.`;
            return `<strong>Sistem VRF/VRV sau multi-split central</strong> — pentru suprafețe mari, control pe zone, eficiență maximă.`;
        }
        if (kwCool <= 7)  return `<strong>AC inverter split 7–9 kW</strong> sau <strong>pompă de căldură aer-aer 8–10 kW</strong> — pompă recomandată dacă vrei și puțin ajutor la încălzire.`;
        if (kwCool <= 14) return `<strong>Multi-split 12–16 kW</strong> sau <strong>pompă de căldură aer-apă</strong> — soluție completă pentru vară și economii semnificative.`;
        return `<strong>Sistem VRF 15–30 kW</strong> sau <strong>pompă de căldură centrală</strong> — soluție industrială pentru suprafețe mari.`;
    }

    return 'Solicită o consultație gratuită — echipa noastră îți recomandă soluția optimă pentru locuința ta.';
}

/* ===== NUMBER ANIMATION ===== */
function animNum(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    let v = 0;
    const steps = 40;
    const inc = target / steps;
    const timer = setInterval(() => {
        v = Math.min(v + inc, target);
        el.textContent = v >= target ? target : v.toFixed(1);
        if (v >= target) clearInterval(timer);
    }, 18);
}

/* ===== FORM SUBMIT ===== */
async function submitForm(e) {
    e.preventDefault();
    const name  = document.getElementById('fName').value.trim();
    const phone = document.getElementById('fPhone').value.trim();
    if (!name || !phone) {
        alert('Te rugăm completează cel puțin numele și numărul de telefon.');
        return;
    }

    const { serviciu, tip, etaj, etaje, area, izolatie, expunere, zona, kwHeat, kwCool } = state;
    const payload = {
        name,
        phone,
        email:    document.getElementById('fEmail').value.trim(),
        city:     document.getElementById('fCity').value.trim(),
        message:  document.getElementById('fMsg').value.trim(),
        calc: {
            serviciu, tip, area: area + ' m²',
            izolatie, expunere, zona,
            kwHeat: kwHeat ? kwHeat + ' kW' : '-',
            kwCool: kwCool ? kwCool + ' kW' : '-',
        },
        sentAt: new Date().toLocaleString('ro-MD'),
    };

    /* === TELEGRAM BOT (activează când ești gata) ===
    const BOT_TOKEN = 'YOUR_BOT_TOKEN';
    const CHAT_ID   = 'YOUR_CHAT_ID_OR_GROUP_ID';

    const serviciiLabel = { incalzire: '🔥 Doar Încălzire', racire: '❄️ Doar Răcire', ambele: '🔥❄️ Încălzire + Răcire' };
    const text = `
🔔 *Cerere nouă — TermoDepozit*

👤 *Nume:* ${payload.name}
📞 *Telefon:* ${payload.phone}
📧 *Email:* ${payload.email || '—'}
📍 *Localitate:* ${payload.city || '—'}

📊 *Calculator:*
• Serviciu: ${serviciiLabel[serviciu]}
• Tip: ${tip === 'apartament' ? 'Apartament' : 'Casă'}
• Suprafață: ${area} m²
• Izolație: ${izolatie}
• Expunere solară: ${expunere}
• Zonă: ${zona}
${kwHeat ? '• ⚡ Încălzire: *' + kwHeat + ' kW*' : ''}
${kwCool ? '• ❄️ Răcire: *' + kwCool + ' kW*' : ''}

💬 *Mesaj:* ${payload.message || '—'}
🕐 ${payload.sentAt}
    `.trim();

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'Markdown' }),
    });
    */

    console.log('TermoDepozit — cerere nouă:', payload);

    document.getElementById('offerForm').style.display   = 'none';
    document.getElementById('formSuccess').style.display = 'block';
    const costEl = document.getElementById('costEstimates');
    if (costEl) costEl.style.display = 'none';
}

/* ===== RESET ===== */
function resetCalc() {
    Object.assign(state, {
        serviciu: null, tip: null, etaj: 'mijloc', etaje: '1',
        area: null, izolatie: null, expunere: null, zona: null,
        kwHeat: null, kwCool: null,
    });

    document.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));

    /* restore tag defaults */
    [['sqApart','etaj','mijloc'],['sqHouse','etaje','1']].forEach(([id, f, v]) => {
        const row = document.getElementById(id);
        if (!row) return;
        const def = row.querySelector(`.tag-btn[data-value="${v}"]`);
        if (def) def.classList.add('active');
    });

    const areaInp = document.getElementById('areaInp');
    if (areaInp) areaInp.value = '';

    for (let i = 1; i <= 6; i++) {
        const btn = document.getElementById('next' + i);
        if (btn) btn.disabled = true;
    }

    document.getElementById('offerForm').style.display   = 'block';
    document.getElementById('formSuccess').style.display = 'none';
    ['fName','fPhone','fCity','fEmail','fMsg'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const costEl = document.getElementById('costEstimates');
    if (costEl) costEl.remove();

    showStep('step1');
}

/* ===== SCROLL ANIMATIONS ===== */
const observer = new IntersectionObserver(entries => {
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
        observer.observe(el);
    });
});
