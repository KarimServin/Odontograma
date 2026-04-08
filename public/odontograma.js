/**
 * ODONTOGRAMA.JS
 * Motor de renderizado y estado del odontograma geométrico
 * Sistema FDI/ISO 3950 — Dientes permanentes y temporarios
 *
 * Faces per tooth:
 *  - OCLUSAL/INCISAL (O): center square/diamond
 *  - MESIAL (M): left triangle
 *  - DISTAL (D): right triangle
 *  - VESTIBULAR (V): top triangle
 *  - LINGUAL (L): bottom triangle
 */

'use strict';

/* ═══════════════════════════════════════════
   1. DEFINITIONS — FDI Tooth Numbers
═══════════════════════════════════════════ */

const PERMANENT_TEETH = {
  topRight:  [18, 17, 16, 15, 14, 13, 12, 11],   // Cuadrante 1 (superior derecho)
  topLeft:   [21, 22, 23, 24, 25, 26, 27, 28],   // Cuadrante 2 (superior izquierdo)
  bottomLeft: [31, 32, 33, 34, 35, 36, 37, 38],  // Cuadrante 3 (inferior izquierdo)
  bottomRight:[48, 47, 46, 45, 44, 43, 42, 41],  // Cuadrante 4 (inferior derecho)
};

const TEMP_TEETH = {
  topRight:  [55, 54, 53, 52, 51],  // Cuadrante 5
  topLeft:   [61, 62, 63, 64, 65],  // Cuadrante 6
  bottomLeft: [71, 72, 73, 74, 75], // Cuadrante 7
  bottomRight:[85, 84, 83, 82, 81], // Cuadrante 8
};

// Tooth type by FDI number
function getToothType(num) {
  const second = num % 10;
  if (second === 1 || second === 2) return 'incisor';
  if (second === 3) return 'canine';
  if (second === 4 || second === 5) return 'premolar';
  return 'molar'; // 6,7,8
}

// Human-readable name
function getToothName(num) {
  const names = {
    11: 'Incisivo Central SD', 12: 'Incisivo Lateral SD', 13: 'Canino SD',
    14: 'Primer Premolar SD', 15: 'Segundo Premolar SD',
    16: 'Primer Molar SD', 17: 'Segundo Molar SD', 18: 'Tercer Molar SD',
    21: 'Incisivo Central SI', 22: 'Incisivo Lateral SI', 23: 'Canino SI',
    24: 'Primer Premolar SI', 25: 'Segundo Premolar SI',
    26: 'Primer Molar SI', 27: 'Segundo Molar SI', 28: 'Tercer Molar SI',
    31: 'Incisivo Central II', 32: 'Incisivo Lateral II', 33: 'Canino II', // II = Inferior izquierdo
    34: 'Primer Premolar II', 35: 'Segundo Premolar II',
    36: 'Primer Molar II', 37: 'Segundo Molar II', 38: 'Tercer Molar II',
    41: 'Incisivo Central ID', 42: 'Incisivo Lateral ID', 43: 'Canino ID',
    44: 'Primer Premolar ID', 45: 'Segundo Premolar ID',
    46: 'Primer Molar ID', 47: 'Segundo Molar ID', 48: 'Tercer Molar ID',
    // Temporarios
    51:'Incisivo Central TD SD',52:'Incisivo Lateral TD SD',53:'Canino TD SD',54:'1er Molar TD SD',55:'2do Molar TD SD',
    61:'Incisivo Central TD SI',62:'Incisivo Lateral TD SI',63:'Canino TD SI',64:'1er Molar TD SI',65:'2do Molar TD SI',
    71:'Incisivo Central TD II',72:'Incisivo Lateral TD II',73:'Canino TD II',74:'1er Molar TD II',75:'2do Molar TD II',
    81:'Incisivo Central TD ID',82:'Incisivo Lateral TD ID',83:'Canino TD ID',84:'1er Molar TD ID',85:'2do Molar TD ID',
  };
  return names[num] || `Pieza ${num}`;
}

// Face label map
const FACE_LABELS = { O: 'Oclusal/Incisal', M: 'Mesial', D: 'Distal', V: 'Vestibular', L: 'Lingual/Palatino' };

/* ═══════════════════════════════════════════
   2. STATE
═══════════════════════════════════════════ */

/** toothState[toothId] = { O: 'caries', M: 'sano', D: null, V: 'corona', L: null, whole: null }
 *  'whole' is for full-tooth states (ausente, extraccion, implante, endodoncia)
 */
const toothState = {};
let currentTool = 'caries';
let currentDentition = 'permanente'; // or 'temporario'

// Treatment meta
const TREATMENTS = {
  caries:     { label: 'Caries',       color: '#ef4444', code: '02.01', whole: false },
  obturacion: { label: 'Obturación',   color: '#3b82f6', code: '02.15', whole: false },
  fractura:   { label: 'Fractura',     color: '#f97316', code: '01.04', whole: false },
  corona:     { label: 'Corona',       color: '#eab308', code: '04.01.04', whole: true  },
  endodoncia: { label: 'Endodoncia',   color: '#8b5cf6', code: '03.01',  whole: true  },
  resina:     { label: 'Resina',       color: '#06b6d4', code: '02.16', whole: false },
  extraccion: { label: 'Extracción',   color: '#dc2626', code: '10.01', whole: true  },
  ausente:    { label: 'Ausente',      color: '#6b7280', code: 'AUS',   whole: true  },
  implante:   { label: 'Implante',     color: '#10b981', code: '11.01', whole: true  },
  sano:       { label: 'Sano (borrar)',color: '#1e293b', code: '',      whole: false },
};

/* ═══════════════════════════════════════════
   3. SVG TOOTH GENERATOR
      Geometric layout (52×52 px viewBox):
      
        V (top)
       /     \
      M (left) D (right)
       \     /
        L (bot)
      Center: O (oclusal)
═══════════════════════════════════════════ */

function createToothSVG(toothId) {
  const type = getToothType(toothId);
  const state = toothState[toothId] || {};
  const isWhole = state.whole;

  // Color helpers
  function fc(face) {
    if (isWhole && state.whole && state.whole !== 'sano') {
      return TREATMENTS[state.whole]?.color || '#1e3a5f';
    }
    const t = state[face];
    if (!t || t === 'sano') return '#1e3a5f';
    return TREATMENTS[t]?.color || '#1e3a5f';
  }

  const stroke = '#0f2540';
  const strokeW = 1.2;
  const baseColor = isWhole && state.whole && state.whole !== 'sano'
    ? TREATMENTS[state.whole]?.color
    : '#1e3a5f';
  const isAusente = state.whole === 'ausente';
  const isExtraccion = state.whole === 'extraccion';
  const isImplante = state.whole === 'implante';
  const isEndodoncia = state.whole === 'endodoncia';
  const isCorona = state.whole === 'corona';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 52 52');
  svg.setAttribute('class', 'tooth-svg');
  svg.setAttribute('data-tooth', toothId);

  // ── Whole-tooth overlays ──
  if (isAusente) {
    // Grey fill + X cross
    const rect = makeRect(svg, 4, 4, 44, 44, '#374151', stroke, strokeW, 4, 'whole', toothId);
    svg.appendChild(rect);
    const l1 = makeEl('line', { x1:10,y1:10,x2:42,y2:42, stroke:'#9ca3af','stroke-width':2.5, 'stroke-linecap':'round' });
    const l2 = makeEl('line', { x1:42,y1:10,x2:10,y2:42, stroke:'#9ca3af','stroke-width':2.5, 'stroke-linecap':'round' });
    svg.appendChild(l1); svg.appendChild(l2);
    addToothFaceEvents(svg, toothId, 'whole');
    return svg;
  }

  if (isExtraccion) {
    const rect = makeRect(svg, 4, 4, 44, 44, '#dc2626', stroke, strokeW, 4, 'whole', toothId);
    svg.appendChild(rect);
    const l1 = makeEl('line', { x1:10,y1:10,x2:42,y2:42, stroke:'white','stroke-width':2.5,'stroke-linecap':'round','opacity':'0.7' });
    const l2 = makeEl('line', { x1:42,y1:10,x2:10,y2:42, stroke:'white','stroke-width':2.5,'stroke-linecap':'round','opacity':'0.7' });
    svg.appendChild(l1); svg.appendChild(l2);
    const t = makeEl('text', { x:'26', y:'45', 'font-size':'6', fill:'#fff', 'text-anchor':'middle', 'font-family':'Inter', opacity:'0.7' });
    t.textContent = 'EXT';
    svg.appendChild(t);
    addToothFaceEvents(svg, toothId, 'whole');
    return svg;
  }

  if (isImplante) {
    // Implant: green with bolt icon
    const rect = makeRect(svg, 4, 4, 44, 44, '#10b981', stroke, strokeW, 4, 'whole', toothId);
    svg.appendChild(rect);
    const circ = makeEl('circle', {cx:'26',cy:'22',r:'8', fill:'white', opacity:'0.3'});
    const bolt = makeEl('text', {x:'26',y:'44','font-size':'6','fill':'white','text-anchor':'middle','font-family':'Inter', opacity:'0.8'});
    bolt.textContent = 'IMP';
    svg.appendChild(circ); svg.appendChild(bolt);
    addToothFaceEvents(svg, toothId, 'whole');
    return svg;
  }

  if (isCorona) {
    // Crown: yellow border + crown icon
    const rect = makeRect(svg, 2, 2, 48, 48, '#eab308', stroke, 2.5, 4, 'whole', toothId);
    svg.appendChild(rect);
    // Inner fill
    const inner = makeEl('rect', {x:'6',y:'6',width:'40',height:'40',rx:'2',fill:'rgba(234,179,8,0.2)'});
    svg.appendChild(inner);
    const label = makeEl('text', {x:'26',y:'30','font-size':'7','fill':'#eab308','text-anchor':'middle','font-family':'Inter','font-weight':'700'});
    label.textContent = 'COR';
    svg.appendChild(label);
    addToothFaceEvents(svg, toothId, 'whole');
    return svg;
  }

  if (isEndodoncia) {
    // Endodontics: filled center with canal lines
    const rect = makeRect(svg, 4, 4, 44, 44, '#1e3a5f', stroke, strokeW, 4, 'whole', toothId);
    svg.appendChild(rect);
    // Canal lines from center down (simplified)
    const c1 = makeEl('line', {x1:'26',y1:'14',x2:'16',y2:'44',stroke:'#8b5cf6','stroke-width':2.5,'stroke-linecap':'round'});
    const c2 = makeEl('line', {x1:'26',y1:'14',x2:'26',y2:'44',stroke:'#8b5cf6','stroke-width':2.5,'stroke-linecap':'round'});
    const c3 = makeEl('line', {x1:'26',y1:'14',x2:'36',y2:'44',stroke:'#8b5cf6','stroke-width':2.5,'stroke-linecap':'round'});
    svg.appendChild(c1); svg.appendChild(c2); svg.appendChild(c3);
    const dot = makeEl('circle',{cx:'26',cy:'14',r:'3.5',fill:'#8b5cf6'});
    svg.appendChild(dot);
    const label = makeEl('text',{x:'26',y:'12','font-size':'5','fill':'#8b5cf6','text-anchor':'middle','font-family':'Inter'});
    label.textContent='TR.C';
    svg.appendChild(label);
    addToothFaceEvents(svg, toothId, 'whole');
    return svg;
  }

  // ── Normal geometric 5-face tooth ──
  // Face polygons (V=top, L=bottom, M=left, D=right, O=center)
  // Layout within 52x52 (with 3px margin):
  //   Center square: 18,18 → 34,18 → 34,34 → 18,34
  //   V top triangle: 18,18 → 34,18 → 26,6
  //   L bottom triangle: 18,34 → 34,34 → 26,46
  //   M left triangle: 18,18 → 18,34 → 6,26
  //   D right triangle: 34,18 → 34,34 → 46,26

  const faces = [
    { id: 'V', tag: 'polygon', points: '18,18 34,18 26,6', face: 'V' },
    { id: 'L', tag: 'polygon', points: '18,34 34,34 26,46', face: 'L' },
    { id: 'M', tag: 'polygon', points: '18,18 18,34 6,26',  face: 'M' },
    { id: 'D', tag: 'polygon', points: '34,18 34,34 46,26', face: 'D' },
    { id: 'O', tag: 'rect',   x: 18, y: 18, w: 16, h: 16,  face: 'O' },
  ];

  faces.forEach(f => {
    let el;
    if (f.tag === 'polygon') {
      el = makeEl('polygon', {
        points: f.points,
        fill: fc(f.face),
        stroke, 'stroke-width': strokeW,
        'stroke-linejoin': 'round',
        'data-face': f.face,
        class: 'tooth-face',
        style: 'cursor:pointer'
      });
    } else {
      // center rect with border
      el = makeEl('rect', {
        x: f.x, y: f.y, width: f.w, height: f.h,
        fill: fc(f.face),
        stroke, 'stroke-width': strokeW,
        'data-face': f.face,
        class: 'tooth-face',
        style: 'cursor:pointer'
      });
    }
    el.addEventListener('click', (e) => { e.stopPropagation(); handleFaceClick(toothId, f.face); });
    el.addEventListener('mouseenter', (e) => showFaceTooltip(e, toothId, f.face));
    el.addEventListener('mouseleave', hideTooltip);
    svg.appendChild(el);
  });

  // Tooth number label at bottom
  const lbl = makeEl('text', {
    x: '26', y: '51',
    'font-size': '4.5',
    fill: '#475569',
    'text-anchor': 'middle',
    'font-family': 'JetBrains Mono',
    'font-weight': '600',
    style: 'pointer-events:none'
  });
  lbl.textContent = toothId;
  svg.appendChild(lbl);

  // Tooth outline (decorative border)
  const outline = makeEl('rect', {
    x:1, y:1, width:50, height:50, rx:4,
    fill:'none',
    stroke: '#1a3456',
    'stroke-width':'0.8',
    style:'pointer-events:none'
  });
  svg.appendChild(outline);

  return svg;
}

/* ═══════════════════════════════════════════
   4. SVG HELPERS
═══════════════════════════════════════════ */

function makeEl(tag, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

function makeRect(parent, x, y, w, h, fill, stroke, sw, rx, face, toothId) {
  const el = makeEl('rect', {
    x, y, width: w, height: h, rx: rx || 0,
    fill, stroke, 'stroke-width': sw,
    'data-face': face,
    class: 'tooth-face',
    style: 'cursor:pointer'
  });
  el.addEventListener('click', (e) => { e.stopPropagation(); handleFaceClick(toothId, face); });
  return el;
}

function addToothFaceEvents(svg, toothId, face) {
  svg.addEventListener('click', (e) => { e.stopPropagation(); handleFaceClick(toothId, face); });
  svg.addEventListener('mouseenter', (e) => showFaceTooltip(e, toothId, face));
  svg.addEventListener('mouseleave', hideTooltip);
}

/* ═══════════════════════════════════════════
   5. RENDERING
═══════════════════════════════════════════ */

function renderOdontogram() {
  const isTemp = currentDentition === 'temporario';
  const teeth = isTemp ? TEMP_TEETH : PERMANENT_TEETH;

  // Top arch: topRight + topLeft
  const topTeeth = [...teeth.topRight, ...teeth.topLeft];
  // Bottom arch: bottomLeft + bottomRight  
  const bottomTeeth = [...teeth.bottomLeft, ...teeth.bottomRight];

  renderArch('archTop', topTeeth, 'top');
  renderArch('archBottom', bottomTeeth, 'bottom');
  renderFdiNumbers('fdiTopNumbers', topTeeth);
  renderFdiNumbers('fdiBottomNumbers', bottomTeeth);
  updateResumenCard();
}

function renderArch(containerId, teethArr, position) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  teethArr.forEach(toothId => {
    const wrapper = document.createElement('div');
    wrapper.className = 'tooth-wrapper';
    wrapper.id = `tooth-${toothId}`;
    wrapper.title = getToothName(toothId);

    const state = toothState[toothId];
    if (state?.whole === 'ausente') wrapper.classList.add('ausente');
    if (state?.whole === 'extraccion') wrapper.classList.add('extraccion');

    const svgEl = createToothSVG(toothId);
    wrapper.appendChild(svgEl);
    container.appendChild(wrapper);
  });
}

function renderFdiNumbers(containerId, teethArr) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  teethArr.forEach(num => {
    const span = document.createElement('span');
    span.className = 'fdi-num';
    span.textContent = num;
    span.id = `fdi-${num}`;
    container.appendChild(span);
  });
}

/* ═══════════════════════════════════════════
   6. INTERACTION
═══════════════════════════════════════════ */

function handleFaceClick(toothId, face) {
  const treatment = currentTool;
  const meta = TREATMENTS[treatment];
  if (!toothState[toothId]) toothState[toothId] = {};

  if (treatment === 'sano') {
    // Clear all faces of this tooth
    toothState[toothId] = {};
  } else if (meta.whole) {
    // Whole-tooth treatment
    if (toothState[toothId].whole === treatment) {
      // Toggle off
      toothState[toothId] = {};
    } else {
      toothState[toothId] = { whole: treatment };
    }
  } else {
    // Per-face treatment
    if (toothState[toothId].whole) {
      // If whole state, can't paint individual faces (except sano)
      showToast('Limpie el estado del diente primero con "Borrar"', 'info');
      return;
    }
    if (toothState[toothId][face] === treatment) {
      toothState[toothId][face] = null;
    } else {
      toothState[toothId][face] = treatment;
    }
  }

  // Re-render just this tooth
  refreshTooth(toothId);
  updateResumenCard();

  // Pulse animation on FDI label
  const fdiEl = document.getElementById(`fdi-${toothId}`);
  if (fdiEl) {
    fdiEl.classList.add('highlighted');
    setTimeout(() => fdiEl.classList.remove('highlighted'), 800);
  }
}

function refreshTooth(toothId) {
  const wrapper = document.getElementById(`tooth-${toothId}`);
  if (!wrapper) return;

  // Remove overlay classes
  wrapper.classList.remove('ausente', 'extraccion');

  // Rebuild SVG
  const oldSvg = wrapper.querySelector('.tooth-svg');
  if (oldSvg) oldSvg.remove();
  const newSvg = createToothSVG(toothId);
  wrapper.insertBefore(newSvg, wrapper.firstChild);

  // Re-add classes
  const state = toothState[toothId];
  if (state?.whole === 'ausente') wrapper.classList.add('ausente');
  if (state?.whole === 'extraccion') wrapper.classList.add('extraccion');
}

/* ═══════════════════════════════════════════
   7. TOOL SELECTION
═══════════════════════════════════════════ */

function selectTool(toolName) {
  currentTool = toolName;
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`tool-${toolName}`);
  if (btn) btn.classList.add('active');
}

/* ═══════════════════════════════════════════
   8. DENTITION SWITCH
═══════════════════════════════════════════ */

function switchDentition(type) {
  currentDentition = type;
  document.getElementById('togglePermanente').classList.toggle('active', type === 'permanente');
  document.getElementById('toggleTemporario').classList.toggle('active', type === 'temporario');
  renderOdontogram();
}

/* ═══════════════════════════════════════════
   9. TOOLTIP
═══════════════════════════════════════════ */

let tooltipTimer = null;
function showFaceTooltip(event, toothId, face) {
  clearTimeout(tooltipTimer);
  tooltipTimer = setTimeout(() => {
    const tooltip = document.getElementById('tooltip');
    const state = toothState[toothId] || {};
    const treatment = state.whole || state[face] || null;
    const toothName = getToothName(toothId);
    const faceName = face === 'whole' ? 'Toda la pieza' : (FACE_LABELS[face] || face);
    const treatName = treatment ? TREATMENTS[treatment]?.label : 'Sano';
    const toolName = TREATMENTS[currentTool]?.label || currentTool;

    tooltip.innerHTML = `
      <strong style="display:block;margin-bottom:3px;color:#e2e8f0">${toothName}</strong>
      <span style="color:#94a3b8">Cara: ${faceName}</span><br/>
      <span style="color:#94a3b8">Estado: <span style="color:${treatment ? TREATMENTS[treatment]?.color : '#10b981'}">${treatName}</span></span><br/>
      <span style="color:#64748b;font-size:0.68rem;margin-top:3px;display:block">Herramienta: ${toolName}</span>
    `;
    tooltip.classList.add('visible');
    moveTooltip(event);
  }, 150);
}

function moveTooltip(event) {
  const tooltip = document.getElementById('tooltip');
  const x = event.clientX + 14;
  const y = event.clientY - 10;
  const maxX = window.innerWidth - tooltip.offsetWidth - 8;
  const maxY = window.innerHeight - tooltip.offsetHeight - 8;
  tooltip.style.left = Math.min(x, maxX) + 'px';
  tooltip.style.top = Math.min(y, maxY) + 'px';
}

function hideTooltip() {
  clearTimeout(tooltipTimer);
  document.getElementById('tooltip').classList.remove('visible');
}

document.addEventListener('mousemove', (e) => {
  if (document.getElementById('tooltip').classList.contains('visible')) moveTooltip(e);
});

/* ═══════════════════════════════════════════
   10. RESUMEN / SUMMARY CARD
═══════════════════════════════════════════ */

function updateResumenCard() {
  const card = document.getElementById('resumenCard');
  const content = document.getElementById('resumenContent');
  if (!card || !content) return;

  const items = buildTreatmentList();
  if (items.length === 0) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';

  // Group by treatment
  const grouped = {};
  items.forEach(item => {
    const key = item.treatment;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  });

  let html = '<table class="resumen-table"><thead><tr><th>Tratamiento</th><th>Código OS</th><th>Piezas Afectadas</th><th>Caras</th></tr></thead><tbody>';

  Object.entries(grouped).forEach(([treatment, list]) => {
    const meta = TREATMENTS[treatment];
    const pieces = list.map(i => i.tooth).join(', ');
    const facesText = list.map(i => i.faces ? i.faces.join('+') : 'Completa').join(' | ');
    html += `<tr>
      <td><span style="display:inline-flex;align-items:center;gap:6px">
        <em style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${meta.color};flex-shrink:0"></em>
        <strong>${meta.label}</strong>
      </span></td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:0.78rem;color:#94a3b8">${meta.code || '—'}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:0.82rem">${pieces}</td>
      <td style="font-size:0.78rem;color:#94a3b8">${facesText}</td>
    </tr>`;
  });

  html += '</tbody></table>';
  content.innerHTML = html;
}

function buildTreatmentList() {
  const results = [];
  Object.entries(toothState).forEach(([toothId, state]) => {
    if (!state || Object.keys(state).length === 0) return;

    if (state.whole && state.whole !== 'sano') {
      results.push({ tooth: toothId, treatment: state.whole, faces: null });
    } else {
      const faceMap = {};
      ['O','M','D','V','L'].forEach(face => {
        if (state[face] && state[face] !== 'sano') {
          const t = state[face];
          if (!faceMap[t]) faceMap[t] = [];
          faceMap[t].push(face);
        }
      });
      Object.entries(faceMap).forEach(([treatment, faces]) => {
        results.push({ tooth: toothId, treatment, faces });
      });
    }
  });
  return results;
}

/* ═══════════════════════════════════════════
   11. EXPORT STATE
═══════════════════════════════════════════ */

function getOdontogramState() {
  return {
    dentition: currentDentition,
    state: JSON.parse(JSON.stringify(toothState)),
    treatments: buildTreatmentList(),
    timestamp: new Date().toISOString()
  };
}

function loadOdontogramState(savedState) {
  if (!savedState || !savedState.state) return;
  Object.assign(toothState, savedState.state);
  if (savedState.dentition) {
    currentDentition = savedState.dentition;
  }
  renderOdontogram();
}

function clearOdontogram() {
  Object.keys(toothState).forEach(k => delete toothState[k]);
  renderOdontogram();
}

/* ═══════════════════════════════════════════
   12. INITIALIZE
═══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Set today's date
  const dateInput = document.getElementById('pacienteFecha');
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
  }
  renderOdontogram();
});
