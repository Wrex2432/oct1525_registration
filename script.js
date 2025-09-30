/* Your Google Apps Script Web App URL (keep using yours) */
const GAS_URL = 'https://script.google.com/macros/s/AKfycbzoFyz_5MgxV4tuaeWbxyhnxEZy2dl3elB_Tzf7Gc7oYt4-191bBhQJBFeFDj5LFYOK/exec';

/* ---- Security helpers ---- */
// Double-submit cookie: set + mirror to hidden field; server should verify equality.
(function ensureCsrfSeed(){
  const key = 'reg_csrf';
  let token = '';
  try { token = crypto.randomUUID(); } catch { token = String(Date.now()) + Math.random().toString(16).slice(2); }
  document.cookie = `${key}=${token}; Path=/; SameSite=Lax`;
  const csrf = document.getElementById('csrf');
  if (csrf) csrf.value = token;
})();

// Trim/sanitize utility
const clean = (s) => s.replace(/\s+/g,' ').trim();

// Email validator (simple)
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Normalize phone to a digits-only international-ish format (keeps + at start)
function normalizePhone(input){
  if(!input) return '';
  let s = input.trim();
  s = s.replace(/[^\d+]/g, '');
  // If it starts with 0 and not +, you may map it (example: PH 0 -> +63). Keeping generic:
  return s;
}

// Custom validity messages
function attachValidation(){
  const fullName = document.getElementById('fullName');
  const position = document.getElementById('position');
  const company  = document.getElementById('company');
  const email    = document.getElementById('email');
  const phone    = document.getElementById('phone');

  const setMsg = (el, msg) => { el.setCustomValidity(msg); el.reportValidity(); };

  fullName.addEventListener('input', () => {
    fullName.value = fullName.value.replace(/\s{2,}/g,' ');
    if(fullName.validity.patternMismatch || fullName.value.trim().length < 2){
      setMsg(fullName, 'Use letters, spaces, hyphens, apostrophes. Min 2 characters.');
    } else setMsg(fullName, '');
  });

  [position, company].forEach(el => {
    el.addEventListener('input', () => {
      if(el.value.trim().length < 2) setMsg(el, 'Please enter at least 2 characters.');
      else setMsg(el, '');
    });
  });

  email.addEventListener('input', () => {
    email.value = email.value.trim();
    if(!isValidEmail(email.value)) setMsg(email, 'Enter a valid email like name@example.com.');
    else setMsg(email, '');
  });

  phone.addEventListener('input', () => {
    // Allow user-friendly typing; final normalization on submit
    const raw = phone.value;
    if(raw && !/^\+?[0-9\s\-()]{7,20}$/.test(raw)){
      setMsg(phone, 'Use digits, spaces, dashes, parentheses. 7–20 chars.');
    } else setMsg(phone, '');
  });
}
attachValidation();

/* ---- Form submit ---- */
const form = document.getElementById('regForm');
const btn  = document.getElementById('submitBtn');
const msg  = document.getElementById('msg');

function setStatus(kind, text){
  msg.classList.remove('ok','err');
  if(kind === 'ok') msg.classList.add('ok');
  if(kind === 'err') msg.classList.add('err');
  msg.textContent = text;
}
function clearStatus(){
  msg.classList.remove('ok','err');
  msg.textContent = '';
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearStatus();

  // bot trap
  const hp = form.querySelector('input[name="website"]');
  if (hp && hp.value.trim() !== '') { setStatus('err','Submission blocked.'); return; }

  const fullName = clean(document.getElementById('fullName').value);
  const position = clean(document.getElementById('position').value);
  const company  = clean(document.getElementById('company').value);
  const email    = clean(document.getElementById('email').value).toLowerCase();
  const phone    = normalizePhone(document.getElementById('phone').value);
  const csrf     = document.getElementById('csrf').value;

  // Required checks
  if(!fullName || !position || !company || !email){
    setStatus('err','Please complete all required fields.'); return;
  }
  if(!isValidEmail(email)){
    setStatus('err','Please enter a valid email address.'); return;
  }
  // Optional phone format sanity (if provided)
  if(phone && (phone.length < 7 || phone.length > 20)){
    setStatus('err','Phone should be 7–20 characters long.'); return;
  }

  // Network timeout (avoids hanging)
  const ac = new AbortController();
  const t  = setTimeout(() => ac.abort(), 15000);

  btn.disabled = true;
  btn.textContent = 'Submitting…';

  try{
    const res = await fetch(GAS_URL, {
      method: 'POST',
      // Keep 'no-cors' if your Apps Script isn't sending CORS headers.
      // If you add CORS on the server, switch to 'cors' and read JSON.
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest' // hint for server
      },
      body: JSON.stringify({ fullName, position, company, email, phone, csrf }),
      signal: ac.signal
    });

    // With 'no-cors' the response is opaque; assume success if no exception.
    setStatus('ok','Thanks! Your registration has been recorded.');
    form.reset();
  } catch (err){
    console.error(err);
    if (err.name === 'AbortError') setStatus('err','Network timeout. Please try again.');
    else setStatus('err','Something went wrong. Please try again.');
  } finally {
    clearTimeout(t);
    btn.disabled = false;
    btn.textContent = 'Submit';
  }
});
