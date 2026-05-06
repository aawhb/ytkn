// Simple smoke test for an OpenAI-compatible local server (e.g., Ollama)
// Usage: node scripts/ollama-smoke.js [baseUrl] [model]

const fetch = globalThis.fetch || require('node-fetch');

async function run() {
  const baseUrl = process.argv[2] || 'http://localhost:11434/v1';
  const model = process.argv[3] || 'qwen3.5:4b';

  const url = baseUrl.replace(/\/\/$/, '') + '/chat/completions';
  console.log(`Testing ${url} with model=${model}`);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1, stream: false })
    });

    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Body:', text.substring(0, 200));

    if (res.ok) {
      console.log('Smoke test: SUCCESS');
      process.exit(0);
    } else {
      console.error('Smoke test: FAILED - non-OK response');
      process.exit(2);
    }
  } catch (err) {
    console.error('Smoke test: ERROR', err.message || err);
    process.exit(1);
  }
}

run();
