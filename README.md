# OdontoChart — Odontograma Geométrico para Obras Sociales

Sistema de odontograma digital interactivo para odontólogos. Permite marcar tratamientos por cara dental (sistema FDI/ISO 3950) para generar solicitudes de autorización a obras sociales argentinas.

## 🦷 Demo en vivo
**[Ver en GitHub Pages →](https://karimservin.github.io/Odontograma/)**

## Características
- Odontograma geométrico SVG — 5 caras por diente (Mesial, Distal, Vestibular, Lingual, Oclusal)
- Sistema FDI/ISO 3950 — Dentición permanente (32 piezas) y temporaria (20 piezas)
- 9 tratamientos con códigos del nomenclador argentino de obras sociales
- Resumen automático de tratamientos con código OS
- Guardado local en el navegador (localStorage)
- Impresión / exportación
- Componente embebible en cualquier portal existente

## Integración en portal existente (3 pasos)
```html
<!-- 1. En el <head> -->
<link rel="stylesheet" href="odontograma-embed.css" />

<!-- 2. Donde va el componente -->
<div id="odontograma-widget"></div>

<!-- 3. Antes del </body> -->
<script src="odontograma-embed.js"></script>
<script>
  const widget = new OdontoWidget({
    container: '#odontograma-widget',
    onSave: (data) => console.log(data),
  });
</script>
```

## Tratamientos disponibles

| Tratamiento | Código OS | Tipo |
|---|---|---|
| Caries | 02.01 | Por cara |
| Obturación | 02.15 | Por cara |
| Fractura | 01.04 | Por cara |
| Resina | 02.16 | Por cara |
| Corona | 04.01.04 | Diente completo |
| Endodoncia | 03.01 | Diente completo |
| Extracción | 10.01 | Diente completo |
| Ausente | AUS | Diente completo |
| Implante | 11.01 | Diente completo |

## Servidor local (opcional)
```bash
npm install
node server.js
# Abre http://localhost:3000
```
