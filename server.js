const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory store (reemplazable por base de datos)
const dataFile = path.join(__dirname, 'data', 'autorizaciones.json');

// Ensure data directory
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}
if (!fs.existsSync(dataFile)) {
  fs.writeFileSync(dataFile, JSON.stringify([], null, 2));
}

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
  } catch {
    return [];
  }
}

function saveData(data) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

// GET all autorizaciones
app.get('/api/autorizaciones', (req, res) => {
  res.json(loadData());
});

// GET one by ID
app.get('/api/autorizaciones/:id', (req, res) => {
  const data = loadData();
  const item = data.find(d => d.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'No encontrado' });
  res.json(item);
});

// POST new
app.post('/api/autorizaciones', (req, res) => {
  const data = loadData();
  const nueva = {
    id: Date.now().toString(),
    fechaCreacion: new Date().toISOString(),
    ...req.body
  };
  data.push(nueva);
  saveData(data);
  res.status(201).json(nueva);
});

// PUT update
app.put('/api/autorizaciones/:id', (req, res) => {
  const data = loadData();
  const idx = data.findIndex(d => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'No encontrado' });
  data[idx] = { ...data[idx], ...req.body, id: req.params.id, fechaModificacion: new Date().toISOString() };
  saveData(data);
  res.json(data[idx]);
});

// DELETE
app.delete('/api/autorizaciones/:id', (req, res) => {
  let data = loadData();
  const idx = data.findIndex(d => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'No encontrado' });
  data.splice(idx, 1);
  saveData(data);
  res.json({ success: true });
});

// Serve index for all routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n✅ Odontograma Web corriendo en: http://localhost:${PORT}\n`);
});
