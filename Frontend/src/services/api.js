/*
 * PackWise API client (build spec §7). Every screen talks to the backend
 * through the functions below only.
 *
 * With VITE_API_BASE_URL unset the calls are served by src/mocks instead, so
 * the wizard can be built and demoed before the backend exists. Switching to
 * the real backend needs no other code changes.
 */
import * as mock from '../mocks/mockApi';
import { ApiError } from './apiError';

export { ApiError };

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const TIMEOUT_MS = 30000;

export const USING_MOCKS = !BASE_URL;

async function request(path, { method = 'GET', body, signal, raw = false } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException('Timed out', 'TimeoutError')), TIMEOUT_MS);
  const onAbort = () => ctrl.abort(signal.reason);
  if (signal) signal.addEventListener('abort', onAbort, { once: true });

  let res;
  try {
    res = await fetch(BASE_URL + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    const timedOut = ctrl.signal.reason?.name === 'TimeoutError';
    throw new ApiError({
      code: timedOut ? 'TIMEOUT' : 'NETWORK_ERROR',
      message: timedOut
        ? 'The server took too long to respond. Your inputs are saved, so you can try again.'
        : "Couldn't reach the PackWise server. Check your connection and try again.",
    });
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }

  if (!res.ok) {
    let payload = null;
    try { payload = await res.json(); } catch { /* not JSON */ }
    throw new ApiError({ ...(payload?.error || {}), status: res.status });
  }
  return raw ? res : res.json();
}

/** GET /api/commodities?query= → { results: [{ commodityId, name, category }] } */
export function searchCommodities(query, { signal } = {}) {
  if (USING_MOCKS) return mock.searchCommodities(query, { signal });
  return request('/api/commodities?query=' + encodeURIComponent(query), { signal });
}

/** GET /api/commodities/{id} → default profile with { value, provenance, confidence } wrappers. */
export function getCommodity(commodityId, { signal } = {}) {
  if (USING_MOCKS) return mock.getCommodity(commodityId, { signal });
  return request('/api/commodities/' + encodeURIComponent(commodityId), { signal });
}

let storageRules = null;

/**
 * GET /api/storage-rules → { commodities: { id: rule }, categories: { category: rule } }.
 * Fetched once per page load; a failed fetch is retried on the next call.
 */
export function getStorageRules() {
  if (!storageRules) {
    storageRules = (USING_MOCKS ? mock.getStorageRules() : request('/api/storage-rules'))
      .catch((error) => { storageRules = null; throw error; });
  }
  return storageRules;
}

/** POST /api/analyze → the full explainable result. */
export function analyze(payload, { signal } = {}) {
  if (USING_MOCKS) return mock.analyze(payload, { signal });
  return request('/api/analyze', { method: 'POST', body: payload, signal });
}

/** GET /api/report/{analysisId}?format=pdf → Blob. Throws when unavailable. */
export async function fetchReportPdf(analysisId) {
  if (USING_MOCKS) throw new ApiError({ code: 'NOT_AVAILABLE', message: 'PDF export needs the backend.' });
  const res = await request('/api/report/' + encodeURIComponent(analysisId) + '?format=pdf', { raw: true });
  return res.blob();
}

/** GET /api/materials → { results: [material], families: [string] } (Material Explorer). */
export function listMaterials({ q = '', family = '', compostable = false, sort = 'name' } = {}, { signal } = {}) {
  if (USING_MOCKS) return mock.listMaterials({ q, family, compostable, sort }, { signal });
  const params = new URLSearchParams({ sort });
  if (q.trim()) params.set('q', q.trim());
  if (family) params.set('family', family);
  if (compostable) params.set('compostable', 'true');
  return request('/api/materials?' + params, { signal });
}

/** GET /api/materials/{id} → material with usedInStructures and similar materials. */
export function getMaterial(materialId, { signal } = {}) {
  if (USING_MOCKS) return mock.getMaterial(materialId, { signal });
  return request('/api/materials/' + encodeURIComponent(materialId), { signal });
}

/** GET /api/structures → { results: [structure] } (library structures with layers and metrics). */
export function listStructures({ signal } = {}) {
  if (USING_MOCKS) return mock.listStructures({ signal });
  return request('/api/structures', { signal });
}

/** POST /api/evaluate { scenario, structure } → indicators, requirements, violations, specifications (Package Builder). */
export function evaluate(payload, { signal } = {}) {
  if (USING_MOCKS) return mock.evaluate(payload, { signal });
  return request('/api/evaluate', { method: 'POST', body: payload, signal });
}

/** POST /api/what-if { baseline, variant } → before, after, changes[, variantRecommendation] (What-If simulator). */
export function whatIf(payload, { signal } = {}) {
  if (USING_MOCKS) return mock.whatIf(payload, { signal });
  return request('/api/what-if', { method: 'POST', body: payload, signal });
}
