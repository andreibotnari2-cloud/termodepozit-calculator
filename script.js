/* ===== STATE ===== */
const state = {
    tip:        null,
    etaj:       'mijloc',
    etaje:      '1',
    area:       null,
    izolatie:   null,
    zona:       null,
    category:   null,
    kw:         null,
};

/* ===== NAVIGATION: mobile hamburger ===== */
function toggleMenu() {
    const nav = document.getElementById('nav');
    const btn = document.getElementById('hamburger');
    nav.classList.toggle('open');
    btn.classList.toggle('open');
}

/* Close menu when a nav link is clicked */
document.querySelectorAll('.nav a').forEach(link => {
    link.addEventListener('click', () => {
        document.getElementById('nav').classList.remove('open');
        document.getElementById('hamburger').classList.remove('open');
    });
});

/* Sticky header shadow */
window.addEventListener('scroll', () => {
    const h = document.getElementById('header');
    h.style.boxShadow = window.scrollY > 10 ? '0 2px 20px rgba(0,0,0,.1)' : 'none';
});

/* ===== CALCULATOR STEP MANAGEMENT ===== */
const STEPS = ['step1','step2','step3','step4','stepResult'];
const PROGRESS = { step1: 25, step2: 50, step3: 75, step4: 100, stepResult: 100 };
const PS_MAP   = { step1: 1, step2: 2, step3: 3, step4: 4 };

function showStep(id) {
    STEPS.forEach(s => {
        const el = document.getElementById(s);
        if (el) el.classList.remove('active');
    });
    const target = document.getElementById(id);
    if (target) target.classList.add('active');

    /* progress bar */
    const fill = document.getElementById('cpFill');
    if (fill) fill.style.width = (PROGRESS[id] || 25) + '%';

    /* progress dots */
    for (let i = 1; i <= 4; i++) {
        const dot = document.getElementById('cps' + i);
        if (!dot) continue;
        dot.classList.remove('active', 'done');
        const stepNum = PS_MAP[id];
        if (i < stepNum) dot.classList.add('done');
        if (i === stepNum) dot.classList.add('active');
    }

    /* scroll calculator into view */
    const section = document.getElementById('calculator');
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function goStep(from, to) {
    const toId = to === 'r' ? 'stepResult' : 'step' + to;
    showStep(toId);
}

/* ===== CATEGORY CARDS → jump to calculator ===== */
function goToCalcWithCategory(cat) {
    state.category = cat;
    document.getElementById('calculator').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ===== CHOICE BUTTONS ===== */
function pick(btn) {
    const field = btn.dataset.field;
    const value = btn.dataset.value;
    state[field] = value;

    /* highlight within same group */
    const siblings = btn.closest('.choice-grid').querySelectorAll('.choice-btn[data-field="' + field + '"]');
    siblings.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');

    /* sub-questions for step 1 */
    if (field === 'tip') {
        const sqA = document.getElementById('sqApart');
        const sqH = document.getElementById('sqHouse');
        if (sqA) sqA.style.display = value === 'apartament' ? 'block' : 'none';
        if (sqH) sqH.style.display = value === 'casa'       ? 'block' : 'none';
    }

    /* unlock next button */
    const nextMap = { tip: 'next1', izolatie: 'next3', zona: 'next4' };
    if (nextMap[field]) {
        const btn2 = document.getElementById(nextMap[field]);
        if (btn2) btn2.disabled = false;
    }
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
    const btn = document.getElementById('next2');
    if (btn) btn.disabled = !(val > 0);
    if (val > 0) state.area = val;
}

function setArea(v) {
    const inp = document.getElementById('areaInp');
    if (inp) { inp.value = v; onAreaInput(); }
}

/* ===== CALCULATE ===== */
function calculate() {
    const { tip, etaj, etaje, area, izolatie, zona } = state;

    /* Base W/m² by type + insulation */
    const base = {
        apartament: { slaba: 100, medie: 80, buna: 60 },
        casa:        { slaba: 140, medie: 110, buna: 80 },
    };
    let wm2 = base[tip][izolatie];

    /* Climate zone multiplier */
    const climate = { nord: 1.10, centru: 1.00, sud: 0.90 };
    wm2 *= climate[zona];

    /* Floor factors */
    if (tip === 'apartament' && etaj === 'extrem') wm2 *= 1.15;
    if (tip === 'casa') {
        const floorMul = { '1': 1.15, '2': 1.0, '3': 0.95 };
        wm2 *= (floorMul[etaje] || 1.0);
    }

    /* Safety reserve 15% */
    wm2 *= 1.15;

    /* Raw kW */
    let kw = (area * wm2) / 1000;

    /* Round up to nearest 0.5 */
    kw = Math.ceil(kw * 2) / 2;
    state.kw = kw;

    renderResult(kw);
    showStep('stepResult');
}

/* ===== RENDER RESULT ===== */
function renderResult(kw) {
    const { tip, etaj, etaje, area, izolatie, zona, category } = state;

    /* animate counter */
    animateNumber('rcNum', kw);

    /* description */
    document.getElementById('rcDesc').textContent = 'putere termică necesară pentru ' + area + ' m²';

    /* detail tags */
    const tipLabel = tip === 'apartament' ? 'Apartament' : 'Casă';
    const izoLabel = { slaba: 'Izolație slabă', medie: 'Izolație standard', buna: 'Izolație bună' }[izolatie];
    const zonaLabel = { nord: 'Nord MD', centru: 'Centru MD', sud: 'Sud MD' }[zona];
    document.getElementById('rcDetails').innerHTML =
        `<span class="rc-detail-tag">${tipLabel}</span>
         <span class="rc-detail-tag">${area} m²</span>
         <span class="rc-detail-tag">${izoLabel}</span>
         <span class="rc-detail-tag">${zonaLabel}</span>`;

    /* recommendation */
    const rec = getRecommendation(kw, category);
    document.getElementById('rcRec').innerHTML =
        `<div class="rc-rec-title">Sistem recomandat</div>
         <div class="rc-rec-text">${rec}</div>`;

    /* pre-fill message in form */
    const tipStr    = tip === 'apartament'
        ? `Apartament${etaj === 'extrem' ? ' (etaj extrem)' : ''}`
        : `Casă (${etaje} ${etaje === '1' ? 'etaj' : 'etaje'})`;
    const summary   = `${tipStr}, ${area} m², ${izoLabel}, ${zonaLabel} → ${kw} kW necesar.`;
    const msgField  = document.getElementById('fMsg');
    if (msgField && !msgField.value) msgField.value = summary;
}

function animateNumber(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    let start = 0;
    const duration = 800;
    const step = 16;
    const increment = target / (duration / step);
    const timer = setInterval(() => {
        start = Math.min(start + increment, target);
        el.textContent = start >= target ? target : start.toFixed(1);
        if (start >= target) clearInterval(timer);
    }, step);
}

/* ===== RECOMMENDATION LOGIC ===== */
function getRecommendation(kw, preferred) {
    const recommendations = {
        gaz: {
            small:  'Cazan pe gaz condensat 18–24 kW — soluție ideală pentru apartamente și case mici. Eficiență > 95%, facturi reduse.',
            medium: 'Cazan pe gaz condensat 24–35 kW — performanță excelentă pentru case de dimensiuni medii.',
            large:  'Cazan pe gaz industrial 35–70 kW — putere mare, control precis al temperaturii.',
        },
        lemn: {
            small:  'Cazan pe lemn cu gazeificare 20–25 kW — autonomie ridicată, consum optim de combustibil.',
            medium: 'Cazan pe lemn-cărbune 25–40 kW — flexibil, acceptă combustibili multipli.',
            large:  'Cazan pe lemn-cărbune 40–100+ kW — pentru suprafețe mari sau obiective industriale.',
        },
        pompa: {
            small:  'Pompă de căldură aer-apă 8–12 kW — cea mai eficientă soluție. COP 3–5, economii 60-70% față de gaz. Include răcire vară.',
            medium: 'Pompă de căldură aer-apă 14–20 kW — sistem complet de încălzire + răcire, consum redus de energie.',
            large:  'Pompă de căldură aer-apă 20–35 kW sau sol-apă — pentru suprafețe mari, eficiență maximă garantată.',
        },
        podea: {
            small:  'Sistem podea caldă electrică cu termostat smart — confort uniform, 60–100 W/m². Compatibil cu orice tip de pardoseală.',
            medium: 'Sistem podea caldă hidraulic conectat la cazan sau pompă — distribuție uniformă a căldurii.',
            large:  'Sistem podea caldă hidraulic industrial — distribuție zonală, control independent pe zone.',
        },
        cheie: {
            small:  'Pachet complet la cheie: cazan/pompă caldă + automatizare + instalaţie sanitară. Proiect, montare, PIF garantate.',
            medium: 'Sistem complet la cheie: proiectare, echipament, montare, punere în funcțiune + 2 ani service inclus.',
            large:  'Sistem termic industrial la cheie — proiect tehnic, echipament de calitate, montaj certificat.',
        },
    };

    const tier = kw <= 14 ? 'small' : kw <= 30 ? 'medium' : 'large';

    if (preferred && recommendations[preferred]) {
        return recommendations[preferred][tier];
    }

    /* auto-suggest by kW */
    if (kw <= 14) return 'Pompă de căldură aer-apă 8–14 kW sau cazan pe gaz condensat 18–24 kW. Ambele opțiuni asigură confort ridicat și cost redus.';
    if (kw <= 25) return 'Cazan pe gaz condensat 24–32 kW sau pompă de căldură aer-apă 14–20 kW. Recomandat: pompă de căldură pentru economii pe termen lung.';
    if (kw <= 40) return 'Cazan pe gaz 32–45 kW, cazan pe lemn-cărbune 35–45 kW sau pompă de căldură 20–30 kW. Alegeți în funcție de disponibilitatea gazului.';
    return 'Cazan pe lemn-cărbune 40–100 kW sau sistem industrial la cheie. Vă recomandăm o consultație tehnică gratuită.';
}

/* ===== FORM SUBMIT ===== */
async function submitForm(e) {
    e.preventDefault();
    const name  = document.getElementById('fName').value.trim();
    const phone = document.getElementById('fPhone').value.trim();
    if (!name || !phone) {
        alert('Te rugăm completează numele și numărul de telefon.');
        return;
    }

    const { tip, etaj, etaje, area, izolatie, zona, kw } = state;
    const city  = document.getElementById('fCity').value.trim();
    const email = document.getElementById('fEmail').value.trim();
    const msg   = document.getElementById('fMsg').value.trim();

    const tipStr = tip === 'apartament'
        ? `Apartament${etaj === 'extrem' ? ' (etaj extrem)' : ' (etaj intermediar)'}`
        : `Casă (${etaje} ${etaje === '1' ? 'etaj' : 'etaje'})`;

    const izoLabel  = { slaba: 'Izolație slabă', medie: 'Standard', buna: 'Izolație bună' }[izolatie] || '-';
    const zonaLabel = { nord: 'Nord', centru: 'Centru', sud: 'Sud' }[zona] || '-';

    const payload = {
        name, phone, email, city,
        calculatorData: { tip: tipStr, area: area + ' m²', izolatie: izoLabel, zona: zonaLabel, kw: kw + ' kW' },
        message: msg,
        sentAt: new Date().toLocaleString('ro-MD'),
    };

    /* === TELEGRAM BOT INTEGRATION ===
       Uncomment and fill in your bot token + chat ID when ready:

    const TELEGRAM_BOT_TOKEN = 'YOUR_BOT_TOKEN';
    const TELEGRAM_CHAT_ID   = 'YOUR_CHAT_ID';
    const text = `
🔥 *Cerere nouă TermoDepozit*
👤 Nume: ${name}
📞 Telefon: ${phone}
📧 Email: ${email || '-'}
📍 Localitate: ${city || '-'}

🏠 Tip: ${tipStr}
📐 Suprafață: ${area} m²
🧱 Izolație: ${izoLabel}
🌍 Zonă: ${zonaLabel}
⚡ kW calculat: *${kw} kW*

💬 Mesaj: ${msg || '-'}
🕐 Trimis: ${payload.sentAt}
    `.trim();

    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'Markdown' }),
    });
    */

    console.log('Form submission:', payload);

    /* Show success */
    document.getElementById('offerForm').style.display   = 'none';
    document.getElementById('formSuccess').style.display = 'block';
}

/* ===== RESET CALCULATOR ===== */
function resetCalc() {
    Object.assign(state, { tip: null, etaj: 'mijloc', etaje: '1', area: null, izolatie: null, zona: null, kw: null });

    document.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));

    const tagDefaults = [
        { id: 'sqApart', field: 'etaj',  val: 'mijloc' },
        { id: 'sqHouse', field: 'etaje', val: '1' },
    ];
    tagDefaults.forEach(({ id, field, val }) => {
        const row = document.getElementById(id);
        if (row) {
            const def = row.querySelector(`.tag-btn[data-value="${val}"]`);
            if (def) def.classList.add('active');
        }
    });

    const areaInp = document.getElementById('areaInp');
    if (areaInp) areaInp.value = '';

    ['next1','next2','next3','next4'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.disabled = true;
    });

    document.getElementById('offerForm').style.display   = 'block';
    document.getElementById('formSuccess').style.display = 'none';
    document.getElementById('fName').value  = '';
    document.getElementById('fPhone').value = '';
    document.getElementById('fCity').value  = '';
    document.getElementById('fEmail').value = '';
    document.getElementById('fMsg').value   = '';

    showStep('step1');
}

/* ===== INTERSECTION OBSERVER — animate on scroll ===== */
const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
        if (e.isIntersecting) {
            e.target.style.opacity  = '1';
            e.target.style.transform = 'translateY(0)';
        }
    });
}, { threshold: 0.12 });

document.addEventListener('DOMContentLoaded', () => {
    const animated = document.querySelectorAll('.cat-card, .adv-card, .loc-card');
    animated.forEach((el, i) => {
        el.style.opacity   = '0';
        el.style.transform = 'translateY(24px)';
        el.style.transition = `opacity .5s ease ${i * 0.07}s, transform .5s ease ${i * 0.07}s`;
        observer.observe(el);
    });
});
