// Concepto HQ — Backend completo
// Uso: node server.js  (lee API key de .env o ANTHROPIC_API_KEY)
// Abrí http://localhost:3001 en el browser

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3001;

// Load .env file if it exists
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
      const [k, ...v] = line.trim().split('=');
      if (k && !k.startsWith('#') && v.length) process.env[k.trim()] = v.join('=').trim();
    });
  }
}
loadEnv();

const API_KEY = process.env.ANTHROPIC_API_KEY || '';
const DATA_FILE = path.join(__dirname, 'data', 'hq-data.json');
const BRIEF_FILE = path.join(__dirname, 'data', 'brief-cache.json');
const IDEAS_FILE = path.join(__dirname, 'data', 'ideas-cache.json');

// Ensure data dir exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

// ── DATA HELPERS ─────────────────────────────────────────
function readJSON(file, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ── SYSTEM PROMPTS ───────────────────────────────────────
function buildSocioPrompt(data) {
  const active = (data.clients || []).filter(c => c.status === 'active');
  const mrr = active.reduce((s, c) => s + (Number(c.mrr) || 0), 0);
  const pipelineTotal = (data.pipeline || []).reduce((s, p) => s + (Number(p.value) || 0), 0);
  const pendingTasks = (data.tasks || []).filter(t => !t.done).length;
  const urgentTasks = (data.tasks || []).filter(t => !t.done && t.priority === 'alta').length;

  const clientsList = active.length
    ? active.map(c => `  - ${c.name}: ${c.service || 'servicio IA'}, $${c.mrr || 0}/mes`).join('\n')
    : '  (Sin clientes activos todavía)';

  const pipelineList = (data.pipeline || []).length
    ? (data.pipeline || []).map(p => `  - ${p.name}: ${p.service || ''}, $${p.value || 0} (${p.stage || 'prospecto'})`).join('\n')
    : '  (Sin prospectos en pipeline)';

  const today = new Date().toLocaleDateString('es-UY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return `Sos MAX, el socio estratégico de Bruno Silveira, fundador de Concepto Development, agencia de IA en Uruguay. No sos un asistente — sos co-dueño del negocio.

ESTADO ACTUAL DE LA EMPRESA:
- MRR: $${mrr} USD
- Pipeline: $${pipelineTotal} USD
- Tareas pendientes: ${pendingTasks} (${urgentTasks} urgentes)
- Clientes activos: ${active.length}

CLIENTES:
${clientsList}

PIPELINE:
${pipelineList}

SOBRE CONCEPTO DEVELOPMENT:
- Agencia de IA en Uruguay, Bruno opera solo amplificado con IA
- Servicios: Agentes IA (MAX), webs y landings premium, chatbots entrenados, automatizaciones n8n, contenido con MAX
- ICP: directores/dueños de empresa establecida en Uruguay, 40-60 años. Sectores: hotelería, distribuidoras, barracas, bodegas, arquitectura, servicios profesionales
- Robot MAX es el personaje de marca — face de la empresa
- Clientes actuales conocidos: Hotel Oxford (landing + chatbot), Fernando Estilista (landing), MVD Trading (landing masterclass), Pintelux (propuesta chatbot - mes gratis acordado), Escuela Naval (PWA en producción), ShockBag (agente n8n activo con HAL cerrando ventas)

TU PERSONALIDAD Y FORMA DE OPERAR:
- Pensás como co-dueño. Mirás el negocio completo, no solo la pregunta de Bruno
- Siempre aportás más de lo que te piden: si Bruno pregunta cómo usar algo, le decís cómo usarlo Y qué hay mejor
- Decís que no cuando algo no tiene sentido estratégicamente — con argumento
- Das ideas proactivas aunque no te las pidan
- Cuando Bruno te dice qué quiere lograr, vos encontrás el mejor camino. Él no necesita explicarte el proceso detallado — vos lo armás
- Hacés chequeos de negocio: ¿hay riesgos?, ¿hay oportunidades que se están perdiendo?
- Pensás en el próximo cliente, el próximo mes, el próximo año
- Sos directo, sin vueltas, sin sobre-explicaciones, sin emojis excesivos
- Si necesitás contexto antes de responder bien, preguntás. No inventás

Fecha de hoy: ${today}`;
}

function buildMarketingPrompt(data) {
  const pieces = (data.mktPieces || []);
  const recentPublished = pieces.filter(p => (data.mktStatus || {})[p.id] === 'publicada').slice(-5)
    .map(p => `  - ${p.titulo} (${p.formato})`).join('\n') || '  (Sin piezas publicadas todavía)';

  const today = new Date().toLocaleDateString('es-UY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return `Sos MAX Marketing, el CM y estratega de marketing de Concepto Development, agencia de IA en Uruguay.

SOBRE LA MARCA:
- Agencia de IA con personaje robot MAX
- ICP: directores/dueños empresa Uruguay, 40-60 años, construyeron algo que funciona, desconfían de promesas vacías
- Tono: impacto (directo, provocador) o premium (sofisticado, confiable)
- Color: violeta #7c3aed / #a855f7
- Plataformas activas: Instagram, LinkedIn, Meta Ads

COPY ATOMS APROBADOS (referencia de voz de marca):
- "Hay dos tipos de empresas en Uruguay. Las que ya usan IA para atender clientes. Y las que todavía no saben que las están perdiendo."
- "¿Cuánto vale una hora de tu tiempo? Multiplicala por las horas que tu equipo pasa respondiendo las mismas preguntas. Todos los días."
- "Tu competidor más peligroso no es el que tiene más plata. Es el que ya automatizó lo que vos seguís haciendo a mano."
- "No es tecnología. Es tiempo. El tuyo, de vuelta."

VIDEOS APROBADOS (referencia de formato):
- V1: Loss Aversion Puro — PRIORIDAD ABSOLUTA, brillante
- V2: Costo del Tiempo — Judo emocional
- V3: FOMO + Timing — Wisdom reframe

WORKFLOW DE PRODUCCIÓN:
1. Higgsfield genera visual base — MAX en escena, sin texto
2. Remotion monta texto animado, keyword highlights violeta, timing
3. No intentar hacer video completo en Higgsfield — sin control de texto

CONTENIDO PUBLICADO RECIENTE:
${recentPublished}

TU ROL:
- Pensás como CM con mentalidad de performance — resultados reales, no solo contenido lindo
- Generás copy completo y listo para usar, no sugerencias vagas
- Das ideas específicas para ESTA semana — nada genérico
- Decís que sí a lo que funciona y que no con fundamento a lo que no
- Ayudás a tomar decisiones de presupuesto en Meta Ads con criterio real
- Analizás qué funcionó y sacás conclusiones accionables
- Conocés tendencias actuales: kinetic typography, texto en pantalla, typography-forward, raw & real
- Cuando proponés contenido: dás el hook, el copy completo y el formato

Fecha de hoy: ${today}`;
}

function buildGeneralPrompt(data) {
  const active = (data.clients || []).filter(c => c.status === 'active');
  const mrr = active.reduce((s, c) => s + (Number(c.mrr) || 0), 0);
  const today = new Date().toLocaleDateString('es-UY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  return `Sos MAX, el asistente de Concepto Development, agencia de IA en Uruguay fundada por Bruno Silveira.
MRR actual: $${mrr} USD. Clientes activos: ${active.length}.
Ayudás con estrategia, propuestas, scripts, copy, análisis de clientes y cualquier tema del negocio.
Sos directo, concreto, sin vueltas. Fecha: ${today}.`;
}

function getSystemPrompt(role, data) {
  if (role === 'socio') return buildSocioPrompt(data);
  if (role === 'marketing') return buildMarketingPrompt(data);
  return buildGeneralPrompt(data);
}

// ── IDEAS GENERATION ─────────────────────────────────────
function buildIdeasPrompt(data) {
  const active = (data.clients || []).filter(c => c.status === 'active');
  const mrr = active.reduce((s, c) => s + (Number(c.mrr) || 0), 0);
  const pending = (data.tasks || []).filter(t => !t.done);
  const pipelineCount = (data.pipeline || []).length;
  const clientList = active.map(c => c.name).join(', ') || 'ninguno aún';
  const pendingList = pending.slice(0, 5).map(t => t.text).join(', ') || 'ninguna';
  const today = new Date().toLocaleDateString('es-UY', { weekday: 'long', day: 'numeric', month: 'long' });

  return `Generá exactamente 5 ideas específicas y accionables para Concepto Development para hoy (${today}).

CONTEXTO REAL HOY:
- MRR: $${mrr} USD
- Clientes activos: ${clientList}
- Prospectos en pipeline: ${pipelineCount}
- Tareas pendientes relevantes: ${pendingList}
- La empresa opera con Bruno solo, amplificado con IA

REGLAS PARA LAS IDEAS:
- Específicas para ESTE negocio en ESTE momento — nada genérico
- Ejecutables hoy o esta semana
- Mix de tipos: marketing, cliente, crecimiento, operación, producto
- Priorizá lo que más impacto tiene ahora mismo

Respondé SOLO con un array JSON válido, sin texto adicional, sin markdown:
[{"tipo":"marketing","titulo":"...","descripcion":"...","accion":"...","impacto":"alto|medio"}]

Tipos válidos: marketing, cliente, crecimiento, operacion, producto`;
}

// ── BRIEF GENERATION ─────────────────────────────────────
function buildBriefPrompt(data) {
  const active = (data.clients || []).filter(c => c.status === 'active');
  const mrr = active.reduce((s, c) => s + (Number(c.mrr) || 0), 0);
  const urgent = (data.tasks || []).filter(t => !t.done && t.priority === 'alta');
  const pipeline = (data.pipeline || []);
  const today = new Date().toLocaleDateString('es-UY', { weekday: 'long', day: 'numeric', month: 'long' });

  return `Generá el brief del día para Bruno Silveira, fundador de Concepto Development.

ESTADO REAL HOY (${today}):
- MRR: $${mrr} USD | Clientes activos: ${active.length} | Pipeline: ${pipeline.length} prospectos
- Tareas urgentes: ${urgent.length > 0 ? urgent.map(t => t.text).join(', ') : 'ninguna'}
- Clientes: ${active.map(c => c.name).join(', ') || 'construyendo base'}

Escribí un brief de máximo 3 párrafos. Debe incluir:
1. El foco del día (qué es lo más importante hacer)
2. Una alerta o riesgo si existe (algo urgente, cliente sin atender, etc.)
3. Una oportunidad concreta de esta semana

Tono: directo, de socio a Bruno. Sin saludos. Sin emojis. Sin "te recomiendo". Hablar como co-dueño.`;
}

// ── CLAUDE API CALL (non-streaming, for brief/ideas) ─────
function callClaude(system, userMessage, callback) {
  if (!API_KEY) { callback(null, 'API_KEY no configurada'); return; }

  const payload = JSON.stringify({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system,
    messages: [{ role: 'user', content: userMessage }]
  });

  const req = https.request({
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01'
    }
  }, res => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        callback(parsed.content?.[0]?.text || '', null);
      } catch { callback(null, 'Parse error'); }
    });
  });
  req.on('error', e => callback(null, e.message));
  req.write(payload);
  req.end();
}

// ── HTTP SERVER ──────────────────────────────────────────
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  const { pathname } = url.parse(req.url);

  // ── GET /api/health ──
  if (req.method === 'GET' && pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, apiKey: !!API_KEY, time: Date.now() }));
    return;
  }

  // ── GET /api/data ──
  if (req.method === 'GET' && pathname === '/api/data') {
    const d = readJSON(DATA_FILE, null);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(d));
    return;
  }

  // ── POST /api/data ──
  if (req.method === 'POST' && pathname === '/api/data') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        writeJSON(DATA_FILE, data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch { res.writeHead(400); res.end(); }
    });
    return;
  }

  // ── GET /api/ideas ──
  if (req.method === 'GET' && pathname === '/api/ideas') {
    const cache = readJSON(IDEAS_FILE, null);
    const today = new Date().toDateString();
    if (cache && cache.date === today && cache.ideas) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(cache.ideas));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([]));
    }
    return;
  }

  // ── POST /api/ideas/generate ──
  if (req.method === 'POST' && pathname === '/api/ideas/generate') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const { data } = JSON.parse(body);
        const system = 'Sos un estratega de negocios especializado en agencias de IA. Generás ideas accionables en formato JSON estricto.';
        const userMsg = buildIdeasPrompt(data);

        callClaude(system, userMsg, (text, err) => {
          if (err || !text) {
            res.writeHead(500); res.end(JSON.stringify({ error: err })); return;
          }
          try {
            const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const ideas = JSON.parse(clean);
            writeJSON(IDEAS_FILE, { date: new Date().toDateString(), ideas });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(ideas));
          } catch {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify([]));
          }
        });
      } catch { res.writeHead(400); res.end(); }
    });
    return;
  }

  // ── POST /api/brief ──
  if (req.method === 'POST' && pathname === '/api/brief') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const { data } = JSON.parse(body);
        const cache = readJSON(BRIEF_FILE, null);
        const today = new Date().toDateString();

        if (cache && cache.date === today && cache.brief) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ brief: cache.brief }));
          return;
        }

        const system = 'Sos el socio estratégico de Bruno en Concepto Development. Escribís briefs directos y útiles, de co-dueño a co-dueño.';
        callClaude(system, buildBriefPrompt(data), (text, err) => {
          if (err || !text) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ brief: 'No se pudo generar el brief. Verificá que el servidor tiene la API key configurada.' }));
            return;
          }
          writeJSON(BRIEF_FILE, { date: today, brief: text });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ brief: text }));
        });
      } catch { res.writeHead(400); res.end(); }
    });
    return;
  }

  // ── POST /api/chat (streaming con roles) ──
  if (req.method === 'POST' && pathname === '/api/chat') {
    if (!API_KEY) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'API key no configurada' }));
      return;
    }

    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const { messages, role, data } = JSON.parse(body);
        const appData = data || readJSON(DATA_FILE, {});
        const system = getSystemPrompt(role || 'general', appData);

        const payload = JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          stream: true,
          system,
          messages
        });

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });

        const apiReq = https.request({
          hostname: 'api.anthropic.com',
          path: '/v1/messages',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY,
            'anthropic-version': '2023-06-01'
          }
        }, apiRes => {
          apiRes.on('data', chunk => res.write(chunk));
          apiRes.on('end', () => res.end());
        });
        apiReq.on('error', () => res.end());
        apiReq.write(payload);
        apiReq.end();
      } catch { res.writeHead(400); res.end(); }
    });
    return;
  }

  // ── Serve static files (index.html, icon.png, manifest.json) ──
  if (req.method === 'GET') {
    const MIME = { '.html':'text/html', '.json':'application/json', '.png':'image/png', '.js':'application/javascript', '.css':'text/css' };
    let filePath = pathname === '/' ? '/index.html' : pathname;
    const fullPath = path.join(__dirname, filePath);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      const ext = path.extname(fullPath);
      res.writeHead(200, {'Content-Type': MIME[ext] || 'application/octet-stream'});
      fs.createReadStream(fullPath).pipe(res);
      return;
    }
  }

  res.writeHead(404); res.end();
});

server.listen(PORT, () => {
  console.log(`\n✅ Concepto HQ corriendo en http://localhost:${PORT}`);
  console.log(`   API Key: ${API_KEY ? '✅ configurada' : '❌ falta — exportá ANTHROPIC_API_KEY'}`);
  console.log(`   Data: ${DATA_FILE}`);
  console.log(`\n   Abrí la app y el servidor se conecta solo.\n`);
});
