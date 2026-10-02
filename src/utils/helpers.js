class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Plain text only: strips angle brackets and control characters, trims, limits length.
function cleanText(v, max = 500) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/[<>]/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}

function isEmail(v) {
  return typeof v === 'string' && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

// Only real 24-char hex ids (mongoose.isValidObjectId also accepts any 12-char string).
const isObjectId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);

// Returns '' for empty input, a normalised http(s) URL, or throws. Blocks javascript:, data: etc.
function cleanUrl(v) {
  const s = String(v === undefined || v === null ? '' : v).trim();
  if (!s) return '';
  if (s.length > 2000) throw new HttpError(400, 'URL is too long.');
  let u;
  try { u = new URL(s); } catch { throw new HttpError(400, 'Please enter a valid URL starting with http:// or https://'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new HttpError(400, 'Only http:// and https:// links are allowed.');
  }
  return u.toString();
}

// http(s) URL or a simple relative image path such as "earbuds.jpg".
function cleanImage(v) {
  const s = String(v === undefined || v === null ? '' : v).trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return cleanUrl(s);
  if (/^[\w\-. /()%~]{1,300}$/.test(s) && !s.includes('..')) return s;
  throw new HttpError(400, 'Invalid image path.');
}

const pick = (obj, keys) => keys.reduce((o, k) => (obj && obj[k] !== undefined ? ((o[k] = obj[k]), o) : o), {});

function clampInt(v, min, max, def) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return def;
  return Math.min(max, Math.max(min, n));
}

function parseDate(v) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new HttpError(400, 'Invalid date.');
  return d;
}

// Sanitises free-form form payloads (contact, job application...) before storing.
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
function cleanObject(v, depth = 0) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string') return cleanText(v, 5000);
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean') return v;
  if (depth >= 3) return null;
  if (Array.isArray(v)) return v.slice(0, 50).map((x) => cleanObject(x, depth + 1));
  if (typeof v === 'object') {
    const out = {};
    Object.keys(v).slice(0, 50).forEach((k) => {
      if (k.startsWith('$') || k.includes('.') || BAD_KEYS.has(k)) return;
      out[cleanText(k, 60)] = cleanObject(v[k], depth + 1);
    });
    return out;
  }
  return null;
}

// Removes Mongo operator keys ($where, $ne ...) from incoming data (NoSQL injection).
function stripOperators(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) delete obj[key];
    else stripOperators(obj[key]);
  }
  return obj;
}

module.exports = {
  HttpError, asyncHandler, escapeRegex, cleanText, isEmail, isObjectId,
  cleanUrl, cleanImage, pick, clampInt, parseDate, cleanObject, stripOperators
};
