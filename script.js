(() => {
const KEY = 'controlPollo_jornada_v1';
const $ = id => document.getElementById(id);
const money = n => '$' + (Number(n) || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const num = id => Number($(id).value) || 0;
const cents = n => Math.round((Number(n) || 0) * 100);
const fromCents = n => n / 100;
let state = null;

function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

$('dayDate').value = today();

function save() {
    try {
        localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
        alert('No se pudo guardar en este navegador.');
    }
}

function load() {
    try {
        const raw = localStorage.getItem(KEY);
        if (raw) state = JSON.parse(raw);
    } catch (e) {
        state = null;
    }
}

function active() {
    return state && !state.closed;
}

function totals() {
    const sales = state?.sales || [];
    return {
        weight: sales.reduce((s, x) => s + x.weight, 0),
        chargedC: sales.reduce((s, x) => s + x.chargedC, 0),
        changeC: sales.reduce((s, x) => s + x.changeC, 0),
        tenderC: sales.reduce((s, x) => s + x.tenderC, 0)
    };
}

function inventory() {
    let old = state?.oldStock || 0, fresh = state?.newStock || 0;
    for (const sale of (state?.sales || [])) {
        let w = sale.weight;
        const takeOld = Math.min(old, w);
        old = Math.max(0, old - takeOld);
        w -= takeOld;
        fresh = Math.max(0, fresh - w);
    }
    return { old, fresh };
}

function show(id, yes) {
    $(id).classList.toggle('hidden', !yes);
}

function render() {
    const has = !!state;
    const open = active();
    show('openingCard', !has);
    show('saleCard', open);
    show('summaryCard', has);
    show('historyCard', has);
    show('closingCard', open);
    show('closedCard', has && !open);
    if (!has) return;
    
    $('status').textContent = open ? 'Jornada en curso' : 'Jornada cerrada';
    $('status').classList.toggle('closed', !open);
    
    const t = totals(), inv = inventory(), expectedC = cents(state.openingCash) + t.chargedC;
    $('totalSales').textContent = money(fromCents(t.chargedC));$('totalWeight').textContent = t.weight.toFixed(2) + ' lb';
    $('oldRemaining').textContent = inv.old.toFixed(2) + ' lb';$('newRemaining').textContent = inv.fresh.toFixed(2) + ' lb';
    $('startCash').textContent = money(state.openingCash);$('totalChange').textContent = money(fromCents(t.changeC));
    $('expectedCash').textContent = money(fromCents(expectedC));$('saleCount').textContent = state.sales.length;
    
    $('salesRows').innerHTML = '';
    for (const s of state.sales) {
        const tr = document.createElement('tr');
        const vals = [`#${s.id} · ${s.time}`, s.weight.toFixed(2) + ' lb', money(fromCents(s.scaleC)), money(fromCents(s.chargedC)), money(fromCents(s.tenderC)), money(fromCents(s.changeC))];
        vals.forEach((v, i) => {
            const td = document.createElement('td');
            td.textContent = v;
            if (i > 0) td.className = 'num';
            tr.appendChild(td);
        });
        const td = document.createElement('td');
        td.className = 'no-print';
        const b = document.createElement('button');
        b.className = 'btn danger';
        b.style.padding = '5px 8px';
        b.textContent = 'Eliminar';
        b.onclick = () => deleteSale(s.id);
        td.appendChild(b);
        tr.appendChild(td);
        $('salesRows').appendChild(tr);
    }
    $('emptySales').classList.toggle('hidden', state.sales.length > 0);$('countedCash').value = state.countedC === null ? '' : (state.countedC / 100).toFixed(2);
    $('closingNote').value = state.closingNote || '';
    updateDifference();
}

function updateDifference() {
    if (!state) return;
    const counted = $('countedCash').value;
    const el = $('cashDifference');
    if (counted === '') {
        el.textContent = 'Diferencia de caja: pendiente de contar.';
        return;
    }
    const expected = cents(state.openingCash) + totals().chargedC;
    const diff = cents(Number(counted)) - expected;
    el.innerHTML = 'Efectivo esperado: <strong>' + money(fromCents(expected)) + '</strong> · Diferencia: <strong class="' + (diff === 0 ? '' : 'warn') + '">' + (diff > 0 ? '+' : '') + money(fromCents(diff)) + '</strong>' + (diff === 0 ? ' · La caja cuadra.' : diff < 0 ? ' · Falta efectivo.' : ' · Sobra efectivo.');
}

function roundUp05(valueC) {
    return Math.ceil(valueC / 5) * 5;
}

function truncate2(val) {
    return Math.floor(val * 100) / 100;
}

$('startBtn').onclick = () => {
    if (state && !state.closed) {
        alert('Ya hay una jornada en curso.');
        return;
    }
    let oldVal = num('oldStock');
    let freshVal = num('newStock');
    const cash = num('openingCash');
    const applyOldShrink = $('applyOldShrink').checked;
    const applyFreshShrink = $('applyFreshShrink').checked;

    if (oldVal < 0 || freshVal < 0 || cash < 0) {
        alert('Las cantidades no pueden ser negativas.');
        return;
    }

    if (applyOldShrink) {
        oldVal = truncate2(oldVal * 0.97);
    }
    if (applyFreshShrink) {
        freshVal = truncate2(freshVal * 0.97);
    }

    let notes = $('notesOpen').value.trim();
    let shrinkNotes = [];
    if (applyOldShrink) shrinkNotes.push('3% en anterior');
    if (applyFreshShrink) shrinkNotes.push('3% en camión');
    if (shrinkNotes.length > 0) {
        notes += (notes ? ' - ' : '') + '(' + shrinkNotes.join(', ') + ')';
    }

    state = {
        date: $('dayDate').value || today(),
        price: num('priceLb'),
        oldStock: Number(oldVal.toFixed(2)),
        newStock: Number(freshVal.toFixed(2)),
        openingCash: cash,
        openingNote: notes,
        sales: [],
        closed: false,
        countedC: null,
        closingNote: ''
    };
    save();
    render();
};

$('scaleAmount').addEventListener('input', () => {
    if ($('scaleAmount').value !== '' && $('chargedAmount').dataset.touched !== '1') {$('chargedAmount').value = (roundUp05(cents(num('scaleAmount'))) / 100).toFixed(2);
    }
    updatePreview();
});

$('chargedAmount').addEventListener('input', () => {$('chargedAmount').dataset.touched = '1';
    updatePreview();
});

$('roundBtn').onclick = () => {
    if ($('scaleAmount').value === '') {
        alert('Primero introduce el importe de la báscula.');
        return;
    }
    $('chargedAmount').value = (roundUp05(cents(num('scaleAmount'))) / 100).toFixed(2);$('chargedAmount').dataset.touched = '1';
    updatePreview();
};

$('cashGiven').addEventListener('input', updatePreview);

function updatePreview() {
    const charged = cents(num('chargedAmount')), given = cents(num('cashGiven')), diff = given - charged;
    const el = $('changePreview');
    if ($('cashGiven').value === '' || $('chargedAmount').value === '') {
        el.textContent = 'Introduce el importe a cobrar y el dinero entregado para calcular el vuelto.';
        return;
    }
    el.innerHTML = diff < 0 ? 'Falta recibir: <strong>' + money(fromCents(-diff)) + '</strong>' : 'Vuelto: <strong>' + money(fromCents(diff)) + '</strong>';
    if (diff < 0) el.classList.add('warn');
    else el.classList.remove('warn');
}

$('addSaleBtn').onclick = () => {
    if (!active()) return;
    const weight = Number($('saleWeight').value), scaleC = cents(num('scaleAmount')), chargedC = cents(num('chargedAmount')), tenderC = cents(num('cashGiven'));
    if (!(weight > 0)) {
        alert('Introduce un peso válido mayor que cero.');
        return;
    }
    if ($('scaleAmount').value === '' || $('chargedAmount').value === '' || $('cashGiven').value === '') {
        alert('Completa el importe de la báscula, el importe cobrado y el dinero recibido.');
        return;
    }
    if (chargedC < 0 || scaleC < 0) {
        alert('Los importes no pueden ser negativos.');
        return;
    }
    if (tenderC < chargedC) {
        alert('El dinero entregado es menor que el importe a cobrar.');
        return;
    }
    const inv = inventory(), available = inv.old + inv.fresh;
    if (weight > available + 0.000001) {
        alert(`No hay suficientes libras registradas. Inventario restante: ${available.toFixed(2)} lb.`);
        return;
    }
    state.sales.push({
        id: state.sales.length ? Math.max(...state.sales.map(s => s.id)) + 1 : 1,
        time: new Date().toLocaleTimeString('es-SV', {hour: '2-digit', minute: '2-digit'}),
        weight,
        scaleC,
        chargedC,
        tenderC,
        changeC: tenderC - chargedC,
        note: $('saleNote').value.trim()
    });
    save();
    $('saleWeight').value = '';$('scaleAmount').value = '';
    $('chargedAmount').value = '';$('chargedAmount').dataset.touched = '';
    $('cashGiven').value = '';$('saleNote').value = '';
    updatePreview();
    render();
    $('saleWeight').focus();
};

function deleteSale(id) {
    if (!active()) return;
    if (!confirm('¿Eliminar esta venta? El inventario y los totales se recalcularán.')) return;
    state.sales = state.sales.filter(s => s.id !== id);
    save();
    render();
}

$('countedCash').addEventListener('input', () => {
    state.countedC = $('countedCash').value === '' ? null : cents(num('countedCash'));
    save();
    updateDifference();
});

$('closingNote').addEventListener('input', () => {
    state.closingNote = $('closingNote').value;
    save();
});

$('checkCashBtn').onclick = updateDifference;

$('printBtn').onclick = () => {
    state.countedC = $('countedCash').value === '' ? null : cents(num('countedCash'));
    state.closingNote = $('closingNote').value;
    save();
    window.print();
};

$('closeBtn').onclick = () => {
    if (!active()) return;
    if (!confirm('¿Ya imprimiste o guardaste el reporte y entregaste el dinero? La jornada quedará cerrada.')) return;
    state.countedC = $('countedCash').value === '' ? null : cents(num('countedCash'));
    state.closingNote = $('closingNote').value;
    state.closed = true;
    state.closedAt = new Date().toLocaleString('es-SV');
    save();
    render();
};

$('printClosedBtn').onclick = () => window.print();

$('newDayBtn').onclick = () => {
    if (!confirm('¿Confirmas que ya guardaste el reporte anterior? Se borrará esta jornada de este navegador para empezar una nueva.')) return;
    state = null;
    try { localStorage.removeItem(KEY); } catch (e) {}
    ['oldStock', 'newStock', 'notesOpen', 'priceLb'].forEach(id => $(id).value = '');
    $('openingCash').value = '0';$('applyOldShrink').checked = false;
    $('applyFreshShrink').checked = false;
    $('dayDate').value = today();
    render();
};

window.addEventListener('beforeprint', () => {
    if (!state) return;
    let report = document.getElementById('printInfo');
    if (!report) {
        report = document.createElement('div');
        report.id = 'printInfo';
        report.className = 'card';
        $('summaryCard').prepend(report);
    }
    const t = totals(), inv = inventory(), expected = cents(state.openingCash) + t.chargedC;
    report.innerHTML = `<h2>Reporte diario · ${state.date}</h2><p>Inicio: ${state.oldStock.toFixed(2)} lb anteriores + ${state.newStock.toFixed(2)} lb nuevas. Dinero inicial: ${money(state.openingCash)}.</p><p>Ventas cobradas: ${money(fromCents(t.chargedC))}. Libras vendidas: ${t.weight.toFixed(2)} lb. Vuelto entregado: ${money(fromCents(t.changeC))}.</p><p>Restante: ${inv.old.toFixed(2)} lb del lote anterior y ${inv.fresh.toFixed(2)} lb del lote nuevo. Efectivo esperado: ${money(fromCents(expected))}. Efectivo contado: ${state.countedC === null ? 'No registrado' : money(fromCents(state.countedC))}.</p><p>Observaciones: ${escapeHtml(state.openingNote || 'Ninguna')} / ${escapeHtml(state.closingNote || 'Ninguna')}.</p>`;
});

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
}

load();
render();
})();