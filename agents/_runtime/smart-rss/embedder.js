'use strict';
const fs = require('fs');

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
const MAX_EMBED_CHARS = 1000;

let _pipelinePromise = null;

async function load(cacheDir) {
  if (_pipelinePromise) return _pipelinePromise;
  _pipelinePromise = (async () => {
    fs.mkdirSync(cacheDir, { recursive: true });
    const { pipeline, env } = await import('@xenova/transformers');
    env.cacheDir = cacheDir;
    env.allowLocalModels = true;
    env.allowRemoteModels = true;
    return pipeline('feature-extraction', MODEL_ID, { quantized: true });
  })();
  return _pipelinePromise;
}

async function embed(extractor, text) {
  const truncated = String(text || '').slice(0, MAX_EMBED_CHARS);
  if (!truncated) return null;
  const out = await extractor(truncated, { pooling: 'mean', normalize: true });
  return new Float32Array(out.data);
}

async function embedBatch(extractor, texts) {
  const results = [];
  for (const t of texts) {
    results.push(await embed(extractor, t));
  }
  return results;
}

module.exports = { load, embed, embedBatch, MODEL_ID };
