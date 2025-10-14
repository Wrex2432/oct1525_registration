// state.js — View/state controller for Intro → Form → Thanks
// - Page is a fixed viewport; panes are stacked (no page scroll).
// - State 2 (Form): card falls in + shared BG fades in.
// - Submit: card lifts up, then we switch to Thanks (image pops).
// - Adds a PREP frame so the card truly starts off-screen at top.
// - Restored: num keys 1/2/3 to jump Intro/Form/Thanks.

(function () {
  // ---------- DOM ----------
  const VIEW_STACKED = document.getElementById('view-stacked');  // Intro + Form wrapper
  const VIEW_THANKS  = document.getElementById('view-thanks');   // Thank You view

  const STACKER   = document.getElementById('stacker');          // panes container
  const TRACK     = document.getElementById('stackTrack');       // legacy inner track (kept static)

  const BTN_START = document.getElementById('startBtn');         // Intro → Form
  const BTN_AGAIN = document.getElementById('againBtn');         // Thanks → Form (optional)

  // Optional: your actual form element (wire submit success to toThanks)
  const FORM_EL   = document.querySelector('.pane--form form');

  // ---------- Utilities ----------
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const raf = (fn) => requestAnimationFrame(fn);

  function after(ms, fn) {
    const t = setTimeout(fn, ms);
    return () => clearTimeout(t);
  }

  function onTransitionOnce(el, propName, fn, safetyMs = 900) {
    if (!el) return fn();
    let done = false;
    const cancelSafety = after(safetyMs, finish);

    function finish() {
      if (done) return;
      done = true;
      cancelSafety();
      el.removeEventListener('transitionend', onEnd);
      fn();
    }
    function onEnd(e) {
      if (propName && e.propertyName !== propName) return;
      finish();
    }
    el.addEventListener('transitionend', onEnd);
  }

  function showView(viewEl) {
    $$('.view').forEach(v => v.classList.toggle('is-active', v === viewEl));
  }

  function clearStackerFlags() {
    if (!STACKER) return;
    STACKER.classList.remove('is-intro', 'is-form', 'form-leave', 'form-prep');
  }

  function setStackerState(name) {
    if (!STACKER) return;
    STACKER.classList.toggle('is-intro',    name === 'intro');
    STACKER.classList.toggle('is-form',     name === 'form');
    STACKER.classList.toggle('form-leave',  name === 'form-leave');
    STACKER.classList.toggle('form-prep',   name === 'form-prep');
  }

  // ---------- Transitions ----------
  function toIntro() {
    showView(VIEW_STACKED);           // keep stacked viewport
    clearStackerFlags();
    setStackerState('intro');         // only Intro pane clickable
    state.current = 'intro';
  }

  function toForm() {
    showView(VIEW_STACKED);
    clearStackerFlags();
    setStackerState('form-prep');

    const formPane = document.querySelector('.pane--form');
    const formCard = document.querySelector('.pane--form .card');

    requestAnimationFrame(() => {
      // Commit PREP styles for both card and BG (::before)
      void formCard?.offsetHeight;
      // also touch the pane to ensure ::before is realized
      getComputedStyle(formPane, '::before').opacity;

      requestAnimationFrame(() => {
        setStackerState('form');          // triggers BG fade + card fall-in
        STACKER.classList.remove('form-prep');
        state.current = 'form';
      });
    });
  }


  function toThanks() {
    // Animate the form card up first, then switch view
    showView(VIEW_STACKED);
    // Ensure we are in form state before leaving
    if (!STACKER.classList.contains('is-form')) {
      clearStackerFlags();
      setStackerState('form');
    }
    // Trigger exit-up
    STACKER.classList.add('form-leave');

    const formCard = document.querySelector('.pane--form .card');
    onTransitionOnce(formCard, 'transform', () => {
      clearStackerFlags();
      showView(VIEW_THANKS);
      state.current = 'thanks';
    }, 950);
  }

  // ---------- Public API ----------
  const state = (window.AppState = {
    current: 'intro',
    goTo(next) {
      if (next === 'intro')  return toIntro();
      if (next === 'form')   return toForm();
      if (next === 'thanks') return toThanks();
    },
    toIntro, toForm, toThanks
  });

  // ---------- Buttons ----------
  BTN_START?.addEventListener('click', toForm);
  BTN_AGAIN?.addEventListener('click', toForm); // “Register another” loop

  // Pressed-state visual for the image button
  BTN_START?.addEventListener('pointerdown', () => BTN_START.classList.add('is-pressed'));
  window.addEventListener('pointerup',     () => BTN_START?.classList.remove('is-pressed'), { passive: true });
  window.addEventListener('pointercancel', () => BTN_START?.classList.remove('is-pressed'), { passive: true });

  // ---------- Keyboard: 1/2/3 quick switching ----------
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.key === '1') return toIntro();
    if (e.key === '2') return toForm();
    if (e.key === '3') return toThanks();
  });

  // ---------- Form submit wiring (call toThanks on success) ----------
  if (FORM_EL) {
    FORM_EL.addEventListener('submit', (e) => {
      // Example: call AppState.toThanks() after async save
      // e.preventDefault();
      // doAsyncSave().then(() => AppState.toThanks()).catch(showError);
    });
  }

  // ---------- Viewport CSS vars (for --vh / --pane-h usage) ----------
  function setVH() {
    const px = window.innerHeight + 'px';
    document.documentElement.style.setProperty('--vh', px);
    document.documentElement.style.setProperty('--pane-h', px);
  }
  setVH();
  window.addEventListener('resize', setVH, { passive: true });

  // ---------- Init ----------
  showView(VIEW_STACKED);
  clearStackerFlags();
  setStackerState('intro');           // start at Intro
  if (TRACK) TRACK.style.transform = 'none'; // ensure no legacy slide
})();
