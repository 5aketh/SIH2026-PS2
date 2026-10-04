/*
 * Integration hooks for a later wizard. By default they dispatch CustomEvents
 * on `document`; a wizard can replace `window.PackWise.startCategory` /
 * `startCustom` and every caller picks the new version up at call time.
 */

export function installPackWiseApi() {
  const api = (window.PackWise = window.PackWise || {});
  if (typeof api.startCategory !== 'function') {
    api.startCategory = function (category) {
      document.dispatchEvent(new CustomEvent('packwise:start-category', { detail: { category } }));
    };
  }
  if (typeof api.startCustom !== 'function') {
    api.startCustom = function (opts) {
      opts = opts || {};
      document.dispatchEvent(new CustomEvent('packwise:start-custom', {
        detail: {
          description: String(opts.description || ''),
          tags: Array.isArray(opts.tags) ? opts.tags.slice() : [],
        },
      }));
    };
  }
}

export function startCategory(category) {
  window.PackWise.startCategory(category);
}

export function startCustom({ description, tags }) {
  window.PackWise.startCustom({ description, tags });
}
