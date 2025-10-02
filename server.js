import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;

// Keys
const NIM_API_KEY = process.env.NIM_API_KEY;
const PROXY_KEY = process.env.PROXY_KEY;

// Base for NVIDIA NIM API
const NIM_BASE = 'https://integrate.api.nvidia.com/v1';

// Require proxy key middleware
function requireProxyKey(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth || auth !== `Bearer ${PROXY_KEY}`) {
    return res.status(403).json({ error: 'missing_or_invalid_proxy_key' });
  }
  next();
}

// ✅ NEW: GET /v1/models
app.get('/v1/models', requireProxyKey, async (req, res) => {
  try {
    const upstream = `${NIM_BASE}/models`;
    const upstreamResp = await fetch(upstream, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${NIM_API_KEY}`,
      },
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
    console.error('Proxy error (models):', err);
    return res.status(500).json({ error: 'proxy_error', message: err.message });
  }
});

// Proxy POST requests to NIM
app.post(
  ['/v1/chat/completions', '/v1/completions', '/v1/embeddings'],
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

app.listen(PORT, () => {
  console.log(`NIM proxy server running on port ${PORT}`);
});