/**
 * STATIC-APP.JS
 * Lógica de aplicación — versión estática para GitHub Pages
 * Usa localStorage en lugar de API REST
 */
'use strict';

const LS_KEY = 'odontochart_autorizaciones';

/* ══════════════════════════════════════
   STORAGE (localStorage)
══════════════════════════════════════ */
function lsGetAll() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}
function lsSave(data) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

/* ══════════════════════════════════════
   VISTAS
══════════════════════════════════════ */
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const view = document.getElementById('view-' + name);
  const nav  = document.getElementById('nav-' + name);
  if (view) view.classList.add('active');
  if (nav)  nav.classList.add('active');
  const titles = {
    odontograma: ['Odontograma Clínico', 'Sistema FDI/ISO 3950 — Marque tratamientos por cara dental'],
    historial:   ['Autorizaciones Guardadas', 'Historial local guardado en este navegador'],
  };
  const [t, s] = titles[name] || ['', ''];
  document.getElementById('viewTitle').textContent   = t;
  document.getElementById('viewSubtitle').textContent = s;
  if (name === 'historial') cargarHistorial();
  if (window.innerWidth < 900) document.getElementById('sidebar').classList.remove('open');
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

/* ══════════════════════════════════════
   GUARDAR (localStorage)
══════════════════════════════════════ */
function abrirModalGuardar() {
  const list = buildTreatmentList();
  if (!list || list.length === 0) {
    showToast('Marque al menos una pieza en el odontograma', 'info');
    return;
  }
  const nombre = document.getElementById('pacienteNombre').value || 'Sin nombre';
  const os     = document.getElementById('pacienteOS').value || '—';

  const grouped = {};
  list.forEach(t => { if (!grouped[t.treatment]) grouped[t.treatment] = []; grouped[t.treatment].push(t.tooth); });

  document.getElementById('modalPreview').innerHTML = `
    <div style="background:var(--bg-input);border-radius:8px;padding:12px;margin-bottom:4px">
      <div style="font-size:0.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">
        ${escHtml(nombre)} · ${escHtml(os)} · ${list.length} tratamiento(s)
      </div>
      ${Object.entries(grouped).map(([tr, teeth]) => {
        const meta = TREATMENTS[tr] || {label:tr, color:'#888'};
        return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border)">
          <em style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${meta.color};flex-shrink:0"></em>
          <span style="font-weight:600;font-size:0.82rem">${meta.label}</span>
          <span style="margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:0.75rem;color:var(--text-secondary)">${teeth.join(', ')}</span>
        </div>`;
      }).join('')}
    </div>`;

  document.getElementById('modalGuardar').style.display = 'flex';
}

function guardarLocal() {
  const lista = lsGetAll();
  const nueva = {
    id: Date.now().toString(),
    fechaCreacion: new Date().toISOString(),
    pacienteNombre:    document.getElementById('pacienteNombre').value,
    pacienteDni:       document.getElementById('pacienteDni').value,
    pacienteOS:        document.getElementById('pacienteOS').value,
    pacienteNroAfiliado: document.getElementById('pacienteNroAfiliado').value,
    pacienteFecha:     document.getElementById('pacienteFecha').value,
    pacientePlan:      document.getElementById('pacientePlan').value,
    observaciones:     document.getElementById('observaciones').value,
    nroPrestacion:     document.getElementById('modalNroPrestacion').value,
    estado:            document.getElementById('modalEstado').value,
    notas:             document.getElementById('modalNotas').value,
    odontograma:       getOdontogramState(),
  };
  lista.push(nueva);
  lsSave(lista);
  document.getElementById('modalGuardar').style.display = 'none';
  showToast('Autorización guardada localmente', 'success');
  actualizarBadge();
}

/* ══════════════════════════════════════
   HISTORIAL
══════════════════════════════════════ */
let historialCache = [];

function cargarHistorial() {
  historialCache = lsGetAll();
  renderHistorial(historialCache);
  actualizarBadge();
}

function filtrarHistorial() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  const f = historialCache.filter(a =>
    (a.pacienteNombre||'').toLowerCase().includes(q) ||
    (a.pacienteOS||'').toLowerCase().includes(q) ||
    (a.pacienteDni||'').toLowerCase().includes(q)
  );
  renderHistorial(f);
}

function renderHistorial(lista) {
  const container = document.getElementById('listaHistorial');
  if (!container) return;
  if (!lista || lista.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <p>Sin autorizaciones guardadas</p>
      <span>Complete el odontograma y presione "Guardar" para crear una</span>
    </div>`;
    return;
  }
  container.innerHTML = lista.slice().reverse().map(a => {
    const fecha   = new Date(a.fechaCreacion).toLocaleDateString('es-AR');
    const estado  = a.estado || 'pendiente';
    const nTrat   = a.odontograma?.treatments?.length || 0;
    return `<div class="autorizacion-item" onclick="verDetalle('${a.id}')">
      <div class="autorizacion-info">
        <div class="autorizacion-nombre">${escHtml(a.pacienteNombre||'Sin nombre')}</div>
        <div class="autorizacion-meta">${escHtml(a.pacienteOS||'—')} · DNI: ${escHtml(a.pacienteDni||'—')} · ${fecha} · ${nTrat} pieza(s)</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <span class="badge badge-${estado}">${labelEstado(estado)}</span>
        <button class="icon-btn danger" title="Eliminar" onclick="event.stopPropagation();eliminar('${a.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');
}

function verDetalle(id) {
  const a = historialCache.find(x => x.id === id);
  if (!a) return;

  const fecha   = new Date(a.fechaCreacion).toLocaleString('es-AR');
  const estado  = a.estado || 'pendiente';
  const trats   = a.odontograma?.treatments || [];
  const grouped = {};
  trats.forEach(t => { if (!grouped[t.treatment]) grouped[t.treatment] = []; grouped[t.treatment].push(t); });

  document.getElementById('modalDetalleTitle').textContent = `Autorización — ${a.pacienteNombre || 'Sin nombre'}`;
  document.getElementById('modalDetalleBody').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
      <div><div style="font-size:0.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:3px">Paciente</div>
        <div style="font-size:0.9rem;font-weight:700">${escHtml(a.pacienteNombre||'—')}</div>
        <div style="font-size:0.78rem;color:var(--text-secondary)">DNI: ${escHtml(a.pacienteDni||'—')}</div>
      </div>
      <div><div style="font-size:0.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:3px">Obra Social</div>
        <div style="font-size:0.9rem;font-weight:700">${escHtml(a.pacienteOS||'—')}</div>
        <div style="font-size:0.78rem;color:var(--text-secondary)">Afiliado: ${escHtml(a.pacienteNroAfiliado||'—')} · Plan: ${escHtml(a.pacientePlan||'—')}</div>
      </div>
      <div><div style="font-size:0.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:3px">Fecha</div>
        <div style="font-size:0.82rem">${fecha}</div>
      </div>
      <div><div style="font-size:0.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:3px">Estado</div>
        <span class="badge badge-${estado}">${labelEstado(estado)}</span>
      </div>
    </div>
    ${a.nroPrestacion ? `<div style="margin-bottom:10px;font-size:0.82rem">N° Prestación: <code style="color:var(--accent)">${escHtml(a.nroPrestacion)}</code></div>` : ''}
    ${a.observaciones ? `<div style="font-size:0.82rem;color:var(--text-secondary);padding:10px;border:1px solid var(--border);border-radius:8px;margin-bottom:10px"><strong>Observaciones:</strong> ${escHtml(a.observaciones)}</div>` : ''}
    <div style="font-size:0.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px">Tratamientos (${trats.length})</div>
    ${Object.keys(grouped).length > 0 ? `<table class="resumen-table">
      <thead><tr><th>Tratamiento</th><th>Código OS</th><th>Piezas</th><th>Caras</th></tr></thead>
      <tbody>${Object.entries(grouped).map(([tr, items]) => {
        const m = TREATMENTS[tr] || {label:tr,color:'#888',code:'—'};
        return `<tr>
          <td><em style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${m.color};margin-right:6px"></em><strong>${m.label}</strong></td>
          <td style="font-family:'JetBrains Mono',monospace;font-size:0.78rem;color:var(--text-secondary)">${m.code||'—'}</td>
          <td style="font-family:'JetBrains Mono',monospace">${items.map(i=>i.tooth).join(', ')}</td>
          <td style="font-size:0.78rem;color:var(--text-secondary)">${items.map(i=>i.faces?i.faces.join('+'):'Completa').join(' | ')}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>` : '<p style="color:var(--text-muted);font-size:0.82rem">Sin tratamientos</p>'}
    ${a.notas ? `<div style="margin-top:10px;font-size:0.82rem;color:var(--text-secondary);padding:10px;border:1px solid var(--border);border-radius:8px"><strong>Notas OS:</strong> ${escHtml(a.notas)}</div>` : ''}
  `;

  document.getElementById('btnCargarDetalle').onclick = () => {
    // Restaurar datos paciente
    ['pacienteNombre','pacienteDni','pacienteOS','pacienteNroAfiliado','pacienteFecha','pacientePlan','observaciones']
      .forEach(id => { const el=document.getElementById(id); if(el && a[id]!==undefined) el.value=a[id]||''; });
    if (a.odontograma) loadOdontogramState(a.odontograma);
    document.getElementById('modalDetalle').style.display = 'none';
    showView('odontograma');
    showToast('Autorización cargada', 'success');
  };

  document.getElementById('btnEliminarDetalle').onclick = () => {
    if (!confirm('¿Eliminar esta autorización?')) return;
    eliminar(id);
    document.getElementById('modalDetalle').style.display = 'none';
  };

  document.getElementById('modalDetalle').style.display = 'flex';
}

function eliminar(id) {
  const lista = lsGetAll().filter(a => a.id !== id);
  lsSave(lista);
  historialCache = lista;
  renderHistorial(lista);
  actualizarBadge();
  showToast('Autorización eliminada', 'success');
}

function actualizarBadge() {
  const n = lsGetAll().length;
  const b = document.getElementById('historialBadge');
  if (b) b.textContent = n > 0 ? n + (n === 1 ? ' guardada' : ' guardadas') : '';
}

/* ══════════════════════════════════════
   LIMPIAR / IMPRIMIR
══════════════════════════════════════ */
function confirmarLimpiar() {
  if (!confirm('¿Limpiar todo el odontograma?')) return;
  clearOdontogram();
  showToast('Odontograma reiniciado', 'info');
}
function imprimirOdontograma() { window.print(); }

/* ══════════════════════════════════════
   HELPERS
══════════════════════════════════════ */
function labelEstado(e) {
  return { pendiente:'Pendiente', autorizada:'Autorizada', rechazada:'Rechazada', en_proceso:'En proceso' }[e] || e;
}
function escHtml(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(msg, type = 'info') {
  const icons = {
    success:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  };
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = (icons[type] || icons.info) + `<span>${escHtml(msg)}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; t.style.transition='opacity 300ms'; setTimeout(()=>t.remove(),300); }, 3500);
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-overlay').forEach(m => m.style.display='none');
});

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('pacienteFecha').value = new Date().toISOString().split('T')[0];
  actualizarBadge();
});
