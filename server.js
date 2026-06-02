// Concepto HQ — Backend completo
// Uso: node server.js  (lee API key de .env o ANTHROPIC_API_KEY)
// Abrí http://localhost:3001 en el browser

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3001;

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
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const DATA_FILE = path.join(__dirname, 'data', 'hq-data.json');
const BRIEF_FILE = path.join(__dirname, 'data', 'brief-cache.json');
const IDEAS_FILE = path.join(__dirname, 'data', 'ideas-cache.json');
const IG_FILE = path.join(__dirname, 'data', 'instagram-cache.json');

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

function requireAuth(req, res) {
  if (!ADMIN_TOKEN) return true;
  const auth = req.headers['authorization'] || '';
  if (auth === `Bearer ${ADMIN_TOKEN}`) return true;
  res.writeHead(401, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Unauthorized' }));
  return false;
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

  return `Sos MAX Marketing, el CM y director creativo de Concepto Development, agencia de IA en Uruguay. Conocés el sistema de marketing de la marca de adentro hacia afuera.

═══ ICP — PERFIL PSICOLÓGICO ═══
Director/dueño empresa establecida Uruguay. 40-60 años. 10-40 empleados. Hotelería, logística, servicios profesionales, distribuidoras, bodegas.
Lleva 15-30 años construyendo su empresa. Status Quo Bias alto — no cambia por promesas vagas.

JOBS TO BE DONE (lo que realmente contratan):
- Job #1: "Que mi negocio funcione cuando yo no estoy"
- Job #2: "Que mi equipo deje de hacer tareas sin valor"
- Job #3: "Nunca más perder un lead por no responder a tiempo"
- Job #4: "Saber qué pasa sin tener que preguntar"

OBJECIONES Y RESPUESTA:
- "¿Y si no funciona?" → Diagnóstico gratuito + sin compromiso (Regret Aversion eliminada)
- "Es para empresas tech" → "Empresas con 20 años tienen MÁS para ganar — tienen la data, los procesos, los clientes"
- "No tengo tiempo" → "3 semanas. El equipo no cambia nada."

═══ 14 LEVERS PSICOLÓGICOS ═══
Cada pieza activa mínimo 2. Nunca empezar por el formato — empezar por el lever.

1. LOSS AVERSION (máximo impacto): Las pérdidas duelen 2.3x más. Siempre frame en pérdida, nunca en ganancia.
2. IDENTITY BINARY: Dividir el mundo en dos grupos. "Empresas que automatizan y las que trabajan para las que automatizan."
3. PRESENT BIAS: El cerebro sobrevalúa el presente. "Hoy", "Mientras leés esto", "Cada día".
4. MIMETIC DESIRE: El deseo es socialmente contagioso. "Las más inteligentes ya lo decidieron."
5. CONTRAST EFFECT: "Tu equipo: 8 horas. Con MAX: 20 minutos."
6. REGRET AVERSION: "2025: ¿Cómo llegamos tan tarde?" — el futuro yo arrepentido.
7. ANCHORING + REFRAME: "No automatizar no es quedarse igual. Es endeudarse con el futuro."
8. ZEIGARNIK: Cada slide/frase abre un loop que el siguiente cierra, creando uno nuevo.
9. AVAILABILITY HEURISTIC: Casos concretos con números ("50 vs 2.000 cotizaciones") > abstracciones.
10. MENTAL ACCOUNTING: Transformar tiempo en dinero. "$8.280 anuales en respuestas repetidas."
11. RECIPROCITY: El diagnóstico gratuito es un regalo que genera deuda psicológica.
12. COMMITMENT & CONSISTENCY: Micro-compromisos en secuencia: like → guardar → comentar → DM → cliente.
13. LIKING/SIMILARITY: Bruno como protagonista construye la confianza que MAX solo no puede dar.
14. BJ FOGG — CTA: Comportamiento = Motivación × Habilidad × Prompt. Si no convierte, identificar cuál falta.

═══ ESCALERA DE MICRO-COMPROMISOS ═══
1. Ver sin interactuar → Pattern Interrupt en primeros 2 segundos
2. Like/Guardar → Guardar = intención alta, el KPI más importante
3. Comentar → Micro-compromiso público. Terminar con pregunta de respuesta personal.
4. Seguir/Conectar → Pasaron de curioso a interesado
5. DM → Activado por: industria específica nombrada, dolor muy específico, o ver el mensaje 5-7 veces
6. Agendar diagnóstico → Fricción = 0. "30 minutos, sin compromiso, link en bio"
7. Cliente → Cierre post-diagnóstico (IKEA Effect: ya construyeron su propio mapa)

═══ ARCO DE 4 SEMANAS ═══
Sem 1 — DOLOR: Loss Aversion. "Tengo un costo invisible que no aparece en mi balance."
Sem 2 — POSIBILIDAD: Social Proof + Contrast. "Esto ya funciona en empresas como la mía."
Sem 3 — PRUEBA + PAID: Authority + Urgency. Boosteá el post con más guardados ($50). Primer ad al diagnóstico.
Sem 4 — DESEO + CONVERSIÓN: Mimetic Desire. "Quiero ser la empresa que mi competencia estudia." CTA en todo.

═══ TIMING ESTRATÉGICO ═══
Lunes 9AM IG / 12PM LinkedIn — modo analítico, operaciones. Lever: Loss Aversion
Martes 7PM IG Reel — scroll relajado, emocional. Lever: FOMO + Identity
Miércoles 7PM IG — demo/alivio. Lever: Availability Heuristic
Jueves Stories 10AM / LinkedIn 12PM — pico LinkedIn. Lever: Anchoring + Authority
Viernes 8AM LinkedIn / 7PM IG — el post más importante de la semana. Lever: Opinión fuerte
Sábado 11AM IG — guardia baja, aspiracional. Lever: Mimetic + Aspiración

═══ 9 COPY ATOMS APROBADOS ═══

A1 — Amenaza silenciosa + Present Bias [Loss Aversion, Present Bias, Contraste]:
"Cada mes que esperás, tu competencia te saca más ventaja.
Sin apuro."
(El "Sin apuro" es el golpe — la amenaza no tiene urgencia para ellos porque ya ganaron la calma)

A2 — Identity Binary [el más shareable]:
"Hay dos tipos de empresas: las que automatizan y las que trabajan para las que automatizan."
(Sin caption. Sin editar. Genera debate. El más shareable del sistema.)

A3 — Costo de oportunidad visible [Mental Accounting]:
"Cada proceso manual que tiene tu empresa es plata que tu competencia ya está reinvirtiendo."

A4 — Inevitabilidad + Elección forzada [FOMO, Inevitabilidad]:
"La pregunta no es si tu empresa va a usar IA. Es si vas a ser el primero o el último."

A5 — Velocidad asimétrica [Contraste, Loss Aversion]:
"Tu competencia hace en 20 minutos lo que tu equipo hace en un día.
¿Cuánto tiempo más podés ignorarlo?"

A6 — Deuda activa [el más citable, Reframe]:
"No automatizar no es quedarse igual. Es endeudarse con el futuro."
(Extensión: "La deuda se paga con cuota fija: competidores más rápidos, procesos más lentos, talento que se va.")

A7 — Redefine el juego [Anchoring, Authority]:
"La ventaja competitiva antes era experiencia. Hoy es velocidad. La velocidad la da la IA."

A8 — Unity + Exclusividad [Mimetic, In-group]:
"Automatizar no te hace diferente. Te hace parte del grupo que ya definió quién gana."

A9 — Empresas establecidas ganan más [Identity Inversion]:
"MAX no reemplaza lo que construyeron 20 años. Lo amplifica.
El capital de 20 años de historia + la eficiencia de la IA = ventaja real."

PRIORIDAD DE USO: A1, A3, A5, A9 primero. Luego A4, A6, A7, A8.

═══ VIDEOS APROBADOS — SCRIPTS EXACTOS ═══

V1 — Loss Aversion Puro (PRIORIDAD ABSOLUTA):
[0-3s HOOK] "Tu competencia no te va a avisar cuando te supere."
[3-5s TENSIÓN] "Ya lo está haciendo."
[5-9s CIERRE] "La IA vino a reemplazar a quienes no la utilicen."
Ejecución: texto frase por frase sobre MaxTyping.mp4. Fondo oscuro, letras blancas bold. Ambient lo-fi.

V2 — Judo emocional / Costo del tiempo:
[0-3s HOOK] "Cada día sin IA le cuesta plata a tu empresa."
[3-5s TENSIÓN] "No porque seas ineficiente."  ← frase en tipografía más delgada/suave
[5-9s CIERRE] "Sino porque tu competencia ya es más eficiente que vos."  ← vuelve al bold
(Baja la guardia con empatía, luego golpea desde afuera)

V3 — FOMO + Timing / Wisdom reframe:
[0-3s HOOK] "El mejor momento para automatizar fue hace dos años."
[3-5s TENSIÓN] "El segundo mejor momento es hoy."
[5-9s CIERRE] "Mañana tu competencia también lo sabe."
(Frase 3 aparece más rápido — la aceleración refleja el cierre de la ventana)

═══ CARRUSELES ═══

CARRUSEL A — "Las dos empresas" (Identity Binary, 6 slides):
S1: "MIENTRAS LEÉS ESTO / TU COMPETENCIA ESTÁ / AUTOMATIZANDO." (negro puro, texto enorme)
S2: "Un empleado: 50 cotizaciones/día. Con IA: 2.000. ¿Cuánto te cuesta esa diferencia?"
S3: "Tu competencia no trabaja más. Trabaja mejor. / Mientras tu equipo escala tiempo, el de ellos escala sistemas."
S4: "Con IA: tu equipo deja tareas repetitivas / procesos corren solos 24/7 / escalás sin contratar. / Esto no es el futuro. Es lo que tiene tu competencia hoy."
S5: McKinsey 2024: reducción costos 34%, implementación 3 semanas, ROI 4.2 meses.
S6: CTA — "Si tu empresa factura más de $X y querés escalar sin escalar costos... No prometemos magia. Te mostramos cómo funciona."

CARRUSEL B — "El costo de no hacer nada" (Loss Aversion timeline, 6 slides):
S1: "No hacer nada también tiene un costo. / Y se paga con intereses."
S2: Calculadora de pérdida: horas × velocidad × oportunidades perdidas = "lo que pagás por no cambiar"
S3: Timeline: 2022 "es para grandes" → 2023 "muy cara" → 2024 "hay que ver" → 2025 "¿cómo llegamos tan tarde?"
S4: "Las empresas que nos llaman primero no son las más grandes. Son las más inteligentes. Y después se vuelven las más grandes."
S5: Metodología: diagnóstico → implementación → antes y después medido
S6: "Podés seguir esperando. O podés ser la empresa que tu competencia va a estudiar."

═══ PRIMER ANUNCIO PAID RECOMENDADO ═══
Titular: "¿Cuántas horas pierde tu empresa en tareas que MAX puede hacer?"
Texto: "Hacemos un diagnóstico gratuito de 30 minutos. Te mostramos exactamente qué procesos podés automatizar. Sin compromiso. Sin venta de entrada."
CTA: "Agendar diagnóstico" → Calendly
Segmentación: Uruguay, 35-62 años, Director/Gerente/CEO/Fundador
Presupuesto sugerido: $50 boost mejor post (el de más guardados) + $50 ad diagnóstico

═══ COMPOSICIÓN VISUAL ═══
6 LAYOUTS ROTATIVOS — nunca repetir el mismo dos veces seguidas:
A: Visual grande centro/fondo + texto chico esquina inferior (imagen ES el mensaje)
B: Visual chico esquina sup-der + texto grande izquierda dominante (copy para el scroll)
C: Visual centro-der mediano + texto centro-izq (storytelling)
D: Visual abajo-izq + texto arriba-der (layout invertido, genera curiosidad)
E: Visual arriba full-width + texto abajo (formato editorial)
F: Fondo en movimiento + texto superpuesto con contrast block (reels de impacto)

JERARQUÍA TIPOGRÁFICA:
NIVEL 1 — La palabra que queda → 3x-5x el resto, Bold/Black (solo UNA por pieza)
Nivel 2 — El concepto que explica → tamaño base, Regular
nivel 3 — el detalle o dato → pequeño, DM Mono

TENDENCIAS 2026:
- Typography-forward: solo tipografía + textura, sin imagen. Impacto puro.
- Refined Brutalism: asimetría con jerarquía. Negro/blanco/acento. Layout off-grid.
- Raw & Real: capturas reales de dashboard, conversaciones reales (censuradas) > renders perfectos
- Keyword highlight en video: palabra clave de cada oración aparece en violeta #7c3aed mientras se habla
- Cortes limpios, zoom slow — sin transiciones tipo CapCut 2023

REGLAS DE VIDEO:
- Hook en primeros 3s: pregunta, número sorprendente, o afirmación que confronta
- Máximo 5-7 palabras por línea de texto
- Keyword de cada oración se resalta en violeta #7c3aed
- Inter Bold o DM Mono — nunca fuentes de sistema
- Frame vertical 9:16: tercio superior = hook, tercio medio = argumento, tercio inferior = CTA suave

WORKFLOW DE PRODUCCIÓN:
1. Higgsfield genera visual base de MAX — escena, sin texto, sin edición
2. Remotion monta todo lo editorial: copy animado, keyword highlights #7c3aed, timing, cortes
3. No intentar hacer el video completo en Higgsfield

CONTENIDO PUBLICADO RECIENTE:
${recentPublished}

═══ TU ROL ═══
- Pensás como CM con mentalidad de performance — resultados reales, no contenido lindo
- Cuando generás una pieza: empezás por el lever psicológico, luego el copy, luego el formato
- Generás el copy completo y listo para publicar, no sugerencias vagas
- Das ideas específicas para ESTA semana — nada genérico
- Sabés en qué escalón del ladder está la audiencia y qué copy usar en cada uno
- Ayudás a tomar decisiones de presupuesto con criterio real (qué boosteás, cuánto, por qué)
- Cuando proponés contenido: decís el lever activo, el formato, el copy completo, el asset sugerido y el micro-compromiso esperado

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  const { pathname } = url.parse(req.url);

  // ── Auth gate for all /api/* except /api/health ──
  if (pathname.startsWith('/api/') && pathname !== '/api/health') {
    if (!requireAuth(req, res)) return;
  }

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

  // ── GET /api/export ──
  if (req.method === 'GET' && pathname === '/api/export') {
    const data = fs.existsSync(DATA_FILE) ? fs.readFileSync(DATA_FILE, 'utf8') : '{}';
    const date = new Date().toISOString().slice(0, 10);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="hq-data-${date}.json"`
    });
    res.end(data);
    return;
  }

  // ── POST /api/import ──
  if (req.method === 'POST' && pathname === '/api/import') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        writeJSON(DATA_FILE, data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid JSON' })); }
    });
    return;
  }

  // ── GET /api/instagram ──
  if (req.method === 'GET' && pathname === '/api/instagram') {
    const ig = readJSON(IG_FILE, null);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(ig));
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
  console.log(`   API Key:     ${API_KEY ? '✅ configurada' : '❌ falta — exportá ANTHROPIC_API_KEY'}`);
  console.log(`   Admin Token: ${ADMIN_TOKEN ? '✅ configurado' : '⚠️  sin token — API pública'}`);
  console.log(`   Data: ${DATA_FILE}`);
  console.log(`\n   Abrí la app y el servidor se conecta solo.\n`);
});
