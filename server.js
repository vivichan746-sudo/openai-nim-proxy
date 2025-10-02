// server.js - OpenAI-compatible proxy -> NVIDIA NIM (Render-ready)
const express = require('express');
const fetch = require('node-fetch'); // ✅ Fix: explicitly import fetch for Node 18
const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3000;
const NIM_BASE = process.env.NIM_BASE || 'https://integrate.api.nvidia.com/v1';
const NIM_API_KEY = process.env.NIM_API_KEY;      // set on Render
const PROXY_KEY = process.env.PROXY_KEY || '';    // set on Render

if (!NIM_API_KEY) console.error('WARNING: NIM_API_KEY not set.');

function requireProxyKey(req, res, next) {
  if (!PROXY_KEY) return next();
  const auth = (req.header('authorization') || '').trim();
  if (auth === `Bearer ${PROXY_KEY}`) return next();
  return res.status(401).json({ error: 'Unauthorized (invalid proxy key)' });
}

// Simple health check
app.get('/', (req, res) => res.json({ ok: true, service: 'nim-openai-proxy' }));

// Proxy OpenAI-compatible endpoints
app.post(
  ['/v1/chat/completions', '/v1/completions', '/v1/models', '/v1/embeddings'],
  requireProxyKey,
  async (req, res) => {
    try {
      const upstream = `${NIM_BASE}${req.path}`;
      const upstreamResp = await fetch(upstream, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${NIM_API_KEY}`,
        },
        body: JSON.stringify(req.body),
      });

      const text = await upstreamResp.text();
      const contentType = upstreamResp.headers.get('content-type') || 'application/json';
      res.status(upstreamResp.status).set('content-type', contentType);

      try {
        return res.json(JSON.parse(text));
      } catch (e) {
        return res.send(text);
      }
    } catch (err) {
      console.error('Proxy error:', err);
      return res.status(500).json({ error: 'proxy_error', message: err.message });
    }
  }
);

app.listen(PORT, '0.0.0.0', () => console.log(`nim-openai-proxy listening on 0.0.0.0:${PORT}`));