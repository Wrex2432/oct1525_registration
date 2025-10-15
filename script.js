/* Your Google Apps Script Web App URL (keep using yours) */
const GAS_URL = 'https://script.google.com/macros/s/AKfycbzoFyz_5MgxV4tuaeWbxyhnxEZy2dl3elB_Tzf7Gc7oYt4-191bBhQJBFeFDj5LFYOK/exec';

/* ---- Security helpers ---- */
// Double-submit cookie: set + mirror to hidden field; server should verify equality.
(function ensureCsrfSeed(){
  const key = 'reg_csrf';
  let token = '';
  try { token = crypto.randomUUID(); } catch { token = String(Date.now()) + Math.random().toString(16).slice(2); }
  document.cookie = `${key}=${token}; Path=/; SameSite=Lax`;
  const csrf = document.getElementById('csrf'); // optional hidden <input id="csrf">
  if (csrf) csrf.value = token;
})();

/* ---- Utils ---- */
const clean = (s = '') => String(s).replace(/\s+/g,' ').trim();
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
function normalizePhone(input){
  if(!input) return '';
  let s = String(input).trim();
  return s.replace(/[^\d+]/g, ''); // keep leading + and digits
}

/* ---- Error UI (inline styles; no CSS changes needed) ---- */
function setErrorField(inputEl) {
  const fieldWrap = inputEl.closest('.field') || inputEl;
  fieldWrap.style.border = '2px solid #e53935';
  fieldWrap.style.boxShadow = '0 0 0 1px rgba(229,57,53,.12) inset';
  inputEl.setAttribute('aria-invalid', 'true');
}
function clearErrorField(inputEl) {
  const fieldWrap = inputEl.closest('.field') || inputEl;
  fieldWrap.style.border = '';
  fieldWrap.style.boxShadow = '';
  inputEl.removeAttribute('aria-invalid');
}
function setErrorCheck(checkEl) {
  const labelWrap = checkEl.closest('.check') || checkEl.parentElement || checkEl;
  labelWrap.style.outline = '2px solid #e53935';
  labelWrap.style.outlineOffset = '4px';
  checkEl.style.accentColor = '#e53935';
  checkEl.setAttribute('aria-invalid', 'true');
}
function clearErrorCheck(checkEl) {
  const labelWrap = checkEl.closest('.check') || checkEl.parentElement || checkEl;
  labelWrap.style.outline = '';
  labelWrap.style.outlineOffset = '';
  checkEl.style.accentColor = '';
  checkEl.removeAttribute('aria-invalid');
}

/* ---- Form wiring ---- */
const form = document.getElementById('regForm');
const msg  = document.getElementById('msg');        // optional <div id="msg">
function setStatus(kind, text){
  if (!msg) { if (kind === 'err') alert(text); return; }
  msg.classList.remove('ok','err');
  if(kind === 'ok') msg.classList.add('ok');
  if(kind === 'err') msg.classList.add('err');
  msg.textContent = text;
}
function clearStatus(){ if (msg){ msg.classList.remove('ok','err'); msg.textContent = ''; } }

/* Required fields in the form view */
const REQUIRED_FIELDS = ['firstName','lastName','position','company','workEmail']; // phone optional
const REQUIRED_CHECKS = ['consent1','consent2'];                                   // both required

function validateAll() {
  let ok = true;
  let firstErrorEl = null;

  // Clear previous visuals
  REQUIRED_FIELDS.forEach(name => {
    const el = form?.elements[name];
    if (el) clearErrorField(el);
  });
  REQUIRED_CHECKS.forEach(name => {
    const el = form?.elements[name];
    if (el) clearErrorCheck(el);
  });

  // Fields
  REQUIRED_FIELDS.forEach(name => {
    const el = form?.elements[name];
    if (!el) return;
    const val = clean(el.value);
    const missing = val.length === 0;
    const badEmail = (name === 'workEmail') && !isValidEmail(val);
    if (missing || badEmail) {
      setErrorField(el);
      ok = false;
      if (!firstErrorEl) firstErrorEl = el;
    }
  });

  // Optional phone sanity
  const phoneEl = form?.elements['phone'];
  if (phoneEl) {
    const normalized = normalizePhone(phoneEl.value);
    if (normalized && (normalized.length < 7 || normalized.length > 20)) {
      setErrorField(phoneEl);
      ok = false;
      if (!firstErrorEl) firstErrorEl = phoneEl;
    }
  }

  // Checkboxes
  REQUIRED_CHECKS.forEach(name => {
    const el = form?.elements[name];
    if (el && !el.checked) {
      setErrorCheck(el);
      ok = false;
      if (!firstErrorEl) firstErrorEl = el;
    }
  });

  if (!ok && firstErrorEl) {
    firstErrorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => firstErrorEl.focus?.({ preventScroll: true }), 200);
  }
  return ok;
}

/* Live clearing */
form?.addEventListener('input', (e) => {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;
  if (t.closest('.field')) clearErrorField(t);
});
form?.addEventListener('change', (e) => {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;
  if (t.matches('input[type="checkbox"]')) clearErrorCheck(t);
});

/* Submit -> on success, go to Thank You state */
form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearStatus();

  // honeypot
  const hp = form.querySelector('input[name="website"]');
  if (hp && hp.value.trim() !== '') { setStatus('err','Submission blocked.'); return; }

  if (!validateAll()) return;

  // Build payload expected by your GAS
  const firstName = clean(form.elements['firstName']?.value);
  const lastName  = clean(form.elements['lastName']?.value);
  const fullName  = clean(`${firstName} ${lastName}`);
  const position  = clean(form.elements['position']?.value);
  const company   = clean(form.elements['company']?.value);
  const email     = clean(form.elements['workEmail']?.value).toLowerCase(); // map to GAS 'email'
  const phone     = normalizePhone(form.elements['phone']?.value || '');
  const csrf      = document.getElementById('csrf')?.value || '';

  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting…'; }

  // Network timeout
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), 15000);

  try {
    await fetch(GAS_URL, {
      method: 'POST',
      mode: 'no-cors', // keep if GAS doesn't send CORS headers
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify({ fullName, position, company, email, phone, csrf }),
      signal: ac.signal
    });
    // Grab first name from common field ids/names
    const firstNameField = document.querySelector('#firstName, #fname, [name="firstName"], [name="fname"]');
    const submittedFirstName = `[${(firstNameField?.value || '').trim()}]`;

    // Persist for the Thanks screen
    if (submittedFirstName) {
      sessionStorage.setItem('hp:firstName', submittedFirstName);
    }


    // Assume success if no exception with no-cors
    form.reset();
    setStatus('ok','Thanks! Your registration has been recorded.');
    // switch to Thank You state
    window.AppState?.goTo('thanks');
  } catch (err){
    console.error(err);
    if (err.name === 'AbortError') setStatus('err','Network timeout. Please try again.');
    else setStatus('err','Something went wrong. Please try again.');
  } finally {
    clearTimeout(to);
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit'; }
  }
});
