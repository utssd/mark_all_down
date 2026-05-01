'use strict';

const crypto = require('crypto');
const path = require('path');
const { createClient: createWebdavClient } = require('../../vendors/webdav');
const fetch = globalThis.fetch;

let _mammoth;
let _pdfParse;
let _xlsx;
let _jszip;

function getMammoth() {
  if (!_mammoth) _mammoth = require('mammoth');
  return _mammoth;
}

function getPdfParse() {
  if (!_pdfParse) _pdfParse = require('pdf-parse');
  return _pdfParse;
}

function getXlsx() {
  if (!_xlsx) _xlsx = require('xlsx');
  return _xlsx;
}

function getJsZip() {
  if (!_jszip) _jszip = require('jszip');
  return _jszip;
}

const TEXT_EXTENSIONS = new Set([
  '.md',
  '.markdown',
  '.txt',
  '.text',
  '.json',
  '.jsonl',
  '.yaml',
  '.yml',
  '.toml',
  '.ini',
  '.cfg',
  '.csv',
  '.tsv',
  '.html',
  '.htm',
  '.xml',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.py',
  '.rb',
  '.go',
  '.rs',
  '.java',
  '.c',
  '.cc',
  '.cpp',
  '.h',
  '.hpp',
  '.sh',
  '.bash',
  '.zsh',
  '.sql',
  '.css',
  '.scss',
  '.less',
  '.svg',
]);

const IMAGE_MIME_BY_EXTENSION = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.jpe': 'image/jpeg',
  '.jfif': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const SPREADSHEET_EXTENSIONS = new Set(['.xlsx', '.xls', '.xlsm', '.ods', '.csv', '.tsv']);
const DOCUMENT_EXTENSIONS = new Set(['.pdf', '.docx', '.odt']);
const PRESENTATION_EXTENSIONS = new Set(['.pptx']);
const MAX_VISION_BYTES = 6 * 1024 * 1024;

const MINDMAP_ANALYSIS_SYSTEM_PROMPT = [
  "You are MarkAllDown's MindMap analysis agent.",
  'Analyze one file at a time for a navigable knowledge index.',
  'Ground every summary, topic, entity, and relationship in the provided content or image evidence.',
  'Prefer precise, reusable labels and stable structure-friendly output.',
  'Return only the JSON shape requested by the user message.',
].join(' ');

const MINDMAP_ORGANIZER_SYSTEM_PROMPT = [
  "You are MarkAllDown's MindMap personal-growth companion.",
  'Your job is to help the user see themselves clearly through their own materials — what they are focused on, what they might be overlooking, and how their ideas connect in ways they may not have noticed.',
  'Write in a warm, direct second-person voice ("You\'ve been…", "You might consider…").',
  'Identify focus areas by file count, depth of content, and recency.',
  'Spot blind spots: topics referenced but unexplored, designs without implementation notes, seeds that haven\'t sprouted.',
  'Surface non-obvious connections between files or topics.',
  'Suggest external readings (articles, papers, tools, repos) from your knowledge that the user would find valuable given their demonstrated interests.',
  'After the personal insights, organize files into topic groups.',
  'Return only the JSON shape requested by the user message.',
].join(' ');

function throwIfAborted(signal) {
  if (signal?.aborted) {
    const err = new Error('MindMap run cancelled.');
    err.name = 'AbortError';
    throw err;
  }
}

function normalizeRemotePath(remotePath, fallback = '/') {
  let value = String(remotePath || fallback || '/')
    .trim()
    .replace(/\\/g, '/');
  if (!value) value = fallback || '/';
  if (!value.startsWith('/')) value = `/${value}`;
  value = path.posix.normalize(value);
  if (!value.startsWith('/')) value = `/${value}`;
  return value === '/' ? '/' : value.replace(/\/+$/, '');
}

function joinRemotePath(...parts) {
  return normalizeRemotePath(path.posix.join(...parts.filter(Boolean)));
}

function ensureRemoteDirectoryPath(remotePath) {
  return normalizeRemotePath(remotePath || '/');
}

function isPathWithin(rootPath, targetPath) {
  const normalizedRoot = ensureRemoteDirectoryPath(rootPath);
  const normalizedTarget = normalizeRemotePath(targetPath);
  return (
    normalizedTarget === normalizedRoot ||
    normalizedTarget.startsWith(`${normalizedRoot === '/' ? '' : normalizedRoot}/`)
  );
}

function relativeRemoteLink(fromFilePath, toFilePath) {
  const fromDir = path.posix.dirname(normalizeRemotePath(fromFilePath));
  const relative = path.posix.relative(fromDir, normalizeRemotePath(toFilePath));
  return relative || '.';
}

function sha1(value) {
  return crypto.createHash('sha1').update(value).digest('hex');
}

function decodeXmlEntities(text) {
  return String(text || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(raw) {
  return decodeXmlEntities(String(raw || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function cleanExtractedText(raw) {
  return String(raw || '')
    .replace(/\u0000/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function metadataFingerprint(entry) {
  const payload = JSON.stringify({
    path: normalizeRemotePath(entry.path),
    size: entry.size || 0,
    etag: entry.etag || '',
    lastmod: entry.lastmod || '',
    mime: entry.mime || '',
  });
  return sha1(payload);
}

function getFileExtension(remotePath) {
  return path.posix.extname(normalizeRemotePath(remotePath)).toLowerCase();
}

function getFileName(remotePath) {
  return path.posix.basename(normalizeRemotePath(remotePath));
}

function clampArray(values, maxCount = 8) {
  return [...new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean))].slice(
    0,
    maxCount
  );
}

function defaultAnalysisForUnsupported(file, reason) {
  return {
    title: getFileName(file.path),
    summary: reason,
    topics: [],
    entities: [],
    keywords: [],
    suggestedSection: 'Other Files',
    relationships: [],
    confidence: 'low',
    important: false,
  };
}

function getMindmapConfig(settings = {}) {
  const scanRoot = normalizeRemotePath(settings?.mindmap?.scanRoot || settings?.webdav?.pagesRoot || '/');
  const outputDir = normalizeRemotePath(settings?.mindmap?.outputDir || joinRemotePath(scanRoot, 'mindmap'));
  if (!isPathWithin(scanRoot, outputDir)) {
    throw new Error('MindMap output folder must stay inside the configured scan root.');
  }

  const stateFilePath = normalizeRemotePath(
    settings?.mindmap?.stateFilePath || joinRemotePath(outputDir, 'mindmap-state.json')
  );
  if (!isPathWithin(outputDir, stateFilePath)) {
    throw new Error('MindMap state file must stay inside the output folder.');
  }

  const maxFileBytes = Number(settings?.mindmap?.maxFileBytes);
  const parallelInference = Number(settings?.mindmap?.parallelInference);
  const maxContextChars = Number(settings?.mindmap?.maxContextChars);
  const restructureThreshold = Number(settings?.mindmap?.restructureThreshold);

  const excludedDirs = [outputDir];
  const rssDir = normalizeRemotePath(settings?.rss?.outputDir || '/rss');
  if (rssDir && isPathWithin(scanRoot, rssDir) && !excludedDirs.some((dir) => dir === rssDir)) {
    excludedDirs.push(rssDir);
  }

  return {
    scanRoot,
    outputDir,
    excludedDirs,
    stateFilePath,
    indexPath: joinRemotePath(outputDir, 'index.md'),
    maxFileBytes: Number.isFinite(maxFileBytes) && maxFileBytes > 0 ? maxFileBytes : 25 * 1024 * 1024,
    parallelInference:
      Number.isFinite(parallelInference) && parallelInference > 0 ? Math.max(1, Math.floor(parallelInference)) : 6,
    maxContextChars:
      Number.isFinite(maxContextChars) && maxContextChars > 0 ? Math.max(2000, Math.floor(maxContextChars)) : 120000,
    restructureThreshold:
      Number.isFinite(restructureThreshold) && restructureThreshold >= 0 && restructureThreshold <= 1
        ? restructureThreshold
        : 0.35,
  };
}

function createClient(settings) {
  const { url, username, password } = settings.webdav || {};
  if (!url) throw new Error('WebDAV is not configured.');
  return createWebdavClient(url, username ? { username, password: password || '' } : {});
}

async function ensureRemoteDirectory(client, remoteDir) {
  const normalizedDir = ensureRemoteDirectoryPath(remoteDir);
  if (normalizedDir === '/') return;
  await client.createDirectory(normalizedDir, { recursive: true });
}

async function readRemoteText(client, remotePath) {
  return client.getFileContents(normalizeRemotePath(remotePath), { format: 'text' });
}

async function readRemoteBinary(client, remotePath) {
  const buf = await client.getFileContents(normalizeRemotePath(remotePath), { format: 'binary' });
  return Buffer.from(buf);
}

async function loadPreviousState(client, stateFilePath) {
  try {
    const raw = await readRemoteText(client, stateFilePath);
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : { files: {} };
  } catch {
    return { files: {} };
  }
}

function guessMimeFromPath(remotePath, mime) {
  const normalizedMime = String(mime || '')
    .toLowerCase()
    .split(';')[0]
    .trim();
  if (normalizedMime) return normalizedMime;
  return IMAGE_MIME_BY_EXTENSION[getFileExtension(remotePath)] || '';
}

function shouldIndexFile(remotePath, mime) {
  const ext = getFileExtension(remotePath);
  const normalizedMime = guessMimeFromPath(remotePath, mime);
  return (
    TEXT_EXTENSIONS.has(ext) ||
    SPREADSHEET_EXTENSIONS.has(ext) ||
    DOCUMENT_EXTENSIONS.has(ext) ||
    PRESENTATION_EXTENSIONS.has(ext) ||
    Boolean(IMAGE_MIME_BY_EXTENSION[ext]) ||
    normalizedMime.startsWith('image/')
  );
}

async function listRemoteFiles(client, scanRoot, config, signal, sendProgress) {
  const queue = [ensureRemoteDirectoryPath(scanRoot)];
  const files = [];
  let processedDirs = 0;

  while (queue.length > 0) {
    throwIfAborted(signal);
    const currentDir = queue.shift();
    const items = await client.getDirectoryContents(currentDir);
    processedDirs += 1;
    if (processedDirs % 10 === 0) {
      sendProgress(`Scanned ${processedDirs} folder(s) so far…`);
    }

    for (const item of items || []) {
      throwIfAborted(signal);
      const remotePath = normalizeRemotePath(item.filename || item.href || item.path || item.basename || '/');
      if (!isPathWithin(config.scanRoot, remotePath)) continue;
      if (config.excludedDirs.some((dir) => isPathWithin(dir, remotePath))) continue;

      if (item.type === 'directory') {
        queue.push(remotePath);
        continue;
      }

      if (!shouldIndexFile(remotePath, item.mime)) continue;
      files.push({
        path: remotePath,
        name: getFileName(remotePath),
        size: Number(item.size) || 0,
        mime: guessMimeFromPath(remotePath, item.mime),
        lastmod: item.lastmod || '',
        etag: item.etag || '',
        fingerprint: metadataFingerprint({
          path: remotePath,
          size: Number(item.size) || 0,
          mime: guessMimeFromPath(remotePath, item.mime),
          lastmod: item.lastmod || '',
          etag: item.etag || '',
        }),
      });
    }
  }

  return files.sort((a, b) => a.path.localeCompare(b.path));
}

async function extractSpreadsheetText(buffer) {
  const XLSX = getXlsx();
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  return cleanExtractedText(
    workbook.SheetNames.map((sheetName) => {
      const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
      return `# Sheet: ${sheetName}\n${csv}`.trim();
    }).join('\n\n')
  );
}

async function extractPptxText(buffer) {
  const JSZip = getJsZip();
  const zip = await JSZip.loadAsync(buffer);
  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const slides = [];
  for (const slideName of slideNames) {
    const xml = await zip.files[slideName].async('string');
    const text = cleanExtractedText(
      decodeXmlEntities(
        [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
          .map((match) => match[1])
          .join('\n')
      )
    );
    if (text) slides.push(`# ${path.posix.basename(slideName)}\n${text}`);
  }
  return slides.join('\n\n');
}

async function extractDocText(file, buffer) {
  const ext = getFileExtension(file.path);
  if (ext === '.pdf') {
    const pdfParse = getPdfParse();
    const parsed = await pdfParse(buffer);
    return cleanExtractedText(parsed.text);
  }
  if (ext === '.docx' || ext === '.odt') {
    const mammoth = getMammoth();
    const result = await mammoth.extractRawText({ buffer });
    return cleanExtractedText(result.value);
  }
  return '';
}

async function extractContent(client, file, config) {
  const ext = getFileExtension(file.path);
  const mime = guessMimeFromPath(file.path, file.mime);
  if (file.size > config.maxFileBytes) {
    return {
      kind: 'metadata',
      note: `Skipped full extraction because the file exceeds the ${Math.round(config.maxFileBytes / (1024 * 1024))} MB limit.`,
    };
  }

  if (TEXT_EXTENSIONS.has(ext)) {
    const text = cleanExtractedText(await readRemoteText(client, file.path));
    return text
      ? { kind: ext === '.html' || ext === '.htm' ? 'document' : 'text', text: ext === '.html' || ext === '.htm' ? stripHtml(text) : text }
      : { kind: 'metadata', note: 'The file is empty.' };
  }

  if (SPREADSHEET_EXTENSIONS.has(ext)) {
    const buffer = await readRemoteBinary(client, file.path);
    if (ext === '.csv' || ext === '.tsv') {
      return { kind: 'spreadsheet', text: cleanExtractedText(buffer.toString('utf8')) };
    }
    return { kind: 'spreadsheet', text: await extractSpreadsheetText(buffer) };
  }

  if (DOCUMENT_EXTENSIONS.has(ext)) {
    const buffer = await readRemoteBinary(client, file.path);
    const text = await extractDocText(file, buffer);
    return text ? { kind: 'document', text } : { kind: 'metadata', note: 'Document text extraction produced no readable text.' };
  }

  if (PRESENTATION_EXTENSIONS.has(ext)) {
    const buffer = await readRemoteBinary(client, file.path);
    const text = cleanExtractedText(await extractPptxText(buffer));
    return text ? { kind: 'presentation', text } : { kind: 'metadata', note: 'Presentation text extraction produced no readable text.' };
  }

  if (IMAGE_MIME_BY_EXTENSION[ext] || mime.startsWith('image/')) {
    const buffer = await readRemoteBinary(client, file.path);
    if (buffer.length > MAX_VISION_BYTES) {
      return {
        kind: 'metadata',
        note: `Image skipped for vision because it exceeds the ${Math.round(MAX_VISION_BYTES / (1024 * 1024))} MB image limit.`,
      };
    }
    const imageMime = mime || IMAGE_MIME_BY_EXTENSION[ext] || 'image/png';
    return {
      kind: 'image',
      mime: imageMime,
      dataUrl: `data:${imageMime};base64,${buffer.toString('base64')}`,
    };
  }

  return {
    kind: 'metadata',
    note: 'Unsupported binary format. Added to the map using metadata only.',
  };
}

function shortenText(text, maxChars) {
  const cleaned = cleanExtractedText(text);
  if (cleaned.length <= maxChars) return { text: cleaned, truncated: false };
  return { text: `${cleaned.slice(0, maxChars)}\n\n[Truncated for model context]`, truncated: true };
}

function extractTextContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part?.type === 'text') return part.text || '';
        return '';
      })
      .join('\n')
      .trim();
  }
  return '';
}

function looksLikeAnthropicModel(model) {
  const value = String(model || '').toLowerCase();
  return value.includes('claude') || value.includes('anthropic/');
}

function buildSamplingParams({ provider, model, temperature, topP }) {
  const params = {};
  const useSingleSamplingControl = provider === 'anthropic' || looksLikeAnthropicModel(model);

  if (useSingleSamplingControl) {
    if (Number.isFinite(temperature)) {
      params.temperature = temperature;
    } else if (Number.isFinite(topP)) {
      params.top_p = topP;
    }
    return params;
  }

  if (Number.isFinite(temperature)) params.temperature = temperature;
  if (Number.isFinite(topP)) params.top_p = topP;
  return params;
}

function getModelMaxTokens(model) {
  const m = String(model || '').toLowerCase();
  if (m.includes('gemini')) return 65536;
  return 128000;
}

function clampMaxTokens(maxTokens, model) {
  const cap = getModelMaxTokens(model);
  const value = Number(maxTokens);
  if (!Number.isFinite(value) || value <= 0) return cap;
  return Math.min(cap, Math.max(1, Math.floor(value)));
}

async function callOpenAICompatible(llm, messages, signal, options = {}) {
  const base = String(llm.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const headers = { 'Content-Type': 'application/json' };
  if (llm.apiKey) headers.Authorization = `Bearer ${llm.apiKey}`;
  const systemPrompt = typeof options.systemPrompt === 'string' ? options.systemPrompt : '';

  const allMessages = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...messages.filter((msg) => msg.role !== 'system')]
    : messages;

  const body = {
    model: llm.model,
    messages: allMessages,
    max_tokens: clampMaxTokens(llm.maxTokens, llm.model),
    ...buildSamplingParams({
      provider: llm.provider || 'openai',
      model: llm.model,
      temperature: llm.temperature ?? 0.4,
      topP: llm.topP ?? 1.0,
    }),
  };

  const resp = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data.error?.message || `HTTP ${resp.status}`);
  }
  return extractTextContent(data.choices?.[0]?.message?.content || '');
}

function parseJsonResponse(raw, fallback) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return fallback;

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;

  try {
    return JSON.parse(candidate);
  } catch {}

  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch {}
  }
  return fallback;
}

function normalizeAnalysisResult(file, parsed, fallbackSummary) {
  const summary = String(parsed?.summary || fallbackSummary || '').trim();
  return {
    title: String(parsed?.title || getFileName(file.path)).trim() || getFileName(file.path),
    summary: summary || `Indexed ${getFileName(file.path)}.`,
    topics: clampArray(parsed?.topics, 8),
    entities: clampArray(parsed?.entities, 12),
    keywords: clampArray(parsed?.keywords, 12),
    suggestedSection: String(parsed?.suggestedSection || '').trim() || 'General',
    relationships: Array.isArray(parsed?.relationships)
      ? parsed.relationships
          .map((item) => ({
            target: String(item?.target || '').trim(),
            reason: String(item?.reason || '').trim(),
          }))
          .filter((item) => item.target && item.reason)
          .slice(0, 8)
      : [],
    confidence: ['low', 'medium', 'high'].includes(parsed?.confidence) ? parsed.confidence : 'medium',
    important: Boolean(parsed?.important),
  };
}

async function analyzeFileWithLLM(llm, file, extracted, previousEntry, instructions, config, signal) {
  if (extracted.kind === 'metadata') {
    return defaultAnalysisForUnsupported(file, extracted.note || 'Indexed using metadata only.');
  }

  const previousSummary = previousEntry?.analysis
    ? JSON.stringify(
        {
          title: previousEntry.analysis.title,
          summary: previousEntry.analysis.summary,
          topics: previousEntry.analysis.topics,
          entities: previousEntry.analysis.entities,
          suggestedSection: previousEntry.analysis.suggestedSection,
        },
        null,
        2
      )
    : 'None';

  let userContent = null;
  let promptText = '';

  if (extracted.kind === 'image') {
    promptText = [
      'You are analyzing one file for a MindMap index over a WebDAV knowledge store.',
      'Return JSON only with this schema:',
      '{"title":"","summary":"","topics":[],"entities":[],"keywords":[],"suggestedSection":"","relationships":[{"target":"","reason":""}],"confidence":"low|medium|high","important":true}',
      `File path: ${file.path}`,
      `File name: ${file.name}`,
      `File size bytes: ${file.size}`,
      instructions ? `User guidance: ${instructions}` : '',
      `Previous analysis: ${previousSummary}`,
      'Describe the image, identify useful concepts or entities, and suggest where it belongs in the index.',
    ]
      .filter(Boolean)
      .join('\n\n');
    userContent = [
      { type: 'text', text: promptText },
      { type: 'image_url', image_url: { url: extracted.dataUrl } },
    ];
  } else {
    const { text, truncated } = shortenText(extracted.text || '', config.maxContextChars);
    promptText = [
      'You are analyzing one file for a MindMap index over a WebDAV knowledge store.',
      'Return JSON only with this schema:',
      '{"title":"","summary":"","topics":[],"entities":[],"keywords":[],"suggestedSection":"","relationships":[{"target":"","reason":""}],"confidence":"low|medium|high","important":true}',
      `File path: ${file.path}`,
      `File name: ${file.name}`,
      `File kind: ${extracted.kind}`,
      `File size bytes: ${file.size}`,
      truncated ? `Note: the extracted content was truncated to ${config.maxContextChars} characters for context.` : '',
      instructions ? `User guidance: ${instructions}` : '',
      `Previous analysis: ${previousSummary}`,
      'Extract the most important meaning, topics, and entities from this file.',
      'File content:',
      text || '[No readable content]',
    ]
      .filter(Boolean)
      .join('\n\n');
    userContent = promptText;
  }

  const raw = await callOpenAICompatible(llm, [{ role: 'user', content: userContent }], signal, {
    systemPrompt: MINDMAP_ANALYSIS_SYSTEM_PROMPT,
  });
  const parsed = parseJsonResponse(raw, null);
  return normalizeAnalysisResult(file, parsed, raw);
}

function buildCorpusDigest(files) {
  return JSON.stringify(
    files.map((file) => ({
      path: file.path,
      title: file.analysis.title,
      summary: file.analysis.summary,
      topics: file.analysis.topics,
      entities: file.analysis.entities,
      suggestedSection: file.analysis.suggestedSection,
      important: file.analysis.important,
    })),
    null,
    2
  );
}

async function enrichWithRecommendations(llm, corpusDigest, instructions, signal) {
  try {
    const raw = await callOpenAICompatible(
      llm,
      [
        {
          role: 'user',
          content: [
            'You are a knowledgeable research companion.',
            'Based on the following corpus of a user\'s personal notes and materials, suggest 5-8 external resources (articles, papers, open-source tools, GitHub repos, blog posts) that would be genuinely valuable to this person.',
            'Focus on resources that:',
            '- Directly advance their current projects or interests',
            '- Offer perspectives or techniques they seem unaware of',
            '- Connect to themes that appear across multiple notes',
            'For each recommendation, provide a real, well-known resource — prefer canonical references (seminal papers, official docs, widely-cited posts) over obscure ones.',
            instructions ? `User guidance: ${instructions}` : '',
            'Return JSON only: {"recommendations":[{"title":"","url":"","reason":""}]}',
            'User\'s materials:',
            corpusDigest,
          ]
            .filter(Boolean)
            .join('\n\n'),
        },
      ],
      signal,
      { systemPrompt: 'You are a knowledgeable research companion. Return only the JSON shape requested.' }
    );
    const parsed = parseJsonResponse(raw, null);
    if (parsed && Array.isArray(parsed.recommendations)) {
      return parsed.recommendations
        .map((item) => ({
          title: String(item?.title || '').trim(),
          url: String(item?.url || '').trim(),
          reason: String(item?.reason || '').trim(),
        }))
        .filter((item) => item.title && item.reason)
        .slice(0, 8);
    }
    return [];
  } catch {
    return [];
  }
}

function localOrganizationFallback(files, stats) {
  const bySection = new Map();
  for (const file of files) {
    const section = file.analysis.suggestedSection || file.analysis.topics[0] || 'General';
    if (!bySection.has(section)) {
      bySection.set(section, {
        title: section,
        summary: `Files grouped under ${section}.`,
        itemPaths: [],
      });
    }
    bySection.get(section).itemPaths.push(file.path);
  }

  const topics = [...bySection.values()]
    .map((topic) => ({
      ...topic,
      itemPaths: topic.itemPaths.sort(),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

  return {
    title: 'Your Knowledge Map',
    greeting: `You have ${stats.totalFiles} files across ${topics.length} areas.`,
    recentFocus: { summary: '', items: [] },
    blindSpots: { summary: '', items: [] },
    connections: { summary: '', items: [] },
    recommendations: { summary: '', items: [] },
    overview: `Indexed ${stats.totalFiles} files and organized them into ${topics.length} topic group(s).`,
    changesSummary:
      stats.changedCount || stats.removedCount
        ? `Updated ${stats.changedCount} file(s), reused ${stats.reusedCount}, and removed ${stats.removedCount}.`
        : `Reused ${stats.reusedCount} existing file understanding(s) with no structural changes needed.`,
    topics,
  };
}

async function organizeMindMap(llm, files, previousState, stats, instructions, recommendations, signal) {
  const rebuildStructure = !previousState?.organization || stats.changeRatio >= stats.restructureThreshold;
  const previousOrganization = previousState?.organization
    ? JSON.stringify(previousState.organization, null, 2)
    : 'None';
  const raw = await callOpenAICompatible(
    llm,
    [
      {
        role: 'user',
        content: [
          'You are building a personal knowledge map for someone based on their files.',
          'Your goal is to help them see what they are focused on, what they might be overlooking, and how their ideas connect.',
          'Return JSON only with this schema:',
          '{"title":"","greeting":"","recentFocus":{"summary":"","items":[{"area":"","intensity":"high|medium|low","insight":""}]},"blindSpots":{"summary":"","items":[{"observation":"","suggestion":""}]},"connections":{"summary":"","items":[{"from":"","to":"","insight":""}]},"topics":[{"title":"","summary":"","orderedItems":[{"path":"","label":"","parentPath":""}]}]}',
          '',
          'Field guidance:',
          '- title: A short, personal title for the knowledge map.',
          '- greeting: A warm 1-2 sentence observation about what this collection of materials reveals about the person. Write as "you".',
          '- recentFocus: What areas they have been spending the most energy on. Judge by file count, content depth, and recency. intensity is high/medium/low.',
          '- blindSpots: Topics or next steps that seem missing. E.g., lots of design docs but no implementation logs, or references to something never explored further. Frame as gentle suggestions, not criticism.',
          '- connections: Non-obvious links between files or topics the person may not realize are related. "from" and "to" must be topic titles (not file paths).',
          '- topics: Group files into threads/streams of related work. Each topic is a thread the user is pursuing. Within each topic, order items in orderedItems by conceptual progression — foundational concepts first, then intermediate, then advanced or derivative work. label is a short display name. If an item is a branch/offshoot of another item in the same topic, set parentPath to that parent item\'s path; otherwise set parentPath to null or omit it.',
          '',
          `Rebuild structure: ${rebuildStructure ? 'yes' : 'no'}`,
          instructions ? `User guidance: ${instructions}` : '',
          `Previous organization: ${previousOrganization}`,
          '',
          'Here are the analyzed file summaries:',
          buildCorpusDigest(files),
        ]
          .filter(Boolean)
          .join('\n\n'),
      },
    ],
    signal,
    { systemPrompt: MINDMAP_ORGANIZER_SYSTEM_PROMPT }
  );

  const parsed = parseJsonResponse(raw, null);
  if (!parsed || !Array.isArray(parsed.topics)) {
    return localOrganizationFallback(files, stats);
  }

  const validPaths = new Set(files.map((file) => file.path));
  const topics = parsed.topics
    .map((topic) => {
      const title = String(topic?.title || '').trim();
      const summary = String(topic?.summary || '').trim();

      // Support new orderedItems format and legacy itemPaths
      let orderedItems = [];
      if (Array.isArray(topic?.orderedItems) && topic.orderedItems.length > 0) {
        orderedItems = topic.orderedItems
          .map((item) => ({
            path: normalizeRemotePath(String(item?.path || '')),
            label: String(item?.label || '').trim(),
            parentPath: item?.parentPath ? normalizeRemotePath(String(item.parentPath)) : null,
          }))
          .filter((item) => validPaths.has(item.path));
      } else if (Array.isArray(topic?.itemPaths)) {
        // Legacy format: convert flat list to orderedItems without parentPath
        orderedItems = topic.itemPaths
          .map((itemPath) => normalizeRemotePath(itemPath))
          .filter((itemPath) => validPaths.has(itemPath))
          .map((itemPath) => ({ path: itemPath, label: '', parentPath: null }));
      }

      // Backward compat: also expose itemPaths for renderMarkdownIndex
      const itemPaths = orderedItems.map((item) => item.path);

      return { title, summary, orderedItems, itemPaths };
    })
    .filter((topic) => topic.title && topic.orderedItems.length > 0);

  if (!topics.length) {
    return localOrganizationFallback(files, stats);
  }

  // Parse personal insight sections
  const recentFocus = {
    summary: String(parsed.recentFocus?.summary || '').trim(),
    items: Array.isArray(parsed.recentFocus?.items)
      ? parsed.recentFocus.items
          .map((item) => ({
            area: String(item?.area || '').trim(),
            intensity: ['high', 'medium', 'low'].includes(item?.intensity) ? item.intensity : 'medium',
            insight: String(item?.insight || '').trim(),
          }))
          .filter((item) => item.area && item.insight)
          .slice(0, 6)
      : [],
  };

  const blindSpots = {
    summary: String(parsed.blindSpots?.summary || '').trim(),
    items: Array.isArray(parsed.blindSpots?.items)
      ? parsed.blindSpots.items
          .map((item) => ({
            observation: String(item?.observation || '').trim(),
            suggestion: String(item?.suggestion || '').trim(),
          }))
          .filter((item) => item.observation)
          .slice(0, 6)
      : [],
  };

  const connections = {
    summary: String(parsed.connections?.summary || '').trim(),
    items: Array.isArray(parsed.connections?.items)
      ? parsed.connections.items
          .map((item) => ({
            from: String(item?.from || '').trim(),
            to: String(item?.to || '').trim(),
            insight: String(item?.insight || '').trim(),
          }))
          .filter((item) => item.from && item.to && item.insight)
          .slice(0, 6)
      : [],
  };

  return {
    title: String(parsed.title || 'Your Knowledge Map').trim() || 'Your Knowledge Map',
    greeting: String(parsed.greeting || '').trim(),
    recentFocus,
    blindSpots,
    connections,
    recommendations: {
      summary: recommendations.length
        ? 'Based on your interests, here are some resources you might find valuable.'
        : '',
      items: recommendations,
    },
    overview: String(parsed.overview || '').trim() || `Indexed ${files.length} file(s).`,
    changesSummary: String(parsed.changesSummary || '').trim(),
    topics,
  };
}

function summarizeRun(stats, organization) {
  const topicCount = Array.isArray(organization?.topics) ? organization.topics.length : 0;
  const focusCount = organization?.recentFocus?.items?.length || 0;
  const connectionCount = organization?.connections?.items?.length || 0;
  const parts = [`Reviewed ${stats.totalFiles} file(s) across ${topicCount} theme(s).`];
  if (focusCount) parts.push(`Identified ${focusCount} focus area(s).`);
  if (connectionCount) parts.push(`Found ${connectionCount} interesting connection(s).`);
  if (stats.changedCount) parts.push(`${stats.changedCount} updated since last run.`);
  return parts.join(' ');
}

function renderMarkdownIndex(indexPath, organization, filesByPath, stats) {
  const lines = [];
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Title and greeting
  lines.push(`# ${organization.title || 'Your Knowledge Map'}`);
  lines.push('');
  lines.push(`*Updated ${dateStr} — ${stats.totalFiles} files across your storage*`);
  lines.push('');
  if (organization.greeting) {
    lines.push(organization.greeting);
    lines.push('');
  }

  // Recent focus
  const focus = organization.recentFocus;
  if (focus?.items?.length) {
    lines.push('## What you\'ve been focused on lately');
    lines.push('');
    if (focus.summary) {
      lines.push(focus.summary);
      lines.push('');
    }
    for (const item of focus.items) {
      const badge = item.intensity === 'high' ? '***' : item.intensity === 'medium' ? '**' : '*';
      lines.push(`- ${badge}${item.area}${badge} — ${item.insight}`);
    }
    lines.push('');
  }

  // Blind spots
  const spots = organization.blindSpots;
  if (spots?.items?.length) {
    lines.push('## Have you considered...');
    lines.push('');
    if (spots.summary) {
      lines.push(spots.summary);
      lines.push('');
    }
    for (const item of spots.items) {
      const suggestion = item.suggestion ? ` *${item.suggestion}*` : '';
      lines.push(`- ${item.observation}${suggestion}`);
    }
    lines.push('');
  }

  // Connections
  const conns = organization.connections;
  if (conns?.items?.length) {
    lines.push('## Dots that connect');
    lines.push('');
    if (conns.summary) {
      lines.push(conns.summary);
      lines.push('');
    }
    for (const item of conns.items) {
      lines.push(`- **${item.from}** ↔ **${item.to}**: ${item.insight}`);
    }
    lines.push('');
  }

  // Recommendations
  const recs = organization.recommendations;
  if (recs?.items?.length) {
    lines.push('## Readings you might enjoy');
    lines.push('');
    if (recs.summary) {
      lines.push(recs.summary);
      lines.push('');
    }
    for (const item of recs.items) {
      if (item.url) {
        lines.push(`- [${item.title}](${item.url}) — ${item.reason}`);
      } else {
        lines.push(`- **${item.title}** — ${item.reason}`);
      }
    }
    lines.push('');
  }

  // Divider before topic sections
  if (focus?.items?.length || spots?.items?.length || conns?.items?.length || recs?.items?.length) {
    lines.push('---');
    lines.push('');
  }

  // Topic sections with file details
  for (const topic of organization.topics || []) {
    lines.push(`## ${topic.title}`);
    lines.push('');
    if (topic.summary) {
      lines.push(topic.summary);
      lines.push('');
    }

    for (const itemPath of topic.itemPaths || []) {
      const file = filesByPath.get(itemPath);
      if (!file) continue;
      const link = relativeRemoteLink(indexPath, file.path);
      const topicBits = clampArray(file.analysis.topics, 4);
      lines.push(`### [${file.analysis.title}](${link})`);
      lines.push('');
      lines.push(file.analysis.summary);
      lines.push('');
      lines.push(`- Path: \`${file.path}\``);
      if (topicBits.length) lines.push(`- Topics: ${topicBits.join(', ')}`);
      lines.push('');
    }
  }

  return `${lines.join('\n').trim()}\n`;
}

function renderMindmapOutput(indexPath, organization, filesByPath, stats) {
  const lines = [];
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Build visualization JSON data
  const threads = (organization.topics || []).map((topic) => {
    const items = (topic.orderedItems || []).map((ordered) => {
      const file = filesByPath.get(ordered.path);
      const analysis = file?.analysis || {};
      return {
        path: ordered.path,
        title: ordered.label || analysis.title || getWebdavBasename(ordered.path),
        summary: analysis.summary || '',
        importance: analysis.important ? 'high' : (analysis.confidence || 'medium'),
        parentPath: ordered.parentPath || null,
      };
    });
    return {
      title: topic.title,
      summary: topic.summary || '',
      items,
    };
  });

  const connections = (organization.connections?.items || []).map((c) => ({
    from: c.from,
    to: c.to,
    insight: c.insight,
  }));

  const vizData = {
    title: organization.title || 'Your Knowledge Map',
    greeting: organization.greeting || '',
    generatedAt: dateStr,
    stats: { totalFiles: stats.totalFiles, changedCount: stats.changedCount },
    threads,
    connections,
    insights: {
      recentFocus: organization.recentFocus?.items || [],
      blindSpots: organization.blindSpots?.items || [],
      recommendations: organization.recommendations?.items || [],
    },
  };

  lines.push('~~~mindmap-viz');
  lines.push(JSON.stringify(vizData));
  lines.push('~~~');
  lines.push('');

  // Prose insights below the visualization
  const focus = organization.recentFocus;
  if (focus?.items?.length) {
    lines.push('## What you\'ve been focused on lately');
    lines.push('');
    if (focus.summary) { lines.push(focus.summary); lines.push(''); }
    for (const item of focus.items) {
      const badge = item.intensity === 'high' ? '***' : item.intensity === 'medium' ? '**' : '*';
      lines.push(`- ${badge}${item.area}${badge} — ${item.insight}`);
    }
    lines.push('');
  }

  const spots = organization.blindSpots;
  if (spots?.items?.length) {
    lines.push('## Have you considered...');
    lines.push('');
    if (spots.summary) { lines.push(spots.summary); lines.push(''); }
    for (const item of spots.items) {
      const suggestion = item.suggestion ? ` *${item.suggestion}*` : '';
      lines.push(`- ${item.observation}${suggestion}`);
    }
    lines.push('');
  }

  const conns = organization.connections;
  if (conns?.items?.length) {
    lines.push('## Dots that connect');
    lines.push('');
    if (conns.summary) { lines.push(conns.summary); lines.push(''); }
    for (const item of conns.items) {
      lines.push(`- **${item.from}** ↔ **${item.to}**: ${item.insight}`);
    }
    lines.push('');
  }

  const recs = organization.recommendations;
  if (recs?.items?.length) {
    lines.push('## Readings you might enjoy');
    lines.push('');
    if (recs.summary) { lines.push(recs.summary); lines.push(''); }
    for (const item of recs.items) {
      if (item.url) {
        lines.push(`- [${item.title}](${item.url}) — ${item.reason}`);
      } else {
        lines.push(`- **${item.title}** — ${item.reason}`);
      }
    }
    lines.push('');
  }

  return `${lines.join('\n').trim()}\n`;
}

function getWebdavBasename(remotePath) {
  const parts = (remotePath || '').split('/');
  return parts[parts.length - 1] || remotePath;
}

async function mapWithConcurrency(items, limit, iteratee) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const currentIndex = nextIndex;
      if (currentIndex >= items.length) return;
      nextIndex += 1;
      results[currentIndex] = await iteratee(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length || 1));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

async function analyzeChangedFiles(client, changedFiles, llm, previousFiles, params, config, signal, sendProgress) {
  let completed = 0;
  const results = await mapWithConcurrency(changedFiles, config.parallelInference, async (file) => {
    throwIfAborted(signal);
    try {
      sendProgress(`Understanding ${file.name}…`);
      const extracted = await extractContent(client, file, config);
      const analysis = await analyzeFileWithLLM(
        llm,
        file,
        extracted,
        previousFiles[file.path],
        params.instructions || '',
        config,
        signal
      );
      completed += 1;
      sendProgress(`Understood ${completed}/${changedFiles.length} changed file(s).`);
      return {
        ...file,
        extractedKind: extracted.kind,
        analysis,
      };
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      completed += 1;
      sendProgress(`Falling back to metadata for ${file.name}: ${err.message || String(err)}`, 'warn');
      return {
        ...file,
        extractedKind: 'metadata',
        analysis: defaultAnalysisForUnsupported(
          file,
          `Indexed using metadata only because extraction or inference failed: ${err.message || String(err)}`
        ),
      };
    }
  });
  return results;
}

async function writeMindMapOutputs(client, config, markdown, nextState) {
  await ensureRemoteDirectory(client, config.outputDir);
  await client.putFileContents(config.indexPath, markdown, { overwrite: true });
  await client.putFileContents(config.stateFilePath, JSON.stringify(nextState, null, 2), {
    overwrite: true,
  });
}

async function runMindMap({ runId, agentId, params = {}, signal, sendProgress }) {
  const settings = params.settings || {};
  const llm = settings.llm || {};
  if (llm.provider && llm.provider !== 'openai') {
    throw new Error('MindMap requires an OpenAI-compatible model with image support.');
  }
  if (!llm.model) {
    throw new Error('Set a vision-capable OpenAI-compatible model in Settings → LLM before running MindMap.');
  }

  const config = getMindmapConfig(settings);
  const client = createClient(settings);

  sendProgress(`Loading previous MindMap state from ${config.stateFilePath}…`);
  const previousState = await loadPreviousState(client, config.stateFilePath);
  const previousFiles = previousState?.files || {};

  throwIfAborted(signal);
  sendProgress(`Scanning WebDAV recursively under ${config.scanRoot}…`);
  if (config.excludedDirs.length > 0) {
    sendProgress(`Skipping folders: ${config.excludedDirs.join(', ')}`);
  }
  const scannedFiles = await listRemoteFiles(client, config.scanRoot, config, signal, sendProgress);

  const removedPaths = Object.keys(previousFiles).filter(
    (remotePath) => !scannedFiles.some((file) => file.path === remotePath)
  );
  const changedFiles = scannedFiles.filter(
    (file) =>
      !previousFiles[file.path] ||
      previousFiles[file.path].fingerprint !== file.fingerprint ||
      !previousFiles[file.path].analysis
  );
  const reusedFiles = scannedFiles
    .filter(
      (file) =>
        previousFiles[file.path] &&
        previousFiles[file.path].fingerprint === file.fingerprint &&
        previousFiles[file.path].analysis
    )
    .map((file) => ({
      ...file,
      extractedKind: previousFiles[file.path].extractedKind || 'cached',
      analysis: previousFiles[file.path].analysis,
    }));

  sendProgress(
    `Found ${scannedFiles.length} supported file(s): ${changedFiles.length} changed, ${reusedFiles.length} reused, ${removedPaths.length} removed.`
  );

  const analyzedChangedFiles = await analyzeChangedFiles(
    client,
    changedFiles,
    llm,
    previousFiles,
    params,
    config,
    signal,
    sendProgress
  );

  const allFiles = [...reusedFiles, ...analyzedChangedFiles].sort((a, b) => a.path.localeCompare(b.path));
  const stats = {
    totalFiles: allFiles.length,
    changedCount: analyzedChangedFiles.length,
    reusedCount: reusedFiles.length,
    removedCount: removedPaths.length,
    changeRatio: allFiles.length ? (analyzedChangedFiles.length + removedPaths.length) / allFiles.length : 1,
    restructureThreshold: config.restructureThreshold,
  };

  throwIfAborted(signal);
  sendProgress('Looking for readings and resources you might enjoy…');
  const corpusDigest = buildCorpusDigest(allFiles);
  const recommendations = await enrichWithRecommendations(llm, corpusDigest, params.instructions || '', signal);

  throwIfAborted(signal);
  sendProgress('Building your personal knowledge map…');
  const organization = await organizeMindMap(llm, allFiles, previousState, stats, params.instructions || '', recommendations, signal);
  const filesByPath = new Map(allFiles.map((file) => [file.path, file]));
  const markdown = renderMindmapOutput(config.indexPath, organization, filesByPath, stats);

  const nextState = {
    version: 1,
    generatedAt: new Date().toISOString(),
    config: {
      scanRoot: config.scanRoot,
      outputDir: config.outputDir,
      stateFilePath: config.stateFilePath,
    },
    stats: {
      totalFiles: stats.totalFiles,
      changedCount: stats.changedCount,
      reusedCount: stats.reusedCount,
      removedCount: stats.removedCount,
      changeRatio: stats.changeRatio,
    },
    organization,
    files: Object.fromEntries(
      allFiles.map((file) => [
        file.path,
        {
          fingerprint: file.fingerprint,
          size: file.size,
          mime: file.mime,
          lastmod: file.lastmod,
          etag: file.etag,
          extractedKind: file.extractedKind,
          analysis: file.analysis,
        },
      ])
    ),
  };

  throwIfAborted(signal);
  sendProgress(`Writing MindMap outputs into ${config.outputDir}…`);
  await writeMindMapOutputs(client, config, markdown, nextState);

  sendProgress('MindMap generation complete.');
  process.send({
    type: 'done',
    runId,
    agentId,
    result: {
      mindmapPath: config.indexPath,
      pagesRoot: config.scanRoot,
      mindmapMarkdown: markdown,
      summaryText: summarizeRun(stats, organization),
      stats: {
        totalFiles: stats.totalFiles,
        changedCount: stats.changedCount,
        reusedCount: stats.reusedCount,
        removedCount: stats.removedCount,
      },
    },
  });
}

module.exports = { runMindMap, run: runMindMap };
