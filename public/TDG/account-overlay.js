/**
 * TDG account overlay — profile icon (top-right) + settings popup.
 * Uses Auth.js session cookies via /api/account/profile and /api/auth/*.
 */
(function () {
  const STYLE_ID = 'tdg-account-overlay-style';
  const ROOT_ID = 'tdg-account-overlay';
  const CHARACTER_PORTRAITS = [
    'commander',
    'archer',
    'swordsman',
    'bowman',
    'tank',
    'battletank',
    'striker',
    'sniper',
    'wolf_hunter',
    'yeti',
    'goblin',
    'peka',
    'slime',
    'angel',
    'farmer',
    'engineers',
  ];

  if (document.getElementById(ROOT_ID)) return;

  const css = `
#${ROOT_ID} {
  position: fixed;
  top: max(10px, env(safe-area-inset-top, 0px));
  right: max(10px, env(safe-area-inset-right, 0px));
  z-index: 200000;
  font-family: Rajdhani, system-ui, sans-serif;
  color: #e8ebe0;
  pointer-events: none;
}
#live-feather-cursor { z-index: 300005 !important; }
#live-feather-tip-glow { z-index: 300004 !important; }
#${ROOT_ID} * { box-sizing: border-box; }
#${ROOT_ID} .tdg-acc-btn,
#${ROOT_ID} .tdg-acc-panel,
#${ROOT_ID} .tdg-acc-backdrop {
  pointer-events: auto;
}
#${ROOT_ID} .tdg-acc-btn {
  width: 44px;
  height: 44px;
  border-radius: 999px;
  border: 2px solid rgba(240, 216, 120, 0.55);
  background: rgba(8, 12, 10, 0.82);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow: 0 6px 24px rgba(0,0,0,0.45);
  cursor: pointer;
  padding: 0;
  overflow: hidden;
  display: grid;
  place-items: center;
  transition: border-color 0.15s ease, transform 0.15s ease;
}
#${ROOT_ID} .tdg-acc-btn:hover {
  border-color: #f0d878;
  transform: scale(1.04);
}
#${ROOT_ID} .tdg-acc-btn img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
#${ROOT_ID} .tdg-acc-btn .tdg-acc-initial {
  font-family: Orbitron, Rajdhani, sans-serif;
  font-weight: 700;
  font-size: 0.95rem;
  color: #f0d878;
  letter-spacing: 0.04em;
}
#${ROOT_ID} .tdg-acc-btn .tdg-acc-guest-icon {
  width: 22px;
  height: 22px;
  opacity: 0.9;
}
#${ROOT_ID} .tdg-acc-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 200001;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease;
}
#${ROOT_ID}.open .tdg-acc-backdrop {
  opacity: 1;
  pointer-events: auto;
}
#${ROOT_ID} .tdg-acc-panel {
  position: fixed;
  top: max(64px, calc(env(safe-area-inset-top, 0px) + 56px));
  right: max(10px, env(safe-area-inset-right, 0px));
  width: min(360px, calc(100vw - 20px));
  max-height: min(78vh, 560px);
  overflow: auto;
  z-index: 200002;
  border-radius: 16px;
  border: 1px solid rgba(240, 216, 120, 0.28);
  background: linear-gradient(165deg, rgba(18, 24, 20, 0.97), rgba(8, 10, 12, 0.98));
  box-shadow: 0 18px 50px rgba(0,0,0,0.55);
  padding: 18px 18px 16px;
  transform: translateY(-6px) scale(0.98);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease, transform 0.18s ease;
}
#${ROOT_ID}.open .tdg-acc-panel {
  opacity: 1;
  transform: none;
  pointer-events: auto;
}
#${ROOT_ID} .tdg-acc-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
#${ROOT_ID} .tdg-acc-eyebrow {
  font-size: 0.68rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(240, 216, 120, 0.75);
  margin: 0 0 4px;
}
#${ROOT_ID} .tdg-acc-title {
  font-family: Orbitron, Rajdhani, sans-serif;
  font-size: 1.15rem;
  font-weight: 700;
  margin: 0;
  color: #f5f5f0;
}
#${ROOT_ID} .tdg-acc-close {
  border: none;
  background: transparent;
  color: rgba(255,255,255,0.55);
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  padding: 2px 6px;
}
#${ROOT_ID} .tdg-acc-close:hover { color: #fff; }
#${ROOT_ID} .tdg-acc-body { font-size: 0.95rem; line-height: 1.45; }
#${ROOT_ID} .tdg-acc-muted { color: rgba(232, 235, 224, 0.7); margin: 0 0 14px; }
#${ROOT_ID} .tdg-acc-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}
#${ROOT_ID} .tdg-acc-avatar {
  width: 52px;
  height: 52px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.18);
  object-fit: cover;
  background: rgba(30, 80, 70, 0.45);
  display: grid;
  place-items: center;
  font-family: Orbitron, sans-serif;
  font-weight: 700;
  color: #9fe8d8;
  flex-shrink: 0;
  overflow: hidden;
}
#${ROOT_ID} .tdg-acc-avatar img { width: 100%; height: 100%; object-fit: cover; }
#${ROOT_ID} .tdg-acc-email { font-size: 0.82rem; color: rgba(255,255,255,0.45); margin: 2px 0 0; }
#${ROOT_ID} .tdg-acc-portrait-grid {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 6px;
  margin-bottom: 12px;
}
#${ROOT_ID} .tdg-acc-portrait-choice {
  aspect-ratio: 1;
  min-width: 0;
  padding: 0;
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.16);
  background: rgba(0,0,0,0.4);
  cursor: pointer;
}
#${ROOT_ID} .tdg-acc-portrait-choice:hover,
#${ROOT_ID} .tdg-acc-portrait-choice.is-selected {
  border-color: #f0d878;
  box-shadow: 0 0 0 2px rgba(240,216,120,0.2);
}
#${ROOT_ID} .tdg-acc-portrait-choice img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
#${ROOT_ID} label.tdg-acc-field {
  display: block;
  margin-bottom: 12px;
}
#${ROOT_ID} label.tdg-acc-field span {
  display: block;
  font-size: 0.68rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.45);
  margin-bottom: 6px;
}
#${ROOT_ID} input.tdg-acc-input,
#${ROOT_ID} textarea.tdg-acc-input {
  width: 100%;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.16);
  background: rgba(0,0,0,0.4);
  color: #f5f5f0;
  padding: 10px 12px;
  font: inherit;
  outline: none;
}
#${ROOT_ID} input.tdg-acc-input:focus,
#${ROOT_ID} textarea.tdg-acc-input:focus {
  border-color: rgba(240, 216, 120, 0.55);
  box-shadow: 0 0 0 2px rgba(240, 216, 120, 0.15);
}
#${ROOT_ID} textarea.tdg-acc-input { resize: vertical; min-height: 72px; }
#${ROOT_ID} .tdg-acc-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}
#${ROOT_ID} .tdg-acc-primary,
#${ROOT_ID} .tdg-acc-secondary,
#${ROOT_ID} .tdg-acc-linkish {
  border-radius: 999px;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  padding: 10px 16px;
  border: 1px solid transparent;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
#${ROOT_ID} .tdg-acc-primary {
  background: #f0d878;
  color: #1a1408;
  border-color: #f0d878;
}
#${ROOT_ID} .tdg-acc-primary:hover { filter: brightness(1.06); }
#${ROOT_ID} .tdg-acc-primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  filter: none;
}
#${ROOT_ID} .tdg-acc-secondary {
  background: transparent;
  color: rgba(255,255,255,0.85);
  border-color: rgba(255,255,255,0.22);
}
#${ROOT_ID} .tdg-acc-secondary:hover {
  border-color: rgba(255,255,255,0.45);
  color: #fff;
}
#${ROOT_ID} .tdg-acc-linkish {
  background: transparent;
  color: rgba(240, 216, 120, 0.9);
  border: none;
  padding: 8px 4px;
  font-weight: 600;
}
#${ROOT_ID} .tdg-acc-linkish:hover { color: #f0d878; text-decoration: underline; }
#${ROOT_ID} .tdg-acc-msg { font-size: 0.85rem; margin: 8px 0 0; color: #9fe8d8; }
#${ROOT_ID} .tdg-acc-err { font-size: 0.85rem; margin: 8px 0 0; color: #f0a0a0; }
#${ROOT_ID} .tdg-acc-warn {
  border-radius: 10px;
  border: 1px solid rgba(240, 180, 60, 0.35);
  background: rgba(240, 180, 60, 0.1);
  color: #f5e6b8;
  padding: 10px 12px;
  font-size: 0.85rem;
  margin-bottom: 12px;
}
#${ROOT_ID} .tdg-acc-loading { color: rgba(255,255,255,0.55); margin: 0; }
@media (max-width: 640px) {
  #${ROOT_ID} .tdg-acc-btn { width: 40px; height: 40px; }
  #${ROOT_ID} .tdg-acc-portrait-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); }
}
`;

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function googleMarkSvg() {
    return `<svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l.1.1 6.2 5.2C39.2 37.3 44 32 44 24c0-1.2-.1-2.3-.4-3.5z"/></svg>`;
  }

  function guestIconSvg() {
    return `<svg class="tdg-acc-guest-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="3.5" stroke="#f0d878" stroke-width="1.6"/><path d="M5 19.5c1.8-3.2 4.1-4.5 7-4.5s5.2 1.3 7 4.5" stroke="#f0d878" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function syncNameInput(displayName) {
    const input = document.getElementById('online-name-input');
    if (!input || !displayName) return;
    input.value = displayName;
    // Signed-in players cannot rename themselves from the match screen.
    input.readOnly = true;
    input.classList.add('is-locked');
    input.setAttribute('aria-readonly', 'true');
    input.title = 'Change this in your account settings';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    window.dispatchEvent(
      new CustomEvent('tdg-account-updated', { detail: { displayName } }),
    );
  }

  async function fetchCsrf() {
    const res = await fetch('/api/auth/csrf', { credentials: 'include', cache: 'no-store' });
    if (!res.ok) throw new Error('Could not start auth');
    const data = await res.json();
    if (!data?.csrfToken) throw new Error('Missing CSRF token');
    return data.csrfToken;
  }

  async function postAuthForm(action, fields) {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = action;
    form.style.display = 'none';
    Object.entries(fields).forEach(([name, value]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
  }

  function mountRoot() {
    injectStyle();
    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.innerHTML = `
      <button type="button" class="tdg-acc-btn" id="tdg-acc-open" title="Account" aria-label="Open account settings" aria-haspopup="dialog" aria-expanded="false">
        ${guestIconSvg()}
      </button>
      <div class="tdg-acc-backdrop" id="tdg-acc-backdrop" hidden></div>
      <div class="tdg-acc-panel" id="tdg-acc-panel" role="dialog" aria-modal="true" aria-labelledby="tdg-acc-title" hidden>
        <div class="tdg-acc-head">
          <div>
            <p class="tdg-acc-eyebrow">Territory Game</p>
            <h2 class="tdg-acc-title" id="tdg-acc-title">Account</h2>
          </div>
          <button type="button" class="tdg-acc-close" id="tdg-acc-close" aria-label="Close">✕</button>
        </div>
        <div class="tdg-acc-body" id="tdg-acc-body">
          <p class="tdg-acc-loading">Loading…</p>
        </div>
      </div>
    `;

    const stage = document.getElementById('game-stage');
    (stage || document.body).appendChild(root);
    return root;
  }

  function setOpen(root, open) {
    const backdrop = root.querySelector('#tdg-acc-backdrop');
    const panel = root.querySelector('#tdg-acc-panel');
    const btn = root.querySelector('#tdg-acc-open');
    root.classList.toggle('open', open);
    if (backdrop) backdrop.hidden = !open;
    if (panel) panel.hidden = !open;
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function renderButton(root, user) {
    const btn = root.querySelector('#tdg-acc-open');
    if (!btn) return;
    if (user?.avatarUrl) {
      btn.innerHTML = `<img src="${escapeHtml(user.avatarUrl)}" alt="" referrerpolicy="no-referrer" />`;
    } else if (user?.displayName) {
      btn.innerHTML = `<span class="tdg-acc-initial">${escapeHtml(user.displayName.slice(0, 1).toUpperCase())}</span>`;
    } else {
      btn.innerHTML = guestIconSvg();
    }
  }

  function renderSignedOut(body, { googleConfigured }) {
    body.innerHTML = `
      <p class="tdg-acc-muted">Sign in with Google to save a display name, appear on the leaderboard, and keep your profile across matches.</p>
      ${
        googleConfigured
          ? ''
          : `<div class="tdg-acc-warn">Google sign-in is not configured on this server yet.</div>`
      }
      <div class="tdg-acc-actions">
        <button type="button" class="tdg-acc-primary" id="tdg-acc-signin" ${googleConfigured ? '' : 'disabled'}>
          ${googleMarkSvg()} Continue with Google
        </button>
        <a class="tdg-acc-secondary" href="/leaderboard">Leaderboard</a>
      </div>
      <p class="tdg-acc-err" id="tdg-acc-err" hidden></p>
    `;
  }

  function renderSignedIn(body, user) {
    const initial = escapeHtml((user.displayName || '?').slice(0, 1).toUpperCase());
    const avatar = user.avatarUrl
      ? `<div class="tdg-acc-avatar"><img src="${escapeHtml(user.avatarUrl)}" alt="" referrerpolicy="no-referrer" /></div>`
      : `<div class="tdg-acc-avatar">${initial}</div>`;
    const portraitChoices = CHARACTER_PORTRAITS.map((id) => {
      const url = `/TDG/portraits/${id}.webp`;
      const selected = user.avatarUrl === url ? ' is-selected' : '';
      const label = id.replace(/_/g, ' ');
      return `<button type="button" class="tdg-acc-portrait-choice${selected}" data-avatar-url="${url}" title="${escapeHtml(label)}" aria-label="Use ${escapeHtml(label)} as profile picture">
        <img src="${url}" alt="" loading="lazy" />
      </button>`;
    }).join('');
    body.innerHTML = `
      <div class="tdg-acc-row">
        ${avatar}
        <div>
          <strong>${escapeHtml(user.displayName || 'Player')}</strong>
          <p class="tdg-acc-email">${escapeHtml(user.email || '')}</p>
        </div>
      </div>
      <form id="tdg-acc-form">
        <label class="tdg-acc-field">
          <span>Display name</span>
          <input class="tdg-acc-input" id="tdg-acc-display" name="displayName" maxlength="40" required value="${escapeHtml(user.displayName || '')}" placeholder="Shown in matches &amp; leaderboard" />
        </label>
        <label class="tdg-acc-field">
          <span>Choose your character picture</span>
          <div class="tdg-acc-portrait-grid">${portraitChoices}</div>
        </label>
        <label class="tdg-acc-field">
          <span>Bio</span>
          <textarea class="tdg-acc-input" id="tdg-acc-bio" name="bio" maxlength="280" rows="3" placeholder="Optional short bio">${escapeHtml(user.bio || '')}</textarea>
        </label>
        <div class="tdg-acc-actions">
          <button type="submit" class="tdg-acc-primary" id="tdg-acc-save">Save profile</button>
          <button type="button" class="tdg-acc-secondary" id="tdg-acc-signout">Sign out</button>
          <a class="tdg-acc-linkish" href="/leaderboard">Leaderboard</a>
          <a class="tdg-acc-linkish" href="/account">Full account page</a>
        </div>
        <p class="tdg-acc-msg" id="tdg-acc-msg" hidden></p>
        <p class="tdg-acc-err" id="tdg-acc-err" hidden></p>
      </form>
    `;
  }

  async function loadProfile(root) {
    const body = root.querySelector('#tdg-acc-body');
    if (!body) return null;
    body.innerHTML = `<p class="tdg-acc-loading">Loading…</p>`;
    try {
      const res = await fetch('/api/account/profile', { credentials: 'include', cache: 'no-store' });
      const data = await res.json();
      const user = data?.authenticated && data.user ? data.user : null;
      renderButton(root, user);
      if (user) {
        renderSignedIn(body, user);
        syncNameInput(user.displayName);
      } else {
        renderSignedOut(body, { googleConfigured: !!data.googleConfigured });
      }
      return { user, googleConfigured: !!data.googleConfigured };
    } catch {
      body.innerHTML = `<p class="tdg-acc-err">Could not load account.</p>`;
      renderButton(root, null);
      return null;
    }
  }

  function wirePanel(root) {
    const body = root.querySelector('#tdg-acc-body');
    if (!body) return;

    body.addEventListener('click', async (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;

      if (t.closest('#tdg-acc-signin')) {
        const err = body.querySelector('#tdg-acc-err');
        try {
          if (err) {
            err.hidden = true;
            err.textContent = '';
          }
          const csrfToken = await fetchCsrf();
          await postAuthForm('/api/auth/signin/google', {
            csrfToken,
            callbackUrl: '/TDG',
          });
        } catch (ex) {
          if (err) {
            err.hidden = false;
            err.textContent = ex instanceof Error ? ex.message : 'Sign-in failed';
          }
        }
        return;
      }

      if (t.closest('#tdg-acc-signout')) {
        try {
          const csrfToken = await fetchCsrf();
          await postAuthForm('/api/auth/signout', {
            csrfToken,
            callbackUrl: '/TDG',
          });
        } catch {
          window.location.href = '/api/auth/signout?callbackUrl=' + encodeURIComponent('/TDG');
        }
        return;
      }

      const portraitChoice = t.closest('.tdg-acc-portrait-choice');
      if (portraitChoice) {
        const form = body.querySelector('#tdg-acc-form');
        const avatarUrl = portraitChoice.getAttribute('data-avatar-url') || '';
        if (form) form.dataset.avatarUrl = avatarUrl;
        body.querySelectorAll('.tdg-acc-portrait-choice').forEach((choice) => {
          choice.classList.toggle('is-selected', choice === portraitChoice);
        });
        const preview = body.querySelector('.tdg-acc-avatar');
        if (preview && avatarUrl) {
          preview.innerHTML = `<img src="${escapeHtml(avatarUrl)}" alt="" />`;
        }
      }
    });

    body.addEventListener('submit', async (e) => {
      if (!(e.target instanceof HTMLFormElement) || e.target.id !== 'tdg-acc-form') return;
      e.preventDefault();
      const saveBtn = body.querySelector('#tdg-acc-save');
      const msg = body.querySelector('#tdg-acc-msg');
      const err = body.querySelector('#tdg-acc-err');
      const displayName = body.querySelector('#tdg-acc-display')?.value?.trim() || '';
      const bio = body.querySelector('#tdg-acc-bio')?.value ?? '';
      const avatarUrl = e.target.dataset.avatarUrl || '';
      if (msg) {
        msg.hidden = true;
        msg.textContent = '';
      }
      if (err) {
        err.hidden = true;
        err.textContent = '';
      }
      if (saveBtn) saveBtn.disabled = true;
      try {
        const res = await fetch('/api/account/profile', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName,
            bio,
            ...(avatarUrl ? { avatarUrl } : {}),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Save failed');
        renderButton(root, data.user);
        syncNameInput(data.user?.displayName);
        if (msg) {
          msg.hidden = false;
          msg.textContent = 'Profile saved — this name is used for online matches.';
        }
        const nameEl = body.querySelector('.tdg-acc-row strong');
        if (nameEl && data.user?.displayName) nameEl.textContent = data.user.displayName;
      } catch (ex) {
        if (err) {
          err.hidden = false;
          err.textContent = ex instanceof Error ? ex.message : 'Save failed';
        }
      } finally {
        if (saveBtn) saveBtn.disabled = false;
      }
    });
  }

  function keepInsideFullscreen(root) {
    const reparent = () => {
      const fsEl =
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        null;
      const stage = document.getElementById('game-stage');
      const target = fsEl || stage || document.body;
      if (root.parentElement !== target) target.appendChild(root);
      // Native fullscreen only paints descendants of the fullscreen element.
      // Keep the game's feather cursor above this account overlay there too.
      const cursorTarget = fsEl || document.body;
      const feather = document.getElementById('live-feather-cursor');
      const glow = document.getElementById('live-feather-tip-glow');
      if (feather && feather.parentElement !== cursorTarget) cursorTarget.appendChild(feather);
      if (glow && glow.parentElement !== cursorTarget) cursorTarget.appendChild(glow);
    };
    document.addEventListener('fullscreenchange', reparent);
    document.addEventListener('webkitfullscreenchange', reparent);
    reparent();
  }

  function boot() {
    const root = mountRoot();
    const openBtn = root.querySelector('#tdg-acc-open');
    const closeBtn = root.querySelector('#tdg-acc-close');
    const backdrop = root.querySelector('#tdg-acc-backdrop');

    openBtn?.addEventListener('click', async () => {
      setOpen(root, true);
      await loadProfile(root);
    });
    closeBtn?.addEventListener('click', () => setOpen(root, false));
    backdrop?.addEventListener('click', () => setOpen(root, false));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && root.classList.contains('open')) setOpen(root, false);
    });

    wirePanel(root);
    keepInsideFullscreen(root);
    // Prefetch so the icon shows avatar when already signed in.
    loadProfile(root);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
