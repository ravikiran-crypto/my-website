(function () {
  'use strict';

  const STYLE_ID = 'app-ui-popups-style';
  const TOAST_HOST_ID = 'app-ui-toast-host';
  const DIALOG_OVERLAY_ID = 'app-ui-dialog-overlay';

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .app-ui-toast-host{position:fixed;top:18px;right:18px;z-index:2147483647;display:flex;flex-direction:column;gap:10px;max-width:min(420px,calc(100vw - 36px));}
      .app-ui-toast{background:var(--card-bg,#1e1f20);border:1px solid var(--border-color,#30363d);border-left-width:5px;border-radius:12px;padding:12px 14px;color:var(--text-main,#e3e3e3);box-shadow:0 12px 28px rgba(0,0,0,0.45);}
      .app-ui-toast-title{font-weight:800;margin:0 0 4px 0;font-size:13px;color:var(--text-main,#e3e3e3);}
      .app-ui-toast-msg{margin:0;font-size:12.5px;line-height:1.4;color:var(--text-secondary,#b4b4b4);white-space:pre-wrap;word-break:break-word;}
      .app-ui-toast-actions{margin-top:10px;display:flex;gap:8px;justify-content:flex-end;}
      .app-ui-btn{appearance:none;border-radius:8px;padding:8px 12px;border:1px solid var(--border-color,#30363d);background:transparent;color:var(--text-main,#e3e3e3);cursor:pointer;font-weight:700;font-size:12px;}
      .app-ui-btn-primary{background:var(--primary-blue,#4285F4);border-color:var(--primary-blue,#4285F4);color:white;}
      .app-ui-btn-danger{background:#f85149;border-color:#f85149;color:white;}
      .app-ui-btn:focus{outline:2px solid var(--primary-blue,#4285F4);outline-offset:2px;}

      .app-ui-dialog-overlay{position:fixed;inset:0;z-index:2147483646;display:none;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,0.55);}
      .app-ui-dialog{width:min(520px,calc(100vw - 48px));background:var(--card-bg,#1e1f20);border:1px solid var(--border-color,#30363d);border-radius:14px;box-shadow:0 16px 44px rgba(0,0,0,0.6);overflow:hidden;}
      .app-ui-dialog-header{padding:14px 16px;border-bottom:1px solid var(--border-color,#30363d);}
      .app-ui-dialog-title{margin:0;font-size:15px;font-weight:900;color:var(--text-main,#e3e3e3);}
      .app-ui-dialog-body{padding:14px 16px;color:var(--text-secondary,#b4b4b4);font-size:13px;line-height:1.45;white-space:pre-wrap;word-break:break-word;}
      .app-ui-dialog-input{width:100%;margin-top:12px;padding:10px 12px;border-radius:10px;border:1px solid var(--border-color,#30363d);background:var(--bg-dark,#131314);color:var(--text-main,#e3e3e3);font-weight:700;}
      .app-ui-dialog-footer{padding:12px 16px;border-top:1px solid var(--border-color,#30363d);display:flex;justify-content:flex-end;gap:10px;}
    `;
    document.head.appendChild(style);
  }

  function ensureToastHost() {
    let host = document.getElementById(TOAST_HOST_ID);
    if (!host) {
      host = document.createElement('div');
      host.id = TOAST_HOST_ID;
      host.className = 'app-ui-toast-host';
      document.body.appendChild(host);
    }
    return host;
  }

  function ensureDialogOverlay() {
    let overlay = document.getElementById(DIALOG_OVERLAY_ID);
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = DIALOG_OVERLAY_ID;
      overlay.className = 'app-ui-dialog-overlay';
      overlay.innerHTML = `
        <div class="app-ui-dialog" role="dialog" aria-modal="true" aria-labelledby="app-ui-dialog-title">
          <div class="app-ui-dialog-header">
            <h3 class="app-ui-dialog-title" id="app-ui-dialog-title">Notice</h3>
          </div>
          <div class="app-ui-dialog-body" id="app-ui-dialog-body"></div>
          <div class="app-ui-dialog-footer" id="app-ui-dialog-footer"></div>
        </div>
      `;
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          // backdrop click does nothing (explicit buttons only)
        }
      });
      document.body.appendChild(overlay);
    }
    return overlay;
  }

  function typeBorder(type) {
    switch (String(type || '').toLowerCase()) {
      case 'success':
        return '#4CAF50';
      case 'error':
        return '#f85149';
      case 'warning':
        return '#f0ad4e';
      default:
        return 'var(--primary-blue,#4285F4)';
    }
  }

  function toast(opts) {
    try {
      ensureStyle();
      const host = ensureToastHost();
      const type = opts?.type || 'info';
      const title = String(opts?.title || '');
      const message = String(opts?.message || '');
      const duration = typeof opts?.duration === 'number' ? opts.duration : 4200;

      const el = document.createElement('div');
      el.className = 'app-ui-toast';
      el.style.borderLeftColor = typeBorder(type);

      const titleEl = document.createElement('div');
      titleEl.className = 'app-ui-toast-title';
      titleEl.textContent = title || (type === 'error' ? 'Error' : type === 'success' ? 'Success' : 'Notice');

      const msgEl = document.createElement('p');
      msgEl.className = 'app-ui-toast-msg';
      msgEl.textContent = message;

      const actions = document.createElement('div');
      actions.className = 'app-ui-toast-actions';
      const closeBtn = document.createElement('button');
      closeBtn.className = 'app-ui-btn';
      closeBtn.textContent = 'Dismiss';
      closeBtn.addEventListener('click', () => {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      });
      actions.appendChild(closeBtn);

      el.appendChild(titleEl);
      el.appendChild(msgEl);
      el.appendChild(actions);

      host.appendChild(el);

      if (duration > 0) {
        setTimeout(() => {
          if (el && el.parentNode) el.parentNode.removeChild(el);
        }, duration);
      }
    } catch (_) {
      // As a last resort, do nothing.
    }
  }

  function showDialog({ title, message, input, okText, cancelText, type }) {
    ensureStyle();
    const overlay = ensureDialogOverlay();
    const dialog = overlay.querySelector('.app-ui-dialog');
    const titleEl = overlay.querySelector('#app-ui-dialog-title');
    const bodyEl = overlay.querySelector('#app-ui-dialog-body');
    const footerEl = overlay.querySelector('#app-ui-dialog-footer');

    if (dialog) {
      dialog.style.borderLeft = `5px solid ${typeBorder(type)}`;
    }

    titleEl.textContent = String(title || 'Notice');
    bodyEl.textContent = String(message || '');

    footerEl.innerHTML = '';

    let inputEl = null;
    if (input) {
      inputEl = document.createElement('input');
      inputEl.className = 'app-ui-dialog-input';
      inputEl.type = String(input.type || 'text');
      inputEl.placeholder = String(input.placeholder || '');
      inputEl.value = String(input.value || '');
      bodyEl.appendChild(inputEl);
    }

    overlay.style.display = 'flex';

    return new Promise((resolve) => {
      let cleanup = () => {
        overlay.style.display = 'none';
        footerEl.innerHTML = '';
        bodyEl.textContent = '';
      };

      const cancelBtn = cancelText
        ? (() => {
            const b = document.createElement('button');
            b.className = 'app-ui-btn';
            b.textContent = String(cancelText);
            b.addEventListener('click', () => {
              cleanup();
              resolve({ ok: false, value: null });
            });
            return b;
          })()
        : null;

      const okBtn = (() => {
        const b = document.createElement('button');
        const isDanger = String(type || '').toLowerCase() === 'error';
        b.className = `app-ui-btn ${isDanger ? 'app-ui-btn-danger' : 'app-ui-btn-primary'}`;
        b.textContent = String(okText || 'OK');
        b.addEventListener('click', () => {
          const val = inputEl ? inputEl.value : null;
          cleanup();
          resolve({ ok: true, value: val });
        });
        return b;
      })();

      if (cancelBtn) footerEl.appendChild(cancelBtn);
      footerEl.appendChild(okBtn);

      // Focus management
      setTimeout(() => {
        if (inputEl) inputEl.focus();
        else okBtn.focus();
      }, 0);

      const onKeyDown = (e) => {
        if (overlay.style.display !== 'flex') return;
        if (e.key === 'Escape' && cancelBtn) {
          e.preventDefault();
          cancelBtn.click();
        }
        if (e.key === 'Enter' && document.activeElement === inputEl) {
          e.preventDefault();
          okBtn.click();
        }
      };

      document.addEventListener('keydown', onKeyDown);
      const originalCleanup = cleanup;
      cleanup = () => {
        document.removeEventListener('keydown', onKeyDown);
        originalCleanup();
      };
    });
  }

  async function uiAlert(opts) {
    const title = typeof opts === 'string' ? 'Notice' : (opts?.title || 'Notice');
    const message = typeof opts === 'string' ? opts : (opts?.message || '');
    const type = typeof opts === 'string' ? 'info' : (opts?.type || 'info');
    await showDialog({ title, message, okText: 'OK', cancelText: null, type });
  }

  async function uiConfirm(opts) {
    const title = opts?.title || 'Confirm';
    const message = opts?.message || '';
    const okText = opts?.okText || 'Confirm';
    const cancelText = opts?.cancelText || 'Cancel';
    const type = opts?.type || 'warning';
    const result = await showDialog({ title, message, okText, cancelText, type });
    return !!result.ok;
  }

  async function uiPrompt(opts) {
    const title = opts?.title || 'Input Required';
    const message = opts?.message || '';
    const okText = opts?.okText || 'Continue';
    const cancelText = opts?.cancelText || 'Cancel';
    const type = opts?.type || 'info';

    const result = await showDialog({
      title,
      message,
      okText,
      cancelText,
      type,
      input: {
        type: opts?.inputType || 'text',
        placeholder: opts?.placeholder || '',
        value: opts?.value || ''
      }
    });

    if (!result.ok) return null;
    return String(result.value || '');
  }

  function ensureReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  ensureReady(() => {
    ensureStyle();
    // Pre-create containers to avoid layout shifts when first used
    ensureToastHost();
    ensureDialogOverlay();
  });

  window.appUI = window.appUI || {};
  window.appUI.toast = toast;
  window.appUI.alert = uiAlert;
  window.appUI.confirm = uiConfirm;
  window.appUI.prompt = uiPrompt;
})();
