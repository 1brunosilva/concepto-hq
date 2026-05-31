// Concepto HQ — Proxy local para Claude API (streaming)
// Uso: ANTHROPIC_API_KEY=tu_key node server.js
// Luego en la app, configurá el proxy como: http://localhost:3001/chat

const http = require('http');
const https = require('https');

const PORT = 3001;
const API_KEY = process.env.ANTHROPIC_API_KEY || '';

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
  if (req.method !== 'POST') { res.writeHead(404); res.end(); return; }

  let body = '';
  req.on('data', d => body += d);
  req.on('end', () => {
    try {
      const { system, messages } = JSON.parse(body);
      const payload = JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        stream: true,
        system,
        messages
      });

      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01'
        }
      };

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });

      const apiReq = https.request(options, apiRes => {
        apiRes.on('data', chunk => res.write(chunk));
        apiRes.on('end', () => res.end());
      });
      apiReq.on('error', () => res.end());
      apiReq.write(payload);
      apiReq.end();
    } catch { res.writeHead(400); res.end(); }
  });
});

server.listen(PORT, () => {
  console.log(`✅ Concepto HQ Proxy corriendo en http://localhost:${PORT}/chat`);
  console.log(`   API Key: ${API_KEY ? '✅ configurada' : '❌ no configurada — exportá ANTHROPIC_API_KEY'}`);
});
