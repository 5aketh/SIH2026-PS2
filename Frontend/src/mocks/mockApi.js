/*
 * In-browser stand-in for the PackWise backend (used when VITE_API_BASE_URL
 * is unset). Responses are snapshots of the real engine's output, exported by
 * backend/scripts/export_fixtures.py into ./fixtures, served with realistic
 * latency. Simulate failures from the console:
 *
 *   window.PackWise.mock.failNext('network')     // next analyze call fails
 *   window.PackWise.mock.failNext('validation')  // VALIDATION_ERROR on conditions.temperatureC
 *
 * The Package Builder and What-If simulator compute on demand, so they need
 * the backend; here they answer NOT_AVAILABLE.
 */
import { ApiError } from '../services/apiError';

let failNextKind = null;

if (typeof window !== 'undefined') {
  const api = (window.PackWise = window.PackWise || {});
  api.mock = {
    failNext(kind = 'network') { failNextKind = kind; return `Next analyze call will fail with: ${kind}`; },
  };
}

// Fixtures load on first use so they stay out of the main bundle.
const load = {
  commodities: () => import('./fixtures/commodities.json').then((m) => m.default),
  storageRules: () => import('./fixtures/storage_rules.json').then((m) => m.default),
  analyses: () => import('./fixtures/analyses.json').then((m) => m.default),
  materials: () => import('./fixtures/materials.json').then((m) => m.default),
  structures: () => import('./fixtures/structures.json').then((m) => m.default),
};

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(signal.reason); }, { once: true });
  });
}

const notFound = (message) => new ApiError({ code: 'NOT_FOUND', message, status: 404 });

export async function searchCommodities(query, { signal } = {}) {
  const [all] = await Promise.all([load.commodities(), delay(query ? 250 : 500, signal)]);
  const q = query.trim().toLowerCase();
  const results = all
    .filter((c) => !q || c.name.toLowerCase().includes(q) || c.commodityId.toLowerCase().includes(q))
    .map(({ commodityId, name, category }) => ({ commodityId, name, category }));
  return { results };
}

export async function getCommodity(commodityId, { signal } = {}) {
  const [all] = await Promise.all([load.commodities(), delay(450, signal)]);
  const hit = all.find((c) => c.commodityId === commodityId);
  if (!hit) throw notFound('That commodity is no longer in the catalog.');
  return structuredClone(hit);
}

export async function getStorageRules() {
  return structuredClone(await load.storageRules());
}

export async function analyze(payload, { signal } = {}) {
  const [fixtures] = await Promise.all([load.analyses(), delay(2600, signal)]);

  const kind = failNextKind;
  failNextKind = null;
  if (kind === 'network') {
    throw new ApiError({ code: 'NETWORK_ERROR', message: "Couldn't reach the PackWise server. Check your connection and try again." });
  }
  if (kind === 'validation') {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Temperature is outside the range supported for this storage type.',
      field: 'conditions.temperatureC',
      status: 422,
    });
  }
  if (kind) {
    throw new ApiError({ code: 'SERVER_ERROR', message: 'The analysis service hit an unexpected error.', status: 500 });
  }

  const p = payload.commodity.profile;
  const key =
    p.category === 'fresh_produce' || p.respirationClass === 'high' ? 'fresh_produce'
      : p.category === 'snack' || p.category === 'dry_goods' ? 'dry'
        : 'generic';

  return {
    analysisId: 'an_mock_' + Math.random().toString(16).slice(2, 10),
    ...structuredClone(fixtures[key]),
  };
}

/* ---------- Material Explorer ---------- */

const SORTS = {
  name: (a, b) => a.name.localeCompare(b.name),
  cost: (a, b) => a.properties.costInrPerKg[0] - b.properties.costInrPerKg[0],
};

export async function listMaterials({ q = '', family = '', compostable = false, sort = 'name' } = {}, { signal } = {}) {
  const [data] = await Promise.all([load.materials(), delay(300, signal)]);
  const ql = q.trim().toLowerCase();
  const results = Object.values(data.details)
    // The list endpoint returns the detail record without these two fields.
    .map((m) => ({ ...m, usedInStructures: undefined, similar: undefined }))
    .filter((m) => !ql || [m.name, m.materialId, m.family, ...(m.applications || [])].some((s) => s.toLowerCase().includes(ql)))
    .filter((m) => !family || m.family === family)
    .filter((m) => !compostable || m.properties.compostable)
    .sort(SORTS[sort] || ((a, b) => b.indicators[sort] - a.indicators[sort]));
  return { results: structuredClone(results), families: data.families };
}

export async function getMaterial(materialId, { signal } = {}) {
  const [data] = await Promise.all([load.materials(), delay(300, signal)]);
  const hit = data.details[String(materialId).toUpperCase()];
  if (!hit) throw notFound("That material isn't in the knowledge base.");
  return structuredClone(hit);
}

export async function listStructures({ signal } = {}) {
  const [all] = await Promise.all([load.structures(), delay(300, signal)]);
  return { results: structuredClone(all) };
}

/* ---------- Builder / What-If ---------- */

const NEEDS_BACKEND = 'This tool calculates each package on the server, so it needs the PackWise backend. Start it and set VITE_API_BASE_URL.';

export async function evaluate(_payload, { signal } = {}) {
  await delay(200, signal);
  throw new ApiError({ code: 'NOT_AVAILABLE', message: NEEDS_BACKEND });
}

export async function whatIf(_payload, { signal } = {}) {
  await delay(200, signal);
  throw new ApiError({ code: 'NOT_AVAILABLE', message: NEEDS_BACKEND });
}
