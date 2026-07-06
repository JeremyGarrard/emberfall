// Static file server + local-LLM proxy for villager dialogue. No dependencies.
//
//   GET  /api/llm         -> {available, kind, model}
//   POST /api/chat        -> body {messages:[{role,content}...]}
//                            streams NDJSON lines: {delta:"..."} ... {done:true}
//   POST /save/<name>.jpg -> saves base64 body into ./captures (debug helper)
//
// Auto-detects Ollama (11434) or any OpenAI-compatible server (LM Studio on 1234).
// Override the model with the LLM_MODEL env var.

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8123;
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
};

// ---------- local LLM detection ----------

let llmCache = { t: 0, v: null };

async function detectLLM() {
  if (Date.now() - llmCache.t < 10000) return llmCache.v;
  let v = null;
  try {
    const r = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(1500) });
    if (r.ok) {
      const j = await r.json();
      const models = (j.models || []).filter(m => !/embed/i.test(m.name));
      if (models.length) {
        models.sort((a, b) => a.size - b.size);
        v = { kind: 'ollama', model: process.env.LLM_MODEL || models[0].name };
      }
    }
  } catch {}
  if (!v) {
    try {
      const r = await fetch('http://127.0.0.1:1234/v1/models', { signal: AbortSignal.timeout(1500) });
      if (r.ok) {
        const j = await r.json();
        const first = j.data && j.data[0] && j.data[0].id;
        if (first) v = { kind: 'openai', base: 'http://127.0.0.1:1234/v1', model: process.env.LLM_MODEL || first };
      }
    } catch {}
  }
  llmCache = { t: Date.now(), v };
  return v;
}

// ---------- chat proxy (normalizes both backends to {delta} NDJSON) ----------

async function handleChat(req, res) {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', async () => {
    let messages;
    try { messages = JSON.parse(body).messages.map(m => ({ role: m.role, content: m.content })); }
    catch { res.writeHead(400); res.end('bad request'); return; }

    const llm = await detectLLM();
    if (!llm) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'no local LLM found (is Ollama running?)' }));
      return;
    }

    const abort = new AbortController();
    res.on('close', () => abort.abort());
    res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache' });

    try {
      let upstream, parseLine;
      if (llm.kind === 'ollama') {
        upstream = await fetch('http://127.0.0.1:11434/api/chat', {
          method: 'POST', signal: abort.signal,
          body: JSON.stringify({
            model: llm.model, messages, stream: true, keep_alive: '30m',
            options: { temperature: 0.9, num_predict: 160 },
          }),
        });
        parseLine = line => {
          const j = JSON.parse(line);
          return j.message && j.message.content;
        };
      } else {
        upstream = await fetch(llm.base + '/chat/completions', {
          method: 'POST', signal: abort.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: llm.model, messages, stream: true, temperature: 0.9, max_tokens: 160 }),
        });
        parseLine = line => {
          if (!line.startsWith('data:')) return null;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') return null;
          const j = JSON.parse(payload);
          return j.choices && j.choices[0].delta && j.choices[0].delta.content;
        };
      }

      const dec = new TextDecoder();
      let buf = '';
      for await (const chunk of upstream.body) {
        buf += dec.decode(chunk, { stream: true });
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 1);
          if (!line) continue;
          try {
            const delta = parseLine(line);
            if (delta) res.write(JSON.stringify({ delta }) + '\n');
          } catch {}
        }
      }
      res.write(JSON.stringify({ done: true }) + '\n');
    } catch (e) {
      if (!abort.signal.aborted) {
        try { res.write(JSON.stringify({ error: String(e.message || e) }) + '\n'); } catch {}
      }
    }
    res.end();
  });
}

// ---------- server ----------

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/chat') { handleChat(req, res); return; }

  if (req.method === 'GET' && req.url === '/api/llm') {
    detectLLM().then(llm => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(llm ? { available: true, ...llm } : { available: false }));
    });
    return;
  }

  if (req.method === 'POST' && req.url.startsWith('/save/')) {
    const name = path.basename(req.url.slice('/save/'.length)).replace(/[^\w.-]/g, '');
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const dir = path.join(__dirname, 'captures');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir);
      fs.writeFileSync(path.join(dir, name), Buffer.from(body, 'base64'));
      res.writeHead(200); res.end('saved');
    });
    return;
  }

  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const file = path.join(__dirname, urlPath);
  if (!file.startsWith(__dirname)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log(`Emberfall running at http://localhost:${PORT}`);
  detectLLM().then(llm => console.log(llm
    ? `LLM: ${llm.model} via ${llm.kind}`
    : 'LLM: none detected (villagers will be tongue-tied)'));
});
