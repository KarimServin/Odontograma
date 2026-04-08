/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  ODONTOGRAMA EMBEBIBLE — OdontoChart Widget                 ║
 * ║  Componente standalone para integrar en cualquier portal    ║
 * ║                                                              ║
 * ║  INTEGRACIÓN (3 pasos):                                     ║
 * ║    1. Agregar en <head>:                                     ║
 * ║       <link rel="stylesheet" href="odontograma-embed.css"/> ║
 * ║    2. Agregar donde se quiera el widget:                     ║
 * ║       <div id="odontograma-widget"></div>                    ║
 * ║    3. Agregar antes de </body>:                              ║
 * ║       <script src="odontograma-embed.js"></script>          ║
 * ║       <script>                                               ║
 * ║         const odontoWidget = new OdontoWidget({             ║
 * ║           container: '#odontograma-widget',                 ║
 * ║           onSave: (data) => console.log(data),              ║
 * ║         });                                                  ║
 * ║       </script>                                              ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * API Pública del widget:
 *   widget.getState()             → { dentition, state, treatments }
 *   widget.setState(savedState)   → Restaura un estado guardado
 *   widget.clear()                → Limpia el odontograma
 *   widget.getTreatmentList()     → Array de tratamientos marcados
 *   widget.setTool(toolName)      → Establece la herramienta activa
 *   widget.setDentition('permanente'|'temporario')
 */

'use strict';

(function (global) {

  /* ═══════════════════════════════════════
     CONSTANTS
  ═══════════════════════════════════════ */

  const PERMANENT = {
    topRight:   [18,17,16,15,14,13,12,11],
    topLeft:    [21,22,23,24,25,26,27,28],
    bottomLeft: [31,32,33,34,35,36,37,38],
    bottomRight:[48,47,46,45,44,43,42,41],
  };
  const TEMPORARY = {
    topRight:   [55,54,53,52,51],
    topLeft:    [61,62,63,64,65],
    bottomLeft: [71,72,73,74,75],
    bottomRight:[85,84,83,82,81],
  };

  const TREATMENTS = {
    caries:     { label:'Caries',       color:'#ef4444', code:'02.01',    whole:false },
    obturacion: { label:'Obturación',   color:'#3b82f6', code:'02.15',    whole:false },
    fractura:   { label:'Fractura',     color:'#f97316', code:'01.04',    whole:false },
    corona:     { label:'Corona',       color:'#eab308', code:'04.01.04', whole:true  },
    endodoncia: { label:'Endodoncia',   color:'#8b5cf6', code:'03.01',    whole:true  },
    resina:     { label:'Resina',       color:'#06b6d4', code:'02.16',    whole:false },
    extraccion: { label:'Extracción',   color:'#dc2626', code:'10.01',    whole:true  },
    ausente:    { label:'Ausente',      color:'#6b7280', code:'AUS',      whole:true  },
    implante:   { label:'Implante',     color:'#10b981', code:'11.01',    whole:true  },
    sano:       { label:'Borrar',       color:'transparent',code:'',      whole:false },
  };

  const TOOTH_NAMES = {
    11:'Inc.Central SD',12:'Inc.Lateral SD',13:'Canino SD',14:'1°Premolar SD',15:'2°Premolar SD',
    16:'1°Molar SD',17:'2°Molar SD',18:'3°Molar SD',
    21:'Inc.Central SI',22:'Inc.Lateral SI',23:'Canino SI',24:'1°Premolar SI',25:'2°Premolar SI',
    26:'1°Molar SI',27:'2°Molar SI',28:'3°Molar SI',
    31:'Inc.Central II',32:'Inc.Lateral II',33:'Canino II',34:'1°Premolar II',35:'2°Premolar II',
    36:'1°Molar II',37:'2°Molar II',38:'3°Molar II',
    41:'Inc.Central ID',42:'Inc.Lateral ID',43:'Canino ID',44:'1°Premolar ID',45:'2°Premolar ID',
    46:'1°Molar ID',47:'2°Molar ID',48:'3°Molar ID',
    51:'I.C. TD-SD',52:'I.L. TD-SD',53:'Can. TD-SD',54:'1°M. TD-SD',55:'2°M. TD-SD',
    61:'I.C. TD-SI',62:'I.L. TD-SI',63:'Can. TD-SI',64:'1°M. TD-SI',65:'2°M. TD-SI',
    71:'I.C. TD-II',72:'I.L. TD-II',73:'Can. TD-II',74:'1°M. TD-II',75:'2°M. TD-II',
    81:'I.C. TD-ID',82:'I.L. TD-ID',83:'Can. TD-ID',84:'1°M. TD-ID',85:'2°M. TD-ID',
  };

  const FACE_LABELS = { O:'Oclusal/Incisal', M:'Mesial', D:'Distal', V:'Vestibular', L:'Lingual/Palatino' };

  const SVG_NS = 'http://www.w3.org/2000/svg';

  /* ═══════════════════════════════════════
     WIDGET CLASS
  ═══════════════════════════════════════ */

  class OdontoWidget {

    constructor(options = {}) {
      this._options     = options;
      this._container   = typeof options.container === 'string'
        ? document.querySelector(options.container)
        : options.container;
      this._onSave      = options.onSave || null;
      this._onChange    = options.onChange || null;
      this._state       = {};   // toothId → { whole, O, M, D, V, L }
      this._tool        = options.defaultTool || 'caries';
      this._dentition   = options.dentition || 'permanente';
      this._uid         = 'ow_' + Math.random().toString(36).slice(2,7);

      if (!this._container) {
        console.error('[OdontoWidget] Contenedor no encontrado:', options.container);
        return;
      }

      this._render();
    }

    /* ── Public API ── */

    getState() {
      return {
        dentition: this._dentition,
        state: JSON.parse(JSON.stringify(this._state)),
        treatments: this._buildList(),
        timestamp: new Date().toISOString(),
      };
    }

    setState(saved) {
      if (!saved || !saved.state) return;
      this._state = JSON.parse(JSON.stringify(saved.state));
      if (saved.dentition) this._dentition = saved.dentition;
      this._renderArches();
      this._updateSummary();
    }

    clear() {
      this._state = {};
      this._renderArches();
      this._updateSummary();
    }

    getTreatmentList() { return this._buildList(); }

    setTool(name) {
      if (!TREATMENTS[name]) return;
      this._tool = name;
      this._container.querySelectorAll('.ow-tool-btn').forEach(b => {
        b.classList.toggle('ow-active', b.dataset.tool === name);
      });
    }

    setDentition(d) {
      this._dentition = d;
      this._renderArches();
      this._container.querySelectorAll('.ow-dent-btn').forEach(b => {
        b.classList.toggle('ow-active', b.dataset.dent === d);
      });
    }

    /* ── Internal rendering ── */

    _render() {
      this._container.classList.add('ow-root');

      const uid = this._uid;
      this._container.innerHTML = `
        <!-- Toolbar -->
        <div class="ow-toolbar">
          <div class="ow-tool-groups">
            ${this._renderToolGroups()}
          </div>
          <div class="ow-toolbar-right">
            <div class="ow-dent-toggle">
              <button class="ow-dent-btn ow-active" data-dent="permanente">Permanente (32)</button>
              <button class="ow-dent-btn" data-dent="temporario">Temporario (20)</button>
            </div>
            <button class="ow-clear-btn" title="Limpiar todo">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
              Limpiar
            </button>
          </div>
        </div>

        <!-- Odontogram -->
        <div class="ow-chart">
          <div class="ow-arch-header">
            <span>Superior Derecho</span>
            <span class="ow-midline">── Línea Media ──</span>
            <span>Superior Izquierdo</span>
          </div>
          <div class="ow-fdi-row" id="${uid}-fdi-top"></div>
          <div class="ow-arch" id="${uid}-arch-top"></div>
          <div class="ow-separator">─── Línea Intermaxilar ───</div>
          <div class="ow-arch" id="${uid}-arch-bottom"></div>
          <div class="ow-fdi-row" id="${uid}-fdi-bottom"></div>
          <div class="ow-arch-header">
            <span>Inferior Derecho</span>
            <span></span>
            <span>Inferior Izquierdo</span>
          </div>
        </div>

        <!-- Legend -->
        <div class="ow-legend">
          ${Object.entries(TREATMENTS).filter(([k])=>k!=='sano').map(([k,v])=>`
            <span class="ow-legend-item">
              <em style="background:${v.color}"></em>${v.label}
            </span>`).join('')}
        </div>

        <!-- Summary -->
        <div class="ow-summary" id="${uid}-summary" style="display:none">
          <div class="ow-summary-title">Tratamientos Marcados</div>
          <div id="${uid}-summary-body"></div>
        </div>

        <!-- Tooltip -->
        <div class="ow-tooltip" id="${uid}-tooltip"></div>
      `;

      // Bind toolbar
      this._container.querySelectorAll('.ow-tool-btn').forEach(btn => {
        btn.addEventListener('click', () => this.setTool(btn.dataset.tool));
      });
      this._container.querySelectorAll('.ow-dent-btn').forEach(btn => {
        btn.addEventListener('click', () => this.setDentition(btn.dataset.dent));
      });
      this._container.querySelector('.ow-clear-btn').addEventListener('click', () => {
        if (confirm('¿Limpiar todo el odontograma?')) this.clear();
      });

      this._renderArches();
    }

    _renderToolGroups() {
      const groups = [
        { label:'Diagnóstico', tools:['caries','obturacion','fractura'] },
        { label:'Operatoria', tools:['resina','corona','endodoncia'] },
        { label:'Cirugía / Estado', tools:['extraccion','ausente','implante','sano'] },
      ];
      return groups.map(g => `
        <div class="ow-tool-group">
          <span class="ow-group-label">${g.label}</span>
          <div class="ow-tools-row">
            ${g.tools.map(t => {
              const meta = TREATMENTS[t];
              return `<button class="ow-tool-btn${t===this._tool?' ow-active':''}" data-tool="${t}" title="${meta.label}">
                <em style="background:${meta.color||'#1e3a5f'};border:1px solid rgba(255,255,255,0.15)"></em>
                ${meta.label}
              </button>`;
            }).join('')}
          </div>
        </div>`).join('');
    }

    _renderArches() {
      const teeth = this._dentition === 'temporario' ? TEMPORARY : PERMANENT;
      const topArr    = [...teeth.topRight, ...teeth.topLeft];
      const bottomArr = [...teeth.bottomLeft, ...teeth.bottomRight];
      const uid = this._uid;

      this._buildArch(document.getElementById(`${uid}-arch-top`), topArr);
      this._buildArch(document.getElementById(`${uid}-arch-bottom`), bottomArr);
      this._buildFdiRow(document.getElementById(`${uid}-fdi-top`), topArr);
      this._buildFdiRow(document.getElementById(`${uid}-fdi-bottom`), bottomArr);
    }

    _buildArch(container, arr) {
      if (!container) return;
      container.innerHTML = '';
      arr.forEach(id => {
        const wrapper = document.createElement('div');
        wrapper.className = 'ow-tooth-wrap';
        wrapper.id = `${this._uid}-tooth-${id}`;
        wrapper.appendChild(this._buildToothSVG(id));
        container.appendChild(wrapper);
      });
    }

    _buildFdiRow(container, arr) {
      if (!container) return;
      container.innerHTML = '';
      arr.forEach(n => {
        const s = document.createElement('span');
        s.className = 'ow-fdi-num';
        s.id = `${this._uid}-fdi-${n}`;
        s.textContent = n;
        container.appendChild(s);
      });
    }

    _buildToothSVG(toothId) {
      const state = this._state[toothId] || {};
      const whole = state.whole;
      const stroke = '#0f2540', sw = '1.2';

      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('viewBox', '0 0 52 52');
      svg.setAttribute('class', 'ow-tooth');
      svg.setAttribute('data-tooth', toothId);
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', `Diente ${toothId}: ${TOOTH_NAMES[toothId]||''}`);

      const self = this;

      const mkEl = (tag, attrs) => {
        const el = document.createElementNS(SVG_NS, tag);
        Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k, v));
        return el;
      };

      const bindClick = (el, face) => {
        el.style.cursor = 'pointer';
        el.addEventListener('click', (e) => { e.stopPropagation(); self._handleClick(toothId, face); });
        el.addEventListener('mouseenter', (e) => self._showTip(e, toothId, face));
        el.addEventListener('mouseleave', () => self._hideTip());
      };

      /* ── Ausente ── */
      if (whole === 'ausente') {
        const r = mkEl('rect',{x:4,y:4,width:44,height:44,rx:4,fill:'#374151',stroke,  'stroke-width':sw});
        bindClick(r, 'whole');
        svg.appendChild(r);
        svg.appendChild(mkEl('line',{x1:10,y1:10,x2:42,y2:42,stroke:'#9ca3af','stroke-width':'2.5','stroke-linecap':'round'}));
        svg.appendChild(mkEl('line',{x1:42,y1:10,x2:10,y2:42,stroke:'#9ca3af','stroke-width':'2.5','stroke-linecap':'round'}));
        return svg;
      }
      /* ── Extracción ── */
      if (whole === 'extraccion') {
        const r = mkEl('rect',{x:4,y:4,width:44,height:44,rx:4,fill:'#dc2626',stroke,'stroke-width':sw});
        bindClick(r, 'whole');
        svg.appendChild(r);
        svg.appendChild(mkEl('line',{x1:10,y1:10,x2:42,y2:42,stroke:'white','stroke-width':'2.5','stroke-linecap':'round',opacity:'0.7'}));
        svg.appendChild(mkEl('line',{x1:42,y1:10,x2:10,y2:42,stroke:'white','stroke-width':'2.5','stroke-linecap':'round',opacity:'0.7'}));
        const t=mkEl('text',{x:'26',y:'48','font-size':'6',fill:'rgba(255,255,255,0.7)','text-anchor':'middle','font-family':'Inter,sans-serif'});
        t.textContent='EXT'; svg.appendChild(t);
        return svg;
      }
      /* ── Implante ── */
      if (whole === 'implante') {
        const r = mkEl('rect',{x:4,y:4,width:44,height:44,rx:4,fill:'#10b981',stroke,'stroke-width':sw});
        bindClick(r, 'whole');
        svg.appendChild(r);
        svg.appendChild(mkEl('circle',{cx:'26',cy:'22',r:'8',fill:'white',opacity:'0.25'}));
        const t=mkEl('text',{x:'26',y:'43','font-size':'6',fill:'white','text-anchor':'middle','font-family':'Inter,sans-serif'});
        t.textContent='IMP'; svg.appendChild(t);
        return svg;
      }
      /* ── Corona ── */
      if (whole === 'corona') {
        const r = mkEl('rect',{x:2,y:2,width:48,height:48,rx:4,fill:'rgba(234,179,8,0.15)',stroke:'#eab308','stroke-width':'2.5'});
        bindClick(r, 'whole');
        svg.appendChild(r);
        // crown shape
        const crown = mkEl('path',{d:'M12,34 L12,20 L18,26 L26,12 L34,26 L40,20 L40,34 Z',fill:'#eab308',opacity:'0.5',stroke:'#eab308','stroke-width':'1','stroke-linejoin':'round'});
        svg.appendChild(crown);
        const t=mkEl('text',{x:'26',y:'47','font-size':'6',fill:'#eab308','text-anchor':'middle','font-family':'Inter,sans-serif','font-weight':'700'});
        t.textContent='COR'; svg.appendChild(t);
        return svg;
      }
      /* ── Endodoncia ── */
      if (whole === 'endodoncia') {
        const r = mkEl('rect',{x:4,y:4,width:44,height:44,rx:4,fill:'#1e3a5f',stroke,'stroke-width':sw});
        bindClick(r, 'whole');
        svg.appendChild(r);
        svg.appendChild(mkEl('line',{x1:'26',y1:'14',x2:'16',y2:'44',stroke:'#8b5cf6','stroke-width':'2.2','stroke-linecap':'round'}));
        svg.appendChild(mkEl('line',{x1:'26',y1:'14',x2:'26',y2:'44',stroke:'#8b5cf6','stroke-width':'2.2','stroke-linecap':'round'}));
        svg.appendChild(mkEl('line',{x1:'26',y1:'14',x2:'36',y2:'44',stroke:'#8b5cf6','stroke-width':'2.2','stroke-linecap':'round'}));
        svg.appendChild(mkEl('circle',{cx:'26',cy:'14',r:'4',fill:'#8b5cf6'}));
        return svg;
      }

      /* ── Standard 5-face ── */
      const fc = (face) => {
        if (state[face] && state[face] !== 'sano') return TREATMENTS[state[face]]?.color || '#1e3a5f';
        return '#1e3a5f';
      };

      const faces = [
        { face:'V', tag:'polygon', pts:'18,18 34,18 26,6' },
        { face:'L', tag:'polygon', pts:'18,34 34,34 26,46' },
        { face:'M', tag:'polygon', pts:'18,18 18,34 6,26' },
        { face:'D', tag:'polygon', pts:'34,18 34,34 46,26' },
        { face:'O', tag:'rect',    x:18, y:18, w:16, h:16 },
      ];

      faces.forEach(f => {
        let el;
        if (f.tag === 'polygon') {
          el = mkEl('polygon', { points:f.pts, fill:fc(f.face), stroke, 'stroke-width':sw, 'stroke-linejoin':'round' });
        } else {
          el = mkEl('rect', { x:f.x, y:f.y, width:f.w, height:f.h, fill:fc(f.face), stroke, 'stroke-width':sw });
        }
        bindClick(el, f.face);
        svg.appendChild(el);
      });

      // Border
      svg.appendChild(mkEl('rect',{x:1,y:1,width:50,height:50,rx:4,fill:'none',stroke:'#1a3456','stroke-width':'0.7',style:'pointer-events:none'}));

      return svg;
    }

    _handleClick(toothId, face) {
      const tool = this._tool;
      const meta = TREATMENTS[tool];
      if (!this._state[toothId]) this._state[toothId] = {};
      const s = this._state[toothId];

      if (tool === 'sano') {
        this._state[toothId] = {};
      } else if (meta.whole) {
        s.whole = (s.whole === tool) ? null : tool;
        if (!s.whole) delete s.whole;
      } else {
        if (s.whole) { return; } // blocked
        s[face] = (s[face] === tool) ? null : tool;
        if (!s[face]) delete s[face];
      }

      // Re-render this tooth
      const wrap = document.getElementById(`${this._uid}-tooth-${toothId}`);
      if (wrap) {
        const old = wrap.querySelector('.ow-tooth');
        if (old) old.remove();
        wrap.appendChild(this._buildToothSVG(toothId));
      }

      this._updateSummary();
      if (this._onChange) this._onChange(this.getState());

      // Flash FDI label
      const fdi = document.getElementById(`${this._uid}-fdi-${toothId}`);
      if (fdi) {
        fdi.classList.add('ow-fdi-active');
        setTimeout(() => fdi.classList.remove('ow-fdi-active'), 700);
      }
    }

    _buildList() {
      const results = [];
      Object.entries(this._state).forEach(([id, s]) => {
        if (!s || Object.keys(s).length === 0) return;
        if (s.whole && s.whole !== 'sano') {
          results.push({ tooth: +id, treatment: s.whole, faces: null });
        } else {
          const faceMap = {};
          ['O','M','D','V','L'].forEach(f => {
            if (s[f] && s[f] !== 'sano') {
              if (!faceMap[s[f]]) faceMap[s[f]] = [];
              faceMap[s[f]].push(f);
            }
          });
          Object.entries(faceMap).forEach(([t, flist]) => {
            results.push({ tooth: +id, treatment: t, faces: flist });
          });
        }
      });
      return results;
    }

    _updateSummary() {
      const uid = this._uid;
      const summary = document.getElementById(`${uid}-summary`);
      const body    = document.getElementById(`${uid}-summary-body`);
      if (!summary || !body) return;

      const list = this._buildList();
      if (list.length === 0) { summary.style.display = 'none'; return; }
      summary.style.display = 'block';

      const grouped = {};
      list.forEach(i => {
        if (!grouped[i.treatment]) grouped[i.treatment] = [];
        grouped[i.treatment].push(i);
      });

      body.innerHTML = `<table class="ow-summary-table">
        <thead><tr><th>Tratamiento</th><th>Código OS</th><th>Piezas</th><th>Caras</th></tr></thead>
        <tbody>
          ${Object.entries(grouped).map(([t,items]) => {
            const m = TREATMENTS[t] || {label:t,color:'#888',code:'—'};
            return `<tr>
              <td><em style="background:${m.color}"></em> <strong>${m.label}</strong></td>
              <td class="ow-mono">${m.code||'—'}</td>
              <td class="ow-mono">${items.map(i=>i.tooth).join(', ')}</td>
              <td class="ow-muted">${items.map(i=>i.faces?i.faces.join('+'):'Completa').join(' | ')}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
    }

    /* ── Tooltip ── */
    _showTip(e, toothId, face) {
      const tip = document.getElementById(`${this._uid}-tooltip`);
      if (!tip) return;
      const s = this._state[toothId] || {};
      const tr = s.whole || s[face] || null;
      const name = TOOTH_NAMES[toothId] || `Pieza ${toothId}`;
      const faceName = face === 'whole' ? 'Toda la pieza' : (FACE_LABELS[face] || face);
      const trName = tr ? (TREATMENTS[tr]?.label||tr) : 'Sano';
      const trColor = tr ? (TREATMENTS[tr]?.color||'#10b981') : '#10b981';
      const toolName = TREATMENTS[this._tool]?.label || this._tool;

      tip.innerHTML = `
        <strong>${name}</strong><br>
        Cara: ${faceName}<br>
        Estado: <span style="color:${trColor}">${trName}</span><br>
        <small>Herramienta: ${toolName}</small>
      `;
      tip.classList.add('ow-tip-visible');
      this._moveTip(e);
    }

    _moveTip(e) {
      const tip = document.getElementById(`${this._uid}-tooltip`);
      if (!tip || !tip.classList.contains('ow-tip-visible')) return;
      const rect = this._container.getBoundingClientRect();
      tip.style.left = (e.clientX - rect.left + 12) + 'px';
      tip.style.top  = (e.clientY - rect.top - 10) + 'px';
    }

    _hideTip() {
      const tip = document.getElementById(`${this._uid}-tooltip`);
      if (tip) tip.classList.remove('ow-tip-visible');
    }
  }

  /* Expose globally */
  global.OdontoWidget = OdontoWidget;
  /* Also expose TREATMENTS for external reference */
  global.OdontoTreatments = TREATMENTS;

})(window);
