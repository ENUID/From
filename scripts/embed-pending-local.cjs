const fs = require('fs');
const path = require('path');
const { ConvexHttpClient } = require('convex/browser');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}

function parseArgs(argv) {
  const parsed = { merchantId: null, force: false, once: false, limit: 20 };
  for (const arg of argv) {
    if (arg === '--force') parsed.force = true;
    else if (arg === '--once') parsed.once = true;
    else if (arg.startsWith('--limit=')) parsed.limit = Number(arg.slice('--limit='.length)) || 20;
    else if (!arg.startsWith('--') && !parsed.merchantId) parsed.merchantId = arg;
  }
  return parsed;
}

async function ensureOllama(baseUrl, model) {
  const res = await fetch(`${baseUrl}/api/tags`);
  if (!res.ok) {
    throw new Error(`Ollama health ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const models = (data.models ?? []).map((item) => item.name);
  const modelBase = model.split(':')[0];
  if (!models.some((name) => name.startsWith(modelBase))) {
    throw new Error(`Model "${model}" is not installed in Ollama`);
  }
}

async function embedWithOllama(baseUrl, model, text) {
  const res = await fetch(`${baseUrl}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: text }),
  });
  if (!res.ok) {
    throw new Error(`Ollama embed ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return data.embeddings?.[0] ?? [];
}

function buildEmbeddingText(product) {
  return [
    product.title,
    product.description,
    product.vendor,
    product.product_type,
    (product.tags ?? []).join(' '),
  ].filter(Boolean).join(' ').trim();
}

async function main() {
  const rootDir = __dirname ? path.resolve(__dirname, '..') : process.cwd();
  loadEnvFile(path.join(rootDir, '.env'));
  loadEnvFile(path.join(rootDir, '.env.local'));
  loadEnvFile(path.join(rootDir, 'web', '.env.local'));

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  const embedModel = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';
  const { merchantId, force, once, limit } = parseArgs(process.argv.slice(2));

  if (!convexUrl) {
    throw new Error('Missing NEXT_PUBLIC_CONVEX_URL or CONVEX_URL');
  }

  await ensureOllama(ollamaUrl, embedModel);

  const convex = new ConvexHttpClient(convexUrl);
  await convex.mutation('embedHelpers:backfillEmbeddingMetadata', {});

  if (force) {
    await convex.mutation('embedHelpers:queueProductsForEmbedding', {
      merchantId,
      force: true,
    });
  }

  let embedded = 0;
  let failed = 0;
  let claimed = 0;
  let batches = 0;

  while (true) {
    const pending = await convex.mutation('embedHelpers:claimPendingProducts', {
      merchantId,
      limit,
    });

    if (!pending.length) break;
    batches += 1;
    claimed += pending.length;

    for (const product of pending) {
      const text = buildEmbeddingText(product);

      if (!text) {
        await convex.mutation('embedHelpers:markEmbeddingFailed', {
          id: product._id,
          error: 'Missing product text for embedding',
        });
        failed += 1;
        continue;
      }

      try {
        const vector = await embedWithOllama(ollamaUrl, embedModel, text);
        if (vector.length !== 768) {
          throw new Error(`Expected 768 dims, got ${vector.length}`);
        }
        await convex.mutation('embedHelpers:saveEmbedding', {
          id: product._id,
          embedding: vector,
          model: embedModel,
        });
        embedded += 1;
      } catch (error) {
        failed += 1;
        const message = error && error.message ? error.message : String(error);
        await convex.mutation('embedHelpers:markEmbeddingFailed', {
          id: product._id,
          error: message,
        });
        console.error(`Embed failed for "${product.title}": ${message}`);
      }
    }

    if (once) break;
  }

  const status = await convex.query('embedHelpers:getEmbedStatus', {});
  console.log(JSON.stringify({ embedded, failed, claimed, batches, merchantId, force, status }));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
