/*
 * Scroll-driven 3D box unpacking.
 *
 * Runs outside React's render cycle on purpose: it writes CSS custom
 * properties and transforms straight to the DOM every animation frame.
 * State that CSS reacts to is exposed as data attributes (CSS modules hash
 * class names, attributes stay stable):
 *   stage: data-out, data-resolved, data-measuring
 *   card:  data-landed
 * The mode flag stays a class on <html> (`is-animated`) because the inline
 * <head> script sets it before first paint.
 */
import { clamp, clamp01, seg, ease, lerp } from '../utils/motion';

const MQ = '(min-width: 720px) and (min-height: 600px)';
// Upper slots for the top-row cards, lower slots for the bottom row.
const ANGLES = [-150, -65, -25, 155, 115, 25];
const TOKEN = 48;
const STAGE_VARS = ['--lid', '--side', '--fold', '--out', '--head', '--hint', '--s', '--shrink'];

function cardK(p, i) { return ease(seg(p, 0.6 + 0.045 * i, 0.72 + 0.045 * i)); }
function bob(p, i) { return Math.sin(p * 38 + i * 1.7) * 5; }
function setFlag(el, name, on) { if (on) el.setAttribute(name, ''); else el.removeAttribute(name); }

export function createUnpackEngine(els) {
  const { nav, hero, stage, scene, marker, cats, catsInner, catsHeading, cards, cardIcons, tokens } = els;
  const root = document.documentElement;
  const mql = window.matchMedia ? window.matchMedia(MQ) : null;

  let animated = root.classList.contains('is-animated');
  let geo = null;
  let target = 0, drawn = 0, last = 0, raf = 0, resizeRaf = 0, snapNext = true;
  // Pick up whatever a previous engine instance left on the DOM.
  const landed = cards.map((c) => c.hasAttribute('data-landed'));
  const tokenShown = tokens.map((t) => t.style.visibility === 'visible');

  function applyVars(p) {
    const s = stage.style;
    const out = ease(seg(p, 0.54, 0.70));
    s.setProperty('--lid', ease(seg(p, 0, 0.18)).toFixed(4));
    s.setProperty('--side', ease(seg(p, 0.06, 0.24)).toFixed(4));
    s.setProperty('--fold', ease(seg(p, 0.18, 0.56)).toFixed(4));
    s.setProperty('--out', out.toFixed(4));
    s.setProperty('--head', ease(seg(p, 0.56, 0.68)).toFixed(4));
    s.setProperty('--hint', seg(p, 0, 0.05).toFixed(4));
    for (let i = 0; i < cards.length; i++) cards[i].style.setProperty('--k', cardK(p, i).toFixed(4));
    setFlag(stage, 'data-out', out >= 0.999);
    setFlag(stage, 'data-resolved', p >= 0.95);
  }

  function renderTokens(p) {
    if (!geo) return;
    for (let i = 0; i < tokens.length; i++) {
      const O = geo.open, S = geo.slots[i], T = geo.targets[i];
      const A = { x: O.x + (i - 2.5) * 10 * geo.s, y: O.y - 70 * geo.s };
      const r0 = 0.04 + i * 0.03, r1 = r0 + 0.22, d1 = 0.5 + i * 0.01;
      const l0 = 0.58 + i * 0.045, l1 = 0.70 + i * 0.045;
      let x, y, sc, op, isLanded = false, t;

      if (p <= r0) {
        op = 0; x = O.x; y = O.y; sc = 0.4;
      } else if (p < r1) {                       // rise out of the opening
        t = ease(seg(p, r0, r1));
        x = lerp(O.x, A.x, t); y = lerp(O.y, A.y, t);
        sc = lerp(0.4, 0.85, t); op = Math.min(1, t * 2);
      } else if (p < l0) {                       // drift to the orbit slot, then hover
        t = ease(seg(p, r1, d1));
        x = lerp(A.x, S.x, t); y = lerp(A.y, S.y, t) + bob(p, i) * t;
        sc = lerp(0.85, 1, t); op = 1;
      } else if (p < l1) {                       // arc into the card icon
        t = ease(seg(p, l0, l1));
        const sx = S.x, sy = S.y + bob(l0, i);
        const tx = T.x, ty = T.y + (1 - cardK(p, i)) * 28 * geo.fit;
        const mx = (sx + tx) / 2, my = (sy + ty) / 2 - Math.min(140, Math.hypot(tx - sx, ty - sy) * 0.4);
        const u = 1 - t;
        x = u * u * sx + 2 * u * t * mx + t * t * tx;
        y = u * u * sy + 2 * u * t * my + t * t * ty;
        sc = lerp(1, T.sc, t); op = 1;
      } else {
        isLanded = true;
      }

      const tk = tokens[i];
      const show = !isLanded && op > 0.001;
      if (show) {
        tk.style.transform = 'translate3d(' + (x - TOKEN / 2).toFixed(2) + 'px,' + (y - TOKEN / 2).toFixed(2) + 'px,0) scale(' + sc.toFixed(4) + ')';
        tk.style.opacity = op.toFixed(3);
      }
      if (show !== tokenShown[i]) { tk.style.visibility = show ? 'visible' : 'hidden'; tokenShown[i] = show; }
      if (isLanded !== landed[i]) { setFlag(cards[i], 'data-landed', isLanded); landed[i] = isLanded; }
    }
  }

  function paint(p) { applyVars(p); renderTokens(p); }

  function measure() {
    if (!animated) return;
    const st = stage.style;
    const navH = nav.offsetHeight;
    const trackStart = hero.getBoundingClientRect().top + window.scrollY - navH;
    const trackLen = Math.max(1, hero.offsetHeight - stage.offsetHeight);

    const sr = stage.getBoundingClientRect();
    const scr = scene.getBoundingClientRect();

    // Fit the closed box to the scene, then shrink the flat net so it also fits.
    const s = clamp(Math.min(scr.height / 330, scr.width / 400), 0.45, 1.15);
    const netS = Math.min(scr.width * 0.85 / 600, scr.height * 0.85 / 560);
    const shrink = clamp(1 - netS / s, 0, 0.75);
    st.setProperty('--s', s.toFixed(4));
    st.setProperty('--shrink', shrink.toFixed(4));

    // Scale the category grid down if it can't fit the stage.
    setFlag(stage, 'data-measuring', true);
    catsInner.style.setProperty('--fit', '1');
    const need = catsInner.offsetHeight;
    const avail = stage.clientHeight - 48;
    const fit = need > avail ? avail / need : 1;
    catsInner.style.setProperty('--fit', fit.toFixed(4));

    applyVars(0);
    const mr = marker.getBoundingClientRect();
    const open = { x: mr.left + mr.width / 2 - sr.left, y: mr.top + mr.height / 2 - sr.top };
    const targets = cardIcons.map((ic) => {
      const r = ic.getBoundingClientRect();
      return { x: r.left + r.width / 2 - sr.left, y: r.top + r.height / 2 - sr.top, sc: r.width / TOKEN };
    });
    setFlag(stage, 'data-measuring', false);

    const cx = scr.left + scr.width / 2 - sr.left;
    const cy = scr.top + scr.height / 2 - sr.top;
    const rx = Math.min(sr.width * 0.42, 470);
    const ry = Math.min(scr.height * 0.44, 230);
    const slots = ANGLES.map((a) => {
      const r = a * Math.PI / 180;
      return { x: cx + rx * Math.cos(r), y: cy + ry * Math.sin(r) };
    });

    geo = { trackStart, trackLen, s, fit, open, targets, slots };
    snapNext = true;
  }

  function frame(now) {
    raf = 0;
    if (!animated || !geo) return;
    const raw = (window.scrollY - geo.trackStart) / geo.trackLen;
    target = clamp01(raw);
    if (snapNext || raw > 1) {
      drawn = target; snapNext = false;             // layout change or scrolled past: no glide
    } else {
      const dt = last ? Math.min(100, now - last) : 16.7;
      drawn += (target - drawn) * (1 - Math.exp(-dt / 180));
      if (Math.abs(target - drawn) < 0.0004) drawn = target;
    }
    paint(drawn);
    if (drawn !== target) { last = now; raf = requestAnimationFrame(frame); }
    else last = 0;
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }

  function relayout() {
    if (!animated) return;
    measure();
    kick();
  }

  function clearAnimated() {
    STAGE_VARS.forEach((v) => stage.style.removeProperty(v));
    ['data-out', 'data-resolved', 'data-measuring'].forEach((a) => stage.removeAttribute(a));
    catsInner.style.removeProperty('--fit');
    cards.forEach((c, i) => { c.style.removeProperty('--k'); c.removeAttribute('data-landed'); landed[i] = false; });
    tokens.forEach((t, i) => { t.style.visibility = 'hidden'; tokenShown[i] = false; });
    geo = null;
  }

  function setMode(on) {
    if (on === animated) return;
    animated = on;
    root.classList.toggle('is-animated', on);
    if (on) relayout(); else clearAnimated();
  }

  /** Jump to the end of the track and show the resolved grid. */
  function jumpToGrid(focusHeading) {
    if (animated && geo) {
      window.scrollTo(0, Math.ceil(geo.trackStart + geo.trackLen));
      target = drawn = 1; snapNext = true;
      paint(1);
    } else {
      cats.scrollIntoView({ block: 'start' });
    }
    if (focusHeading) catsHeading.focus({ preventScroll: true });
  }

  /** True while the grid is still assembling (cards not yet clickable). */
  function isAssembling() { return animated && drawn < 0.95; }

  const onScroll = () => { if (animated) kick(); };
  const onResize = () => {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => { resizeRaf = 0; relayout(); });
  };
  const onModeChange = (e) => setMode(e.matches);

  function start() {
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    window.addEventListener('load', relayout);
    if (mql) {
      if (mql.addEventListener) mql.addEventListener('change', onModeChange); else if (mql.addListener) mql.addListener(onModeChange);
      if (mql.matches !== animated) setMode(mql.matches);
    }
    if (animated) relayout();
  }

  function stop() {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('load', relayout);
    if (mql) {
      if (mql.removeEventListener) mql.removeEventListener('change', onModeChange); else if (mql.removeListener) mql.removeListener(onModeChange);
    }
    if (raf) cancelAnimationFrame(raf);
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    raf = resizeRaf = 0;
  }

  return { start, stop, jumpToGrid, isAssembling };
}
