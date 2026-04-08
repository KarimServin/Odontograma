/**
 * APP.JS
 * Lógica de aplicación del portal de demostración.
 * Para integrar en otro portal, solo se necesitan:
 *   - odontograma.js  (motor del componente)
 *   - odontograma-embed.css  (estilos del componente)
 *
 * Este archivo maneja: vistas, guardado vía API REST, modales, toasts.
 */

'use strict';

/* ══════════════════════════════════════
   NAVEGACIÓN DE VISTAS
══════════════════════════════════════ */
const VIEW_TITLES = {
  odontograma:   ['Odontograma Clínico', 'Sistema FDI/ISO 3950 — Marcado de tratamientos por cara dental'],
  autorizaciones:['Autorizaciones Guardadas', 'Historial de solicitudes a obras sociales'],
  pacientes:     ['Pacientes Registrados', 'Historia clínica por paciente'],
};

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const view = document.getElementById(`view-${name}`);
  const nav  = document.getElementById(`nav-${name}`);
  if (view) view.classList.add('active');
  if (nav)  nav.classList.add('active');

  const [title, subtitle] = VIEW_TITLES[name] || ['', ''];
  document.getElementById('viewTitle').textContent    = title;
  document.getElementById('viewSubtitle').textContent = subtitle;

  // Lazy-load list views
  if (name === 'autorizaciones') cargarAutorizaciones();
  if (name === 'pacientes')       cargarPacientes();

  // Close sidebar on mobile
  if (window.innerWidth < 900) {
    document.getElementById('sidebar').classList.remove('open');
  }
}

/* Sidebar toggle (mobile) */
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

/* ══════════════════════════════════════
   AUTORIZACIONES — API REST
══════════════════════════════════════ */
let autorizacionesCache = [];

async function cargarAutorizaciones() {
  try {
    const r = await fetch('/api/autorizaciones');
    autorizacionesCache = await r.json();
    renderListaAutorizaciones(autorizacionesCache);
    cargarPacientes(); // refresh
  } catch (e) {
    showToast('Error al cargar autorizaciones', 'error');
  }
}

function filtrarAutorizaciones() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  const filtered = autorizacionesCache.filter(a =>
    (a.pacienteNombre || '').toLowerCase().includes(q) ||
    (a.pacienteOS || '').toLowerCase().includes(q) ||
    (a.pacienteDni || '').toLowerCase().includes(q)
  );
  renderListaAutorizaciones(filtered);
}

function renderListaAutorizaciones(list) {
  const container = document.getElementById('listaAutorizaciones');
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <p>No hay autorizaciones guardadas</p>
        <span>Complete el odontograma y guarde una autorización para ver el historial</span>
      </div>`;
    return;
  }

  container.innerHTML = list.map(a => {
    const fecha = a.fechaCreacion ? new Date(a.fechaCreacion).toLocaleDateString('es-AR') : '—';
    const nombre = a.pacienteNombre || 'Paciente sin nombre';
    const os = a.pacienteOS || '—';
    const estado = a.estado || 'pendiente';
    const nPiezas = a.odontograma?.treatments?.length || 0;
    return `
      <div class="autorizacion-item" onclick="verDetalle('${a.id}')">
        <div class="autorizacion-info">
          <div class="autorizacion-nombre">${escapeHtml(nombre)}</div>
          <div class="autorizacion-meta">
            ${escapeHtml(os)} · DNI: ${escapeHtml(a.pacienteDni || '—')} · ${fecha} · ${nPiezas} pieza(s) marcada(s)
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <span class="badge badge-${estado}">${labelEstado(estado)}</span>
          <div class="autorizacion-actions">
            <button class="icon-btn" title="Imprimir" onclick="event.stopPropagation();imprimirPorId('${a.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            </button>
            <button class="icon-btn danger" title="Eliminar" onclick="event.stopPropagation();eliminarAutorizacion('${a.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>
        </div>
      </div>`;
  }).join('');
}

function labelEstado(e) {
  const map = { pendiente:'Pendiente', autorizada:'Autorizada', rechazada:'Rechazada', en_proceso:'En proceso' };
  return map[e] || e;
}

/* ══════════════════════════════════════
   DETALLE DE AUTORIZACIÓN
══════════════════════════════════════ */

let detalleActual = null;

async function verDetalle(id) {
  try {
    const r = await fetch(`/api/autorizaciones/${id}`);
    const a = await r.json();
    detalleActual = a;

    document.getElementById('modalDetalleTitle').textContent =
      `Autorización — ${a.pacienteNombre || 'Sin nombre'}`;

    const fecha = a.fechaCreacion ? new Date(a.fechaCreacion).toLocaleString('es-AR') : '—';
    const estado = a.estado || 'pendiente';
    const treatments = a.odontograma?.treatments || [];

    let treatTable = '';
    if (treatments.length > 0) {
      const grouped = {};
      treatments.forEach(t => {
        if (!grouped[t.treatment]) grouped[t.treatment] = [];
        grouped[t.treatment].push(t);
      });
      treatTable = `<table class="resumen-table" style="margin-top:10px">
        <thead><tr><th>Tratamiento</th><th>Código</th><th>Piezas</th><th>Caras</th></tr></thead><tbody>`;
      Object.entries(grouped).forEach(([tr, list]) => {
        const meta = TREATMENTS[tr] || { label: tr, color: '#888', code: '—' };
        treatTable += `<tr>
          <td><span style="display:inline-flex;align-items:center;gap:6px">
            <em style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${meta.color}"></em>
            <strong>${meta.label}</strong></span></td>
          <td style="font-family:'JetBrains Mono',monospace;font-size:0.78rem;color:#94a3b8">${meta.code || '—'}</td>
          <td style="font-family:'JetBrains Mono',monospace">${list.map(i=>i.tooth).join(', ')}</td>
          <td style="font-size:0.78rem;color:#94a3b8">${list.map(i=>i.faces?i.faces.join('+'):'Completa').join(' | ')}</td>
        </tr>`;
      });
      treatTable += '</tbody></table>';
    }

    document.getElementById('modalDetalleBody').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
        <div>
          <div style="font-size:0.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px">Paciente</div>
          <div style="font-size:0.9rem;font-weight:700">${escapeHtml(a.pacienteNombre||'—')}</div>
          <div style="font-size:0.78rem;color:var(--text-secondary)">DNI: ${escapeHtml(a.pacienteDni||'—')}</div>
        </div>
        <div>
          <div style="font-size:0.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px">Obra Social</div>
          <div style="font-size:0.9rem;font-weight:700">${escapeHtml(a.pacienteOS||'—')}</div>
          <div style="font-size:0.78rem;color:var(--text-secondary)">Afiliado: ${escapeHtml(a.pacienteNroAfiliado||'—')} · Plan: ${escapeHtml(a.pacientePlan||'—')}</div>
        </div>
        <div>
          <div style="font-size:0.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px">Fecha</div>
          <div style="font-size:0.85rem">${fecha}</div>
        </div>
        <div>
          <div style="font-size:0.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px">Estado</div>
          <div><span class="badge badge-${estado}">${labelEstado(estado)}</span></div>
        </div>
      </div>
      ${a.nroPrestacion ? `<div style="margin-bottom:10px"><span style="font-size:0.72rem;color:var(--text-muted)">N° Prestación:</span> <code style="color:var(--accent)">${escapeHtml(a.nroPrestacion)}</code></div>` : ''}
      ${a.observaciones ? `<div style="font-size:0.82rem;color:var(--text-secondary);padding:10px;border:1px solid var(--border);border-radius:8px;margin-bottom:10px"><strong>Observaciones:</strong> ${escapeHtml(a.observaciones)}</div>` : ''}
      <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">
        Tratamientos solicitados (${treatments.length})
      </div>
      ${treatTable || '<div style="color:var(--text-muted);font-size:0.82rem">Sin tratamientos registrados</div>'}
      ${a.notas ? `<div style="margin-top:10px;font-size:0.82rem;color:var(--text-secondary);padding:10px;border:1px solid var(--border);border-radius:8px"><strong>Notas para OS:</strong> ${escapeHtml(a.notas)}</div>` : ''}
    `;

    document.getElementById('btnCargarAutorizacion').onclick = () => {
      cargarEnOdontograma(a);
      cerrarModal('modalDetalle');
      showView('odontograma');
      showToast('Autorización cargada en el odontograma', 'success');
    };

    document.getElementById('modalDetalle').style.display = 'flex';
  } catch (e) {
    showToast('Error al cargar el detalle', 'error');
  }
}

function cargarEnOdontograma(a) {
  // Restore patient data
  setVal('pacienteNombre', a.pacienteNombre);
  setVal('pacienteDni', a.pacienteDni);
  setVal('pacienteOS', a.pacienteOS);
  setVal('pacienteNroAfiliado', a.pacienteNroAfiliado);
  setVal('pacienteFecha', a.pacienteFecha);
  setVal('pacientePlan', a.pacientePlan);
  setVal('observaciones', a.observaciones);

  // Restore odontogram state
  if (a.odontograma) loadOdontogramState(a.odontograma);
}

/* ══════════════════════════════════════
   GUARDAR AUTORIZACIÓN
══════════════════════════════════════ */

function abrirModalGuardar() {
  const treatments = buildTreatmentList();
  if (treatments.length === 0) {
    showToast('Marque al menos una pieza en el odontograma', 'info');
    return;
  }

  const nombre  = getVal('pacienteNombre') || 'Sin nombre';
  const os      = getVal('pacienteOS') || '—';
  const dni     = getVal('pacienteDni') || '—';
  const nPiezas = treatments.length;

  // Group for preview
  const grouped = {};
  treatments.forEach(t => {
    if (!grouped[t.treatment]) grouped[t.treatment] = [];
    grouped[t.treatment].push(t.tooth);
  });

  const previewRows = Object.entries(grouped).map(([tr, teeth]) => {
    const meta = TREATMENTS[tr] || { label: tr, color: '#888' };
    return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border)">
      <em style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${meta.color};flex-shrink:0"></em>
      <span style="font-weight:600;font-size:0.82rem">${meta.label}</span>
      <span style="margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:0.75rem;color:var(--text-secondary)">${teeth.join(', ')}</span>
    </div>`;
  }).join('');

  document.getElementById('modalPreview').innerHTML = `
    <div style="background:var(--bg-input);border-radius:var(--radius-sm);padding:12px;margin-bottom:4px">
      <div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">
        ${nombre} · ${os} · ${nPiezas} tratamiento(s)
      </div>
      ${previewRows}
    </div>`;

  document.getElementById('modalGuardar').style.display = 'flex';
}

async function guardarAutorizacion() {
  const payload = {
    pacienteNombre: getVal('pacienteNombre'),
    pacienteDni:    getVal('pacienteDni'),
    pacienteOS:     getVal('pacienteOS'),
    pacienteNroAfiliado: getVal('pacienteNroAfiliado'),
    pacienteFecha:  getVal('pacienteFecha'),
    pacientePlan:   getVal('pacientePlan'),
    observaciones:  getVal('observaciones'),
    nroPrestacion:  getVal('modalNroPrestacion'),
    estado:         getVal('modalEstado'),
    notas:          getVal('modalNotas'),
    odontograma:    getOdontogramState(),
  };

  try {
    const r = await fetch('/api/autorizaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error('Error del servidor');
    cerrarModal('modalGuardar');
    showToast('Autorización guardada correctamente', 'success');
    cargarAutorizaciones();
  } catch (e) {
    showToast('Error al guardar: ' + e.message, 'error');
  }
}

/* ══════════════════════════════════════
   ELIMINAR AUTORIZACIÓN
══════════════════════════════════════ */

async function eliminarAutorizacion(id) {
  if (!confirm('¿Eliminar esta autorización? Esta acción no se puede deshacer.')) return;
  try {
    await fetch(`/api/autorizaciones/${id}`, { method: 'DELETE' });
    showToast('Autorización eliminada', 'success');
    await cargarAutorizaciones();
  } catch {
    showToast('Error al eliminar', 'error');
  }
}

/* ══════════════════════════════════════
   PACIENTES
══════════════════════════════════════ */

function cargarPacientes() {
  const container = document.getElementById('listaPacientes');
  if (!container) return;

  // Group autorizaciones by patient
  const byPatient = {};
  autorizacionesCache.forEach(a => {
    const key = a.pacienteDni || a.pacienteNombre || 'Sin identificar';
    if (!byPatient[key]) {
      byPatient[key] = { nombre: a.pacienteNombre, dni: a.pacienteDni, os: a.pacienteOS, lista: [] };
    }
    byPatient[key].lista.push(a);
  });

  if (Object.keys(byPatient).length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
        <p>Sin pacientes registrados</p>
        <span>Los pacientes aparecerán aquí al guardar autorizaciones</span>
      </div>`;
    return;
  }

  container.innerHTML = Object.values(byPatient).map(p => `
    <div class="autorizacion-item">
      <div style="width:40px;height:40px;background:linear-gradient(135deg,var(--primary),var(--secondary));border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:700;color:white;flex-shrink:0">
        ${(p.nombre || 'S')[0].toUpperCase()}
      </div>
      <div class="autorizacion-info">
        <div class="autorizacion-nombre">${escapeHtml(p.nombre || 'Sin nombre')}</div>
        <div class="autorizacion-meta">
          DNI: ${escapeHtml(p.dni || '—')} · OS: ${escapeHtml(p.os || '—')} · ${p.lista.length} autorización(es)
        </div>
      </div>
      <div style="display:flex;gap:4px">
        ${p.lista.slice(0,3).map(a=>`
          <span class="badge badge-${a.estado||'pendiente'}" style="font-size:0.6rem">
            ${new Date(a.fechaCreacion).toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit'})}
          </span>`).join('')}
      </div>
    </div>`).join('');
}

/* ══════════════════════════════════════
   LIMPIAR ODONTOGRAMA
══════════════════════════════════════ */

function confirmarLimpiar() {
  if (!confirm('¿Limpiar todo el odontograma? Se perderán los marcados actuales.')) return;
  clearOdontogram();
  showToast('Odontograma reiniciado', 'info');
}

/* ══════════════════════════════════════
   IMPRESIÓN
══════════════════════════════════════ */

function imprimirOdontograma() {
  window.print();
}

async function imprimirPorId(id) {
  // Load into odontogram and print
  try {
    const r = await fetch(`/api/autorizaciones/${id}`);
    const a = await r.json();
    cargarEnOdontograma(a);
    showView('odontograma');
    setTimeout(() => window.print(), 400);
  } catch {
    showToast('Error al cargar para imprimir', 'error');
  }
}

/* ══════════════════════════════════════
   MODALES
══════════════════════════════════════ */

function cerrarModal(id) {
  document.getElementById(id).style.display = 'none';
}

// Close on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.style.display = 'none';
  });
});

// Close on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
  }
});

/* ══════════════════════════════════════
   TOAST NOTIFICATIONS
══════════════════════════════════════ */

function showToast(message, type = 'info') {
  const icons = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  };
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `${icons[type] || icons.info}<span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 300ms';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/* ══════════════════════════════════════
   HELPERS
══════════════════════════════════════ */

function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}
function setVal(id, val) {
  const el = document.getElementById(id);
  if (el && val !== undefined && val !== null) el.value = val;
}
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* Startup */
document.addEventListener('DOMContentLoaded', () => {
  cargarAutorizaciones();
});
