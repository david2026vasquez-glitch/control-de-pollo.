(() => {
  const KEY = 'controlPollo_jornada_v8';
  const $ = id => document.getElementById(id);
  const money = n => '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const num = id => Number($(id)?.value) || 0;
  const cents = n => Math.round((Number(n) || 0) * 100);
  const fromCents = n => n / 100;
  const truncate2 = v => Math.floor(v * 100) / 100;

  const PACKAGED_CATALOG = [
    { id: 1, name: 'Fajitas de pollo, libra', price: 1.40 },
    { id: 2, name: 'Pollo entero, libra', price: 1.65 },
    { id: 3, name: 'Alas frescas, libra', price: 1.55 },
    { id: 4, name: 'Patas y buche, libra', price: 0.60 },
    { id: 5, name: 'Hígado y molleja, libra', price: 0.90 },
    { id: 6, name: 'Pechuga deshuesada, libra', price: 3.45 },
    { id: 7, name: 'Carne molida, libra', price: 1.95 },
    { id: 8, name: 'Jamón familiar, libra', price: 1.20 },
    { id: 9, name: 'Salchicha de pollo, libra', price: 1.50 },
    { id: 10, name: 'Mortadela de pollo, libra', price: 1.40 },
    { id: 11, name: 'Chorizo parrillero, libra', price: 1.40 },
    { id: 12, name: 'Chunks', price: 5.20 },
    { id: 13, name: 'Alitas empanizadas, 2.5 lb', price: 6.95 },
    { id: 14, name: 'Alitas empanizadas, 1 lb', price: 3.20 },
    { id: 15, name: 'Alitas promoción, libra', price: 5.70 },
    { id: 16, name: 'Papas para freír, libra', price: 1.70 },
    { id: 17, name: 'Papas para freír, 5 lb', price: 7.70 },
    { id: 18, name: 'Pechuguitas, 360 g', price: 3.20 },
    { id: 19, name: 'Gallina, unidad', price: 9.20 }
  ];

  let state = null;
  let currentCart = [];

  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // ========== INICIO ==========
  if ($('dayDate')) $('dayDate').value = today();

  function renderOpeningPackages() {
    const tbody = $('openingPackRows');
    if (!tbody) return;
    tbody.innerHTML = '';
    PACKAGED_CATALOG.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(p.name)}</td>
        <td class="num">${money(p.price)}</td>
        <td><input type="number" min="0" step="1" inputmode="numeric" value="0" id="op_pack_${p.id}"></td>
      `;
      tbody.appendChild(tr);
    });
  }
  renderOpeningPackages();

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch(e) {}
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) state = JSON.parse(raw);
    } catch(e) { state = null; }
  }

  function active() { return state && !state.closed; }

  function getSoldQuantities() {
    const res = { pollo: { pechuga: 0, muslo: 0 }, pack: {} };
    PACKAGED_CATALOG.forEach(p => res.pack[p.id] = 0);
    if (!state) return res;

    (state.sales || []).forEach(s => {
      if (s.type === 'pollo') {
        if (s.subtype === 'pechuga') res.pollo.pechuga += s.weight;
        if (s.subtype === 'muslo') res.pollo.muslo += s.weight;
      } else if (s.type === 'empacado' && res.pack[s.productId] !== undefined) {
        res.pack[s.productId] += s.qty;
      }
    });
    return res;
  }

  // ========== NAVEGACIÓN ==========
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
      btn.classList.add('active');
      const tab = $(btn.dataset.tab);
      if (tab) tab.classList.remove('hidden');

      if (btn.dataset.tab === 'tabCierre') calculateClosingData();
      if (btn.dataset.tab === 'tabInventario') updateInventoryView();
      if (btn.dataset.tab === 'tabVenta') {
        setTimeout(() => {
          const category = document.getElementById('saleCategory')?.value;
          if (category === 'empacado') {
            populatePackSelect();
          }
        }, 150);
      }
    };
  });

  // ========== RENDER PRINCIPAL ==========
  function render() {
    const has = !!state;
    if ($('openingCard')) $('openingCard').classList.toggle('hidden', has);
    if ($('appNav')) $('appNav').classList.toggle('hidden', !has);

    if (!has) return;

    if (document.querySelectorAll('.tab-content:not(.hidden)').length === 0) {
      if ($('tabResumen')) $('tabResumen').classList.remove('hidden');
    }

    // Responsables
    const respSelect = $('saleResp');
    if (respSelect) {
      respSelect.innerHTML = `<option value="${escapeHtml(state.primaryResp)}">${escapeHtml(state.primaryResp)}</option>`;
      if (state.secondResp) {
        respSelect.innerHTML += `<option value="${escapeHtml(state.secondResp)}">${escapeHtml(state.secondResp)}</option>`;
      }
    }

    // Header
    if ($('headerInfo')) $('headerInfo').textContent = `${state.establishment} · ${state.date}`;

    // Totales
    const sold = getSoldQuantities();
    let totalSalesC = 0, totalChangeC = 0;
    (state.sales || []).forEach(s => {
      totalSalesC += s.chargedC;
      totalChangeC += s.changeC;
    });

    if ($('totalSales')) $('totalSales').textContent = money(fromCents(totalSalesC));
    if ($('totalPechugaSold')) $('totalPechugaSold').textContent = sold.pollo.pechuga.toFixed(2) + ' lb';
    if ($('totalMusloSold')) $('totalMusloSold').textContent = sold.pollo.muslo.toFixed(2) + ' lb';
    
    let totalPack = 0;
    Object.values(sold.pack).forEach(v => totalPack += v);
    if ($('totalPackSold')) $('totalPackSold').textContent = totalPack.toFixed(0);

    if ($('sumStartCash')) $('sumStartCash').textContent = money(state.openingCash);
    if ($('sumTotalChange')) $('sumTotalChange').textContent = money(fromCents(totalChangeC));
    if ($('sumExpectedCash')) $('sumExpectedCash').textContent = money(fromCents(cents(state.openingCash) + totalSalesC));
    if ($('sumSaleCount')) $('sumSaleCount').textContent = state.sales.length;

    // Historial
    const tbody = $('salesRows');
    if (tbody) {
      tbody.innerHTML = '';
      (state.sales || []).forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${s.time}<br><small style="color:var(--muted)">${escapeHtml(s.resp)}</small></td>
          <td>${escapeHtml(s.detail)}${s.changePending ? '<br><span style="color:var(--red);font-size:0.75rem;">Cambio pendiente</span>' : ''}</td>
          <td class="num">${s.qtyStr}</td>
          <td class="num">${money(fromCents(s.chargedC))}</td>
          <td><button class="btn danger" style="padding:2px 6px;font-size:0.7rem;" onclick="deleteSale(${s.id})">X</button></td>
        `;
        tbody.appendChild(tr);
      });
    }
    if ($('emptySales')) $('emptySales').classList.toggle('hidden', state.sales.length > 0);

    updateInventoryView();
    populatePackSelect();
  }

  // ========== INICIAR JORNADA ==========
  if ($('startBtn')) {
    $('startBtn').onclick = () => {
      const primary = $('primaryResp')?.value.trim();
      if (!primary) {
        alert('El responsable principal es obligatorio.');
        return;
      }

      const packData = {};
      PACKAGED_CATALOG.forEach(p => {
        packData[p.id] = {
          initial: num(`op_pack_${p.id}`),
          entries: 0,
          price: p.price
        };
      });

      state = {
        date: $('dayDate')?.value || today(),
        establishment: $('establishmentName')?.value.trim() || 'Agromercado',
        primaryResp: primary,
        secondResp: $('secondResp')?.value.trim() || '',
        openingCash: num('openingCash'),
        openingNote: $('notesOpen')?.value.trim() || '',
        startTime: new Date().toLocaleTimeString('es-SV', {hour:'2-digit', minute:'2-digit'}),
        pollo: {
          pechuga: { initial: num('initialPechuga'), entries: 0, price: num('pricePechuga') },
          muslo:   { initial: num('initialMuslo'),   entries: 0, price: num('priceMuslo') }
        },
        packaged: packData,
        sales: [],
        closed: false,
        countedC: null,
        closingNote: ''
      };
      save();
      render();
    };
  }

  // ========== INVENTARIO ==========
  function updateInventoryView() {
    if (!state) return;
    const sold = getSoldQuantities();

    if ($('invInitPechuga')) $('invInitPechuga').textContent = state.pollo.pechuga.initial.toFixed(2);
    if ($('addEntryPechuga')) $('addEntryPechuga').value = state.pollo.pechuga.entries.toFixed(2);
    if ($('invSoldPechuga')) $('invSoldPechuga').textContent = sold.pollo.pechuga.toFixed(2);
    const availP = state.pollo.pechuga.initial + state.pollo.pechuga.entries - sold.pollo.pechuga;
    if ($('invAvailPechuga')) $('invAvailPechuga').innerHTML = `<strong>${Math.max(0, availP).toFixed(2)}</strong>`;

    if ($('invInitMuslo')) $('invInitMuslo').textContent = state.pollo.muslo.initial.toFixed(2);
    if ($('addEntryMuslo')) $('addEntryMuslo').value = state.pollo.muslo.entries.toFixed(2);
    if ($('invSoldMuslo')) $('invSoldMuslo').textContent = sold.pollo.muslo.toFixed(2);
    const availM = state.pollo.muslo.initial + state.pollo.muslo.entries - sold.pollo.muslo;
    if ($('invAvailMuslo')) $('invAvailMuslo').innerHTML = `<strong>${Math.max(0, availM).toFixed(2)}</strong>`;

    const tbody = $('inventoryPackRows');
    if (tbody) {
      tbody.innerHTML = '';
      PACKAGED_CATALOG.forEach(p => {
        const item = state.packaged[p.id];
        const sCount = sold.pack[p.id] || 0;
        const avail = item.initial + item.entries - sCount;
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escapeHtml(p.name)}</td>
          <td class="num">${item.initial}</td>
          <td class="num"><input type="number" min="0" step="0.01" value="${item.entries}" id="entry_pack_${p.id}" class="small-input"></td>
          <td class="num">${sCount.toFixed(0)}</td>
          <td class="num"><strong>${Math.max(0, avail).toFixed(0)}</strong></td>
        `;
        tbody.appendChild(tr);
      });
    }
  }

  if ($('saveEntriesBtn')) {
    $('saveEntriesBtn').onclick = () => {
      if (!state) return;
      state.pollo.pechuga.entries = num('addEntryPechuga');
      state.pollo.muslo.entries   = num('addEntryMuslo');
      PACKAGED_CATALOG.forEach(p => {
        state.packaged[p.id].entries = num(`entry_pack_${p.id}`);
      });
      save();
      updateInventoryView();
      alert('Entradas del camión guardadas.');
    };
  }

  // ========== VENTAS - MENÚ DE PRODUCTOS (CORREGIDO) ==========
  function populatePackSelect() {
    const sel = document.getElementById('packSelect');
    if (!sel) {
      console.log('No se encontró packSelect');
      return;
    }

    sel.innerHTML = '';

    if (!state) {
      sel.innerHTML = '<option value="">Primero inicia la jornada</option>';
      return;
    }

    PACKAGED_CATALOG.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name + ' - $' + p.price.toFixed(2);
      sel.appendChild(opt);
    });

    // Actualizar precio del primero
    const first = PACKAGED_CATALOG[0];
    const priceInput = document.getElementById('packPriceOverride');
    if (priceInput) priceInput.value = first.price.toFixed(2);
    
    const qty = Number(document.getElementById('packQty')?.value) || 1;
    const subtotalInput = document.getElementById('packSubtotal');
    if (subtotalInput) subtotalInput.value = (qty * first.price).toFixed(2);
  }

  function updatePackagedPrice() {
    const sel = document.getElementById('packSelect');
    if (!sel || !state) return;

    const id = Number(sel.value);
    const prod = PACKAGED_CATALOG.find(p => p.id === id);
    if (prod) {
      const priceInput = document.getElementById('packPriceOverride');
      if (priceInput) {
        priceInput.value = (state.packaged[id]?.price || prod.price).toFixed(2);
      }
      calcPackagedSubtotal();
    }
  }

  function calcPackagedSubtotal() {
    const qty = num('packQty');
    const price = num('packPriceOverride');
    const subtotalInput = document.getElementById('packSubtotal');
    if (subtotalInput) {
      subtotalInput.value = (qty * price).toFixed(2);
    }
  }

  // Cambio de categoría - versión más directa y confiable
  const saleCategoryEl = document.getElementById('saleCategory');
  if (saleCategoryEl) {
    saleCategoryEl.addEventListener('change', function() {
      const valor = this.value;
      const polloBox = document.getElementById('polloSaleBox');
      const packBox = document.getElementById('packSaleBox');

      if (valor === 'pollo') {
        if (polloBox) polloBox.classList.remove('hidden');
        if (packBox) packBox.classList.add('hidden');
      } else {
        if (polloBox) polloBox.classList.add('hidden');
        if (packBox) packBox.classList.remove('hidden');
        // Forzar carga del menú
        populatePackSelect();
      }
    });
  }

  // Eventos de los campos de empacados
  const packSelectEl = document.getElementById('packSelect');
  if (packSelectEl) packSelectEl.addEventListener('change', updatePackagedPrice);
  
  const packQtyEl = document.getElementById('packQty');
  if (packQtyEl) packQtyEl.addEventListener('input', calcPackagedSubtotal);
  
  const packPriceEl = document.getElementById('packPriceOverride');
  if (packPriceEl) packPriceEl.addEventListener('input', calcPackagedSubtotal);

  // ========== AÑADIR POLLO ==========
  if ($('addPolloToCart')) {
    $('addPolloToCart').onclick = () => {
      if (!state) return;

      const type = $('polloType')?.value;
      const weight = num('polloWeight');
      const subtotal = num('polloSubtotal');

      if (weight <= 0) {
        alert('Escribe el peso que marca la báscula');
        return;
      }
      if (subtotal <= 0) {
        alert('Escribe el precio que marca la báscula');
        return;
      }

      const sold = getSoldQuantities();
      const available = state.pollo[type].initial + state.pollo[type].entries - sold.pollo[type];
      const alreadyInCart = currentCart
        .filter(i => i.type === 'pollo' && i.subtype === type)
        .reduce((sum, item) => sum + item.weight, 0);

      if (weight + alreadyInCart > available + 0.001) {
        alert(`No hay suficiente ${type}.\nDisponible: ${Math.max(0, available - alreadyInCart).toFixed(2)} lb`);
        return;
      }

      currentCart.push({
        type: 'pollo',
        subtype: type,
        name: type === 'pechuga' ? 'Pechuga' : 'Muslo',
        weight: weight,
        qtyStr: weight.toFixed(2) + ' lb',
        unitPrice: 0,
        subtotal: subtotal
      });

      renderCart();
      if ($('polloWeight')) $('polloWeight').value = '';
      if ($('polloSubtotal')) $('polloSubtotal').value = '';
    };
  }

  // ========== AÑADIR EMPACADO ==========
  if ($('addPackToCart')) {
    $('addPackToCart').onclick = () => {
      if (!state) return;
      
      const prodId = Number($('packSelect')?.value);
      const prod = PACKAGED_CATALOG.find(p => p.id === prodId);
      
      if (!prod) {
        alert('Selecciona un producto del menú');
        return;
      }

      const qty = num('packQty');
      const price = num('packPriceOverride');
      
      if (qty <= 0) { 
        alert('Cantidad inválida.'); 
        return; 
      }

      const sold = getSoldQuantities();
      const avail = state.packaged[prodId].initial + state.packaged[prodId].entries - (sold.pack[prodId] || 0);
      const inCart = currentCart.filter(i => i.type === 'empacado' && i.productId === prodId).reduce((s,x) => s + x.qty, 0);

      if (qty + inCart > avail + 0.0001) {
        alert(`No hay suficiente ${prod.name}.\nDisponible: ${Math.max(0, avail - inCart)}`);
        return;
      }

      currentCart.push({
        type: 'empacado',
        productId: prodId,
        name: prod.name,
        qty,
        qtyStr: qty + (qty === 1 ? ' und' : ' und'),
        unitPrice: price,
        subtotal: qty * price
      });
      
      renderCart();
      if ($('packQty')) $('packQty').value = '1';
      calcPackagedSubtotal();
    };
  }

  function renderCart() {
    const tbody = $('cartRows');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    let sum = 0;
    currentCart.forEach((item, idx) => {
      sum += item.subtotal;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(item.name)}</td>
        <td class="num">${item.qtyStr}</td>
        <td class="num"><strong>${money(item.subtotal)}</strong></td>
        <td><button class="btn danger" style="padding:2px 6px;font-size:0.7rem;" onclick="removeFromCart(${idx})">X</button></td>
      `;
      tbody.appendChild(tr);
    });
    
    if ($('emptyCart')) $('emptyCart').classList.toggle('hidden', currentCart.length > 0);
    if ($('cartTotalSum')) $('cartTotalSum').textContent = money(sum);
    updateChangePreview();
  }

  window.removeFromCart = idx => {
    currentCart.splice(idx, 1);
    renderCart();
  };

  if ($('cashGiven')) $('cashGiven').oninput = updateChangePreview;

  function updateChangePreview() {
    const sum = currentCart.reduce((s, x) => s + x.subtotal, 0);
    const given = num('cashGiven');
    const el = $('changePreview');
    if (!el) return;
    
    if (!currentCart.length || !$('cashGiven')?.value) {
      el.textContent = 'Añade productos e introduce el dinero';
      el.classList.remove('warn');
      return;
    }
    const diff = given - sum;
    el.innerHTML = diff < 0
      ? `Falta: <strong>${money(-diff)}</strong>`
      : `Vuelto: <strong>${money(diff)}</strong>`;
    el.classList.toggle('warn', diff < 0);
  }

  // Confirmar venta
  if ($('confirmSaleBtn')) {
    $('confirmSaleBtn').onclick = () => {
      if (!active()) return;
      if (!currentCart.length) { alert('El carrito está vacío.'); return; }

      const sum = currentCart.reduce((s, x) => s + x.subtotal, 0);
      const givenC = cents(num('cashGiven'));
      const sumC = cents(sum);
      if (givenC < sumC) { alert('El dinero entregado es menor al total.'); return; }

      const resp = $('saleResp')?.value || state.primaryResp;
      const note = $('saleNote')?.value.trim() || '';
      const changePending = $('changePendingCheck')?.checked || false;
      const changeC = givenC - sumC;

      currentCart.forEach(item => {
        state.sales.push({
          id: state.sales.length ? Math.max(...state.sales.map(s => s.id)) + 1 : 1,
          time: new Date().toLocaleTimeString('es-SV', {hour:'2-digit', minute:'2-digit'}),
          resp,
          type: item.type,
          subtype: item.subtype || null,
          productId: item.productId || null,
          weight: item.weight || 0,
          qty: item.qty || 0,
          qtyStr: item.qtyStr,
          unitPrice: item.unitPrice,
          chargedC: cents(item.subtotal),
          tenderC: givenC,
          changeC,
          changePending,
          detail: item.name + (item.weight ? ` (${item.weight.toFixed(2)} lb)` : ` (${item.qty})`),
          note
        });
      });

      save();
      currentCart = [];
      renderCart();
      if ($('cashGiven')) $('cashGiven').value = '';
      if ($('saleNote')) $('saleNote').value = '';
      if ($('changePendingCheck')) $('changePendingCheck').checked = false;
      alert('Venta registrada');
      render();
    };
  }

  window.deleteSale = id => {
    if (!active()) return;
    if (!confirm('¿Eliminar esta venta?')) return;
    state.sales = state.sales.filter(s => s.id !== id);
    save();
    render();
  };

  // ========== CIERRE ==========
  function calculateClosingData() {
    if (!state) return;
    const sold = getSoldQuantities();

    const pInit = state.pollo.pechuga.initial;
    const pEnt  = state.pollo.pechuga.entries;
    const pSold = sold.pollo.pechuga;
    const pRest = Math.max(0, pInit + pEnt - pSold);
    const applyP = $('applyShrinkPechuga')?.checked;
    const pMerma = applyP ? truncate2(pRest * 0.03) : 0;
    const pFinal = truncate2(pRest - pMerma);

    const mInit = state.pollo.muslo.initial;
    const mEnt  = state.pollo.muslo.entries;
    const mSold = sold.pollo.muslo;
    const mRest = Math.max(0, mInit + mEnt - mSold);
    const applyM = $('applyShrinkMuslo')?.checked;
    const mMerma = applyM ? truncate2(mRest * 0.03) : 0;
    const mFinal = truncate2(mRest - mMerma);

    if ($('closingPolloRows')) {
      $('closingPolloRows').innerHTML = `
        <tr>
          <td><strong>Pechuga</strong></td>
          <td class="num">${pInit.toFixed(2)}</td>
          <td class="num">${pEnt.toFixed(2)}</td>
          <td class="num">${pSold.toFixed(2)}</td>
          <td class="num">${pRest.toFixed(2)}</td>
          <td class="num">${applyP ? '-' + pMerma.toFixed(2) : '0.00'}</td>
          <td class="num"><strong>${pFinal.toFixed(2)}</strong></td>
          <td class="num">${money(pSold * state.pollo.pechuga.price)}</td>
        </tr>
        <tr>
          <td><strong>Muslo</strong></td>
          <td class="num">${mInit.toFixed(2)}</td>
          <td class="num">${mEnt.toFixed(2)}</td>
          <td class="num">${mSold.toFixed(2)}</td>
          <td class="num">${mRest.toFixed(2)}</td>
          <td class="num">${applyM ? '-' + mMerma.toFixed(2) : '0.00'}</td>
          <td class="num"><strong>${mFinal.toFixed(2)}</strong></td>
          <td class="num">${money(mSold * state.pollo.muslo.price)}</td>
        </tr>
      `;
    }

    let packHTML = '';
    PACKAGED_CATALOG.forEach(p => {
      const item = state.packaged[p.id];
      const s = sold.pack[p.id] || 0;
      const rest = Math.max(0, item.initial + item.entries - s);
      if (item.initial > 0 || item.entries > 0 || s > 0) {
        packHTML += `
          <tr>
            <td>${escapeHtml(p.name)}</td>
            <td class="num">${item.initial}</td>
            <td class="num">${item.entries}</td>
            <td class="num">${s}</td>
            <td class="num">${rest}</td>
            <td class="num">${money(s * item.price)}</td>
          </tr>
        `;
      }
    });
    if ($('closingPackRows')) {
      $('closingPackRows').innerHTML = packHTML || '<tr><td colspan="6" class="empty">Sin movimientos</td></tr>';
    }

    const hasPending = (state.sales || []).some(s => s.changePending);
    if ($('pendingChangeAlert')) $('pendingChangeAlert').classList.toggle('hidden', !hasPending);
    updateCashArqueo();
  }

  if ($('applyShrinkPechuga')) $('applyShrinkPechuga').onchange = calculateClosingData;
  if ($('applyShrinkMuslo')) $('applyShrinkMuslo').onchange = calculateClosingData;
  if ($('calcClosingBtn')) $('calcClosingBtn').onclick = calculateClosingData;

  function updateCashArqueo() {
    if (!state) return;
    let totalSalesC = 0;
    (state.sales || []).forEach(s => totalSalesC += s.chargedC);
    const expectedC = cents(state.openingCash) + totalSalesC;
    const counted = $('countedCash')?.value;
    const el = $('cashDifference');
    if (!el) return;
    
    if (!counted) {
      el.textContent = 'Esperado: ' + money(fromCents(expectedC)) + ' · Contado pendiente';
      return;
    }
    const diff = cents(Number(counted)) - expectedC;
    el.innerHTML = `Esperado: <strong>${money(fromCents(expectedC))}</strong> · Diferencia: <strong class="${diff===0?'':'warn'}">${diff>0?'+':''}${money(fromCents(diff))}</strong>${diff===0?' · Cuadrada':diff<0?' · Faltante':' · Sobra'}`;
  }
  if ($('countedCash')) $('countedCash').oninput = updateCashArqueo;

  if ($('closeDayBtn')) {
    $('closeDayBtn').onclick = () => {
      if (!active()) return;
      if (!confirm('¿Cerrar la jornada definitivamente?')) return;
      state.countedC = $('countedCash')?.value === '' ? null : cents(num('countedCash'));
      state.closingNote = $('closingNote')?.value || '';
      state.closed = true;
      state.closeTime = new Date().toLocaleTimeString('es-SV', {hour:'2-digit', minute:'2-digit'});
      save();
      alert('Jornada cerrada');
      render();
    };
  }

  // ========== PDF ==========
  if ($('downloadPdfBtn')) {
    $('downloadPdfBtn').onclick = () => {
      if (!window.jspdf) {
        alert('No se pudo cargar la librería PDF. Revisa tu conexión.');
        return;
      }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('p', 'mm', 'a4');
      const sold = getSoldQuantities();
      let totalSalesC = 0;
      (state.sales || []).forEach(s => totalSalesC += s.chargedC);
      const expectedC = cents(state.openingCash) + totalSalesC;

      const encargados = state.primaryResp + (state.secondResp ? ' y ' + state.secondResp : '');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(state.establishment, 105, 12, { align: 'center' });
      doc.setFontSize(11);
      doc.text('INFORME DIARIO DE VENTAS E INVENTARIO', 105, 18, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Fecha: ${state.date}  |  Estado: ${state.closed ? 'CERRADA' : 'EN CURSO'}`, 14, 25);
      doc.text(`Encargados del puesto: ${encargados}`, 14, 30);
      doc.text(`Fondo inicial: ${money(state.openingCash)}  |  Total ventas: ${money(fromCents(totalSalesC))}`, 14, 35);

      const applyP = $('applyShrinkPechuga')?.checked;
      const pRest = Math.max(0, state.pollo.pechuga.initial + state.pollo.pechuga.entries - sold.pollo.pechuga);
      const pMerma = applyP ? truncate2(pRest * 0.03) : 0;
      const pFinal = truncate2(pRest - pMerma);

      const applyM = $('applyShrinkMuslo')?.checked;
      const mRest = Math.max(0, state.pollo.muslo.initial + state.pollo.muslo.entries - sold.pollo.muslo);
      const mMerma = applyM ? truncate2(mRest * 0.03) : 0;
      const mFinal = truncate2(mRest - mMerma);

      doc.setFont('helvetica', 'bold');
      doc.text('1. Pollo (Inicial vs Camión)', 14, 42);

      doc.autoTable({
        startY: 44,
        head: [['Producto', 'Inicial', 'Camión', 'Vendido', 'Restante', 'Merma', 'Final', 'Total $']],
        body: [
          ['Pechuga', state.pollo.pechuga.initial.toFixed(2), state.pollo.pechuga.entries.toFixed(2), sold.pollo.pechuga.toFixed(2), pRest.toFixed(2), applyP ? '-'+pMerma.toFixed(2) : '0.00', pFinal.toFixed(2), money(sold.pollo.pechuga * state.pollo.pechuga.price)],
          ['Muslo', state.pollo.muslo.initial.toFixed(2), state.pollo.muslo.entries.toFixed(2), sold.pollo.muslo.toFixed(2), mRest.toFixed(2), applyM ? '-'+mMerma.toFixed(2) : '0.00', mFinal.toFixed(2), money(sold.pollo.muslo * state.pollo.muslo.price)]
        ],
        theme: 'grid',
        headStyles: { fillColor: [23, 77, 54] },
        styles: { fontSize: 8 }
      });

      let nextY = doc.lastAutoTable.finalY + 8;
      doc.setFont('helvetica', 'bold');
      doc.text('2. Embutidos y Empacados', 14, nextY);

      const packData = [];
      PACKAGED_CATALOG.forEach(p => {
        const item = state.packaged[p.id];
        const s = sold.pack[p.id] || 0;
        if (item.initial > 0 || item.entries > 0 || s > 0) {
          const rest = Math.max(0, item.initial + item.entries - s);
          packData.push([p.name, item.initial, item.entries, s, rest, money(s * item.price)]);
        }
      });

      doc.autoTable({
        startY: nextY + 2,
        head: [['Producto', 'Inicial', 'Camión', 'Vendido', 'Restante', 'Total $']],
        body: packData.length ? packData : [['Sin movimientos', '-', '-', '-', '-', '$0.00']],
        theme: 'grid',
        headStyles: { fillColor: [23, 77, 54] },
        styles: { fontSize: 8 }
      });

      let boxY = doc.lastAutoTable.finalY + 8;
      doc.setFont('helvetica', 'bold');
      doc.text('3. Arqueo de Caja', 14, boxY);
      doc.setFont('helvetica', 'normal');
      const countedVal = $('countedCash')?.value ? money(Number($('countedCash').value)) : 'No contado';
      const diffVal = $('countedCash')?.value ? money(fromCents(cents(Number($('countedCash').value)) - expectedC)) : 'N/A';
      doc.text(`Efectivo esperado: ${money(fromCents(expectedC))}  |  Contado: ${countedVal}  |  Diferencia: ${diffVal}`, 14, boxY + 6);

      let signY = boxY + 22;
      if (signY > 270) { doc.addPage(); signY = 30; }
      doc.line(14, signY, 90, signY);
      doc.line(120, signY, 196, signY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`Encargados del puesto: ${encargados}`, 14, signY + 5);
      doc.text('Firma del Patrono', 120, signY + 5);

      doc.save(`informe_ventas_${state.date}.pdf`);
    };
  }

  // ========== ARRANQUE ==========
  load();
  render();
})();