// Intro: 自动化发布脚本
// Tag: 网页脚本

// ==UserScript==
// @name         DFCFW DevOps Auto Publish v3-gpt
// @namespace    codex
// @version      0.2.3
// @description  自动串联研发交付流程、生产班次、审批、灰度与 Rolling 发布
// @match        https://devops.dfcfw.com/devops/cicd/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  
  const CONFIG_KEY = '__dfcfw_devops_auto_publish_config__';
  const RUN_KEY = '__dfcfw_devops_auto_publish_run__';
  const PANEL_ID = 'dfcfw-devops-auto-publish-panel';
  const STYLE_ID = 'dfcfw-devops-auto-publish-style';
  const POLL_MS = 1500;
  const ACTION_COOLDOWN_MS = 4000;
  const WAIT_COOLDOWN_MS = 15000;
  const MAX_LOGS = 120;
  const DEFAULT_APP_NAMES = ['fd_groupchat_comp','fd_mgubatopic2025'];

  const DEFAULT_CONFIG = {
    appNames: [...DEFAULT_APP_NAMES],
    appName: DEFAULT_APP_NAMES[0],
    taskKeyword: '',
    approvalSummary: '',
    scheduleNamePrefix: '发布班次',
    autoMergeMr: true,
    allowDirectPush: true,
  };

  const ROUTES = {
    deliveryProcess: '/devops/cicd/deliveryProcess',
    deliveryProcessDetail: '/devops/cicd/deliveryProcessDetail',
    deliveryScheduleDetail: '/devops/cicd/deliveryScheduleDetail',
    releasePlanApp: '/devops/cicd/releasePlanApp',
  };

  const CONFIRM_TEXTS = ['知道了', '我知道了', '确 定', '确定', '是', '确认', '好的', '关闭'];
  const CLICKABLE_SELECTOR = [
    'button',
    '[role="button"]',
    'a',
    '.ant-btn',
    '.ant-dropdown-menu-item',
    '.ant-select-item-option',
    '.ant-radio-wrapper',
    '.ant-switch',
    '.ant-pagination-next',
    '.ant-pagination-prev',
    '[role="menuitem"]',
    '[role="option"]',
  ].join(',');

  const state = {
    config: loadConfig(),
    run: loadRun(),
    ui: {
      panel: null,
      status: null,
      appName: null,
      taskKeyword: null,
      approvalSummary: null,
      startBtn: null,
      stopBtn: null,
      clearBtn: null,
      log: null,
    },
    ticking: false,
  };

  function loadConfig() {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      return normalizeConfig(raw ? JSON.parse(raw) : {});
    } catch (error) {
      console.warn('[DevOpsAutoPublish] loadConfig failed:', error);
      return normalizeConfig({});
    }
  }

  function loadRun() {
    try {
      const raw = localStorage.getItem(RUN_KEY);
      if (!raw) {
        return freshRunState(false);
      }
      return { ...freshRunState(false), ...JSON.parse(raw) };
    } catch (error) {
      console.warn('[DevOpsAutoPublish] loadRun failed:', error);
      return freshRunState(false);
    }
  }

  function freshRunState(active) {
    return {
      active: !!active,
      startedAt: active ? Date.now() : 0,
      appName: '',
      taskKeyword: '',
      approvalSummary: '',
      pipelineId: '',
      createdFlowName: '',
      scheduleName: '',
      scheduleLinked: false,
      enteredSchedule: false,
      releaseInitialized: false,
      releasePlanEntered: false,
      approvalSubmitted: false,
      approvalApproved: false,
      grayReleased: false,
      grayVerified: false,
      rollingReleased: false,
      rollingVerified: false,
      rollbackTagHandled: false,
      stage200BaselineTriggerTime: '',
      stage200BaselineCompileVersion: '',
      stage200ObservedTriggerTime: '',
      stage200ObservedCompileVersion: '',
      stage200NewRunObserved: false,
      finished: false,
      lastStatus: '待命',
      actions: {},
      logs: [],
    };
  }

  function normalizeAppNames(appNames, fallbackAppName) {
    const list = Array.isArray(appNames) ? appNames : [];
    const next = list
      .map((item) => String(item || '').trim())
      .filter(Boolean);
    const fallback = String(fallbackAppName || '').trim();
    if (fallback && !next.includes(fallback)) {
      next.unshift(fallback);
    }
    if (!next.length) {
      next.push(...DEFAULT_APP_NAMES);
    }
    return Array.from(new Set(next));
  }

  function normalizeConfig(config) {
    const next = { ...DEFAULT_CONFIG, ...(config || {}) };
    next.appName = String(next.appName || '').trim();
    next.taskKeyword = String(next.taskKeyword || '').trim();
    next.approvalSummary = String(next.approvalSummary || '').trim();
    next.appNames = normalizeAppNames(next.appNames, next.appName);
    if (!next.appName || !next.appNames.includes(next.appName)) {
      next.appName = next.appNames[0] || DEFAULT_APP_NAMES[0];
    }
    return next;
  }

  function saveConfig() {
    state.config = normalizeConfig(state.config);
    localStorage.setItem(CONFIG_KEY, JSON.stringify(state.config));
  }

  function saveRun() {
    localStorage.setItem(RUN_KEY, JSON.stringify(state.run));
    renderPanel();
  }

  function resetRun(active) {
    const next = freshRunState(active);
    if (active) {
      next.appName = (state.config.appName || '').trim();
      next.taskKeyword = (state.config.taskKeyword || '').trim();
      next.approvalSummary = (state.config.approvalSummary || '').trim();
    }
    state.run = next;
    saveRun();
  }

  function timestamp() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  function log(message) {
    const line = `[${timestamp()}] ${message}`;
    state.run.logs = [...(state.run.logs || []), line].slice(-MAX_LOGS);
    state.run.lastStatus = message;
    saveRun();
  }

  function setStatus(message) {
    if (state.run.lastStatus !== message) {
      log(message);
      return;
    }
    renderPanel();
  }

  function syncControlValue(element, value) {
    if (!element) return;
    if (document.activeElement === element && element.tagName !== 'SELECT') {
      return;
    }
    const next = String(value || '');
    if (element.value !== next) {
      element.value = next;
    }
  }

  function renderPanel() {
    ensurePanel();
    if (!state.ui.panel) {
      return;
    }
    renderAppNameOptions();
    syncControlValue(state.ui.appName, state.config.appName || '');
    syncControlValue(state.ui.taskKeyword, state.config.taskKeyword || '');
    syncControlValue(state.ui.approvalSummary, state.config.approvalSummary || '');
    state.ui.status.textContent = state.run.active
      ? `运行中: ${state.run.lastStatus || '处理中'}`
      : `已停止: ${state.run.lastStatus || '待命'}`;
    state.ui.startBtn.disabled = state.run.active;
    state.ui.stopBtn.disabled = !state.run.active;
    state.ui.log.textContent = (state.run.logs || []).join('\n');
    state.ui.log.scrollTop = state.ui.log.scrollHeight;
  }

  function ensurePanel() {
    if (document.getElementById(STYLE_ID)) {
      state.ui.panel = document.getElementById(PANEL_ID);
      return;
    }

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID} {
        position: fixed;
        left: 16px;
        bottom: 16px;
        z-index: 999999;
        width: 340px;
        background: rgba(17, 24, 39, 0.96);
        color: #f9fafb;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 14px;
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35);
        font: 12px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        overflow: hidden;
      }
      #${PANEL_ID} * { box-sizing: border-box; }
      #${PANEL_ID} .dap-header { padding: 12px 14px 8px; font-size: 14px; font-weight: 700; }
      #${PANEL_ID} .dap-body { padding: 0 14px 14px; }
      #${PANEL_ID} .dap-row { margin-bottom: 10px; }
      #${PANEL_ID} .dap-label { display: block; margin-bottom: 4px; color: #cbd5e1; }
      #${PANEL_ID} input,
      #${PANEL_ID} select {
        width: 100%;
        border: 1px solid rgba(255, 255, 255, 0.18);
        background: rgba(255, 255, 255, 0.08);
        color: #fff;
        padding: 8px 10px;
        border-radius: 8px;
        outline: none;
      }
      #${PANEL_ID} input:focus,
      #${PANEL_ID} select:focus { border-color: #60a5fa; }
      #${PANEL_ID} .dap-actions { display: flex; gap: 8px; margin: 10px 0; }
      #${PANEL_ID} button {
        border: 0;
        border-radius: 8px;
        padding: 8px 10px;
        cursor: pointer;
        color: #fff;
        background: #2563eb;
      }
      #${PANEL_ID} button[disabled] { cursor: not-allowed; opacity: 0.45; }
      #${PANEL_ID} .dap-stop { background: #dc2626; }
      #${PANEL_ID} .dap-clear { background: #475569; }
      #${PANEL_ID} .dap-status {
        padding: 8px 10px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.08);
        color: #e2e8f0;
        min-height: 36px;
      }
      #${PANEL_ID} pre {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        max-height: 180px;
        overflow: auto;
        padding: 10px;
        border-radius: 8px;
        background: rgba(2, 6, 23, 0.72);
        color: #93c5fd;
      }
      #${PANEL_ID} .dap-tip { color: #94a3b8; margin-top: 8px; }
    `;
    document.documentElement.appendChild(style);

    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="dap-header">DevOps 自动发布</div>
      <div class="dap-body">
        <div class="dap-row">
          <label class="dap-label">项目名</label>
          <select data-role="app-name"></select>
        </div>
        <div class="dap-row">
          <label class="dap-label">任务关键字（可空）</label>
          <input data-role="task-keyword" placeholder="例如 某个需求标题片段" />
        </div>
        <div class="dap-row">
          <label class="dap-label">审批摘要（可空）</label>
          <input data-role="approval-summary" placeholder="为空时默认填今天日期" />
        </div>
        <div class="dap-actions">
          <button data-role="start">开始</button>
          <button class="dap-stop" data-role="stop">停止</button>
          <button class="dap-clear" data-role="clear">清日志</button>
        </div>
        <div class="dap-row dap-status" data-role="status"></div>
        <pre data-role="log"></pre>
        <div class="dap-tip">项目列表使用数组配置。审批摘要不填时，脚本会自动使用当天日期。任务关键字不填时，脚本不会替你随机选任务。</div>
      </div>
    `;
    document.documentElement.appendChild(panel);

    state.ui.panel = panel;
    state.ui.status = panel.querySelector('[data-role="status"]');
    state.ui.appName = panel.querySelector('[data-role="app-name"]');
    state.ui.taskKeyword = panel.querySelector('[data-role="task-keyword"]');
    state.ui.approvalSummary = panel.querySelector('[data-role="approval-summary"]');
    state.ui.startBtn = panel.querySelector('[data-role="start"]');
    state.ui.stopBtn = panel.querySelector('[data-role="stop"]');
    state.ui.clearBtn = panel.querySelector('[data-role="clear"]');
    state.ui.log = panel.querySelector('[data-role="log"]');

    state.ui.appName.addEventListener('change', () => {
      state.config.appName = state.ui.appName.value.trim();
      saveConfig();
    });
    state.ui.taskKeyword.addEventListener('change', () => {
      state.config.taskKeyword = state.ui.taskKeyword.value.trim();
      saveConfig();
    });
    state.ui.approvalSummary.addEventListener('change', () => {
      state.config.approvalSummary = state.ui.approvalSummary.value.trim();
      saveConfig();
    });
    state.ui.startBtn.addEventListener('click', () => {
      state.config.appName = state.ui.appName.value.trim();
      state.config.taskKeyword = state.ui.taskKeyword.value.trim();
      state.config.approvalSummary = state.ui.approvalSummary.value.trim();
      saveConfig();
      if (!state.config.appName) {
        alert('请先选择项目名');
        return;
      }
      resetRun(true);
      log(`开始自动发布，项目: ${state.run.appName}`);
      tick();
    });
    state.ui.stopBtn.addEventListener('click', () => {
      state.run.active = false;
      saveRun();
      log('已手动停止');
    });
    state.ui.clearBtn.addEventListener('click', () => {
      state.run.logs = [];
      saveRun();
    });
  }

  function renderAppNameOptions() {
    const select = state.ui.appName;
    if (!select) return;
    const appNames = normalizeAppNames(state.config.appNames, state.config.appName);
    const optionKey = appNames.join('\n');
    if (select.dataset.optionKey !== optionKey) {
      select.innerHTML = appNames
        .map((appName) => `<option value="${escapeHtml(appName)}" style="background:#292929;">${escapeHtml(appName)}</option>`)
        .join('');
      select.dataset.optionKey = optionKey;
    }
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ---------- DOM helpers ----------

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.from((root || document).querySelectorAll(selector));
  }

  function isVisible(element) {
    if (!element || !element.isConnected) {
      return false;
    }
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function isDisabled(element) {
    if (!element) {
      return true;
    }
    return (
      element.disabled ||
      element.getAttribute('aria-disabled') === 'true' ||
      /\bdisabled\b/.test(element.className || '') ||
      /\bant-btn-loading\b/.test(element.className || '') ||
      /\bant-pagination-disabled\b/.test(element.className || '')
    );
  }

  function norm(text) {
    return String(text || '').replace(/\s+/g, '').trim();
  }

  function textOf(element) {
    if (!element) {
      return '';
    }
    return (element.innerText || element.textContent || '').trim();
  }

  function ownText(el) {
    if (!el) return '';
    return Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent)
      .join('')
      .trim();
  }

  function textMatch(element, expected, exact) {
    const actual = norm(textOf(element));
    const want = norm(expected);
    return exact ? actual === want : actual.includes(want);
  }

  function getVisibleDialogs() {
    const selectors = ['[role="dialog"]', '.ant-modal', '.ant-modal-wrap', '.ant-drawer'];
    return qsa(selectors.join(','))
      .filter(isVisible)
      .sort((a, b) => {
        const za = Number(window.getComputedStyle(a).zIndex || 0);
        const zb = Number(window.getComputedStyle(b).zIndex || 0);
        return za - zb;
      });
  }

  function getTopDialog() {
    const dialogs = getVisibleDialogs();
    return dialogs.length ? dialogs[dialogs.length - 1] : null;
  }

  function findDialogByText(text) {
    const want = norm(text);
    const dialogs = getVisibleDialogs().slice().reverse();
    return dialogs.find((dialog) => norm(textOf(dialog)).includes(want)) || null;
  }

  function scrollIntoView(element) {
    if (!element) return;
    try {
      element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    } catch (_) {
      element.scrollIntoView();
    }
  }

  function fireInputEvents(element) {
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function setInputValue(element, value) {
    if (!element) return false;
    const proto = Object.getPrototypeOf(element);
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
    if (descriptor && descriptor.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }
    fireInputEvents(element);
    return true;
  }

  function clickElement(element) {
    if (!element || isDisabled(element)) {
      return false;
    }
    scrollIntoView(element);
    element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    element.click();
    return true;
  }

  async function wait(ms) {
    await new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  async function waitFor(checker, timeoutMs, intervalMs) {
    const started = Date.now();
    const interval = intervalMs || 300;
    while (Date.now() - started < timeoutMs) {
      const value = await checker();
      if (value) return value;
      await wait(interval);
    }
    return null;
  }

  function canAct(key, cooldownMs) {
    const at = state.run.actions && state.run.actions[key];
    return !at || Date.now() - at >= (cooldownMs || ACTION_COOLDOWN_MS);
  }

  function markActed(key) {
    state.run.actions = state.run.actions || {};
    state.run.actions[key] = Date.now();
    saveRun();
  }

  async function actOnce(key, action, cooldownMs) {
    if (!canAct(key, cooldownMs)) {
      return false;
    }
    const done = await action();
    if (done !== false) {
      markActed(key);
      return true;
    }
    return false;
  }

  function allVisibleInputs(root) {
    return qsa('input, textarea', root).filter(isVisible);
  }

  function findInputByPlaceholder(root, placeholder) {
    return (
      allVisibleInputs(root).find(
        (input) => norm(input.getAttribute('placeholder')) === norm(placeholder),
      ) || null
    );
  }

  function findInputsByPlaceholder(root, placeholder) {
    const want = norm(placeholder);
    return allVisibleInputs(root).filter((input) =>
      norm(input.getAttribute('placeholder')).includes(want),
    );
  }

  function findClickableByText(texts, root, options) {
    const list = Array.isArray(texts) ? texts : [texts];
    const exact = !!(options && options.exact);
    const selector = (options && options.selector) || CLICKABLE_SELECTOR;
    const candidates = qsa(selector, root).filter(isVisible);
    for (const expected of list) {
      const match = candidates.find((candidate) => textMatch(candidate, expected, exact));
      if (match) return match;
    }
    return null;
  }

  function findLastClickableByText(texts, root, options) {
    const list = Array.isArray(texts) ? texts : [texts];
    const exact = !!(options && options.exact);
    const selector = (options && options.selector) || CLICKABLE_SELECTOR;
    const candidates = qsa(selector, root).filter(isVisible);
    for (let index = candidates.length - 1; index >= 0; index -= 1) {
      const candidate = candidates[index];
      if (list.some((expected) => textMatch(candidate, expected, exact))) {
        return candidate;
      }
    }
    return null;
  }

  function findPageClickableByText(texts, options) {
    const list = Array.isArray(texts) ? texts : [texts];
    const exact = !!(options && options.exact);
    const selector = (options && options.selector) || CLICKABLE_SELECTOR;
    const root = (options && options.root) || document;
    const candidates = qsa(selector, root).filter((candidate) => {
      if (!isVisible(candidate)) return false;
      if (candidate.closest('.ant-modal, .ant-modal-wrap, [role="dialog"], .ant-drawer')) {
        return false;
      }
      return true;
    });
    for (const expected of list) {
      const match = candidates.find((candidate) => textMatch(candidate, expected, exact));
      if (match) return match;
    }
    return null;
  }

  function findRowByText(root, expected) {
    const rows = qsa('tr, [role="row"]', root).filter(isVisible);
    return rows.find((row) => norm(textOf(row)).includes(norm(expected))) || null;
  }

  function parseQuery() {
    return new URLSearchParams(window.location.search);
  }

  function getPipelineIdFromUrl() {
    const params = parseQuery();
    return params.get('PipelineID') || state.run.pipelineId || '';
  }

  function getDateText() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function getApprovalSummaryText() {
    const summary =
      (state.run.approvalSummary || state.config.approvalSummary || '').trim();
    return summary || getDateText();
  }

  function getCompactDateTime() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${y}${m}${d}${hh}${mm}${ss}`;
  }

  function makeFlowName() {
    return `研发交付流程-${state.run.appName}-${getCompactDateTime()}`;
  }

  function makeScheduleName() {
    const prefix = state.config.scheduleNamePrefix || '发布班次';
    return `${prefix}-${state.run.appName}-${getCompactDateTime()}`;
  }

  // ---------- Ant Design specific helpers (NEW) ----------

  // Find a .ant-select inside .ant-form-item with the given label text.
  // Matches the label by its own text node (so "Merge Branch" doesn't match
  // a wrapper that contains it together with other text).
  function findFormSelectByLabel(text, root) {
    const want = norm(text);
    const scope = root || document;
    const labels = qsa('.ant-form-item-label label', scope).filter(isVisible);
    const label = labels.find((l) => {
      const own = norm(ownText(l));
      return own === want || own === want + ':' || own === want + '：';
    });
    if (!label) return null;
    const formItem = label.closest('.ant-form-item');
    return formItem ? formItem.querySelector('.ant-select') : null;
  }

  // Read the displayed selection text from an ant-select element.
  function getSelectValue(select) {
    if (!select) return '';
    const item = select.querySelector('.ant-select-selection-item');
    if (item) {
      return (item.getAttribute('title') || item.innerText || '').trim();
    }
    return '';
  }

  // Click the selector portion of an ant-select to toggle its dropdown.
  async function openAntSelect(select) {
    if (!select) return false;
    const sel = select.querySelector('.ant-select-selector') || select;
    scrollIntoView(sel);
    sel.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    sel.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    sel.click();
    // Wait for the visible (non-hidden) dropdown attached to body
    const dropdown = await waitFor(() => {
      const candidates = qsa('.ant-select-dropdown').filter((d) => {
        if (d.classList.contains('ant-select-dropdown-hidden')) return false;
        return isVisible(d);
      });
      return candidates[candidates.length - 1] || null;
    }, 4000, 150);
    return dropdown || null;
  }

  // Close any open select dropdown.
  function closeAllSelects() {
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    document.body.click();
  }

  // Pick a switch inside a form item identified by its label.
  function findSwitchByLabel(root, labelText) {
    const formItem = qsa('.ant-form-item', root).find((fi) => {
      const lbl = fi.querySelector('.ant-form-item-label label');
      if (!lbl || !isVisible(lbl)) return false;
      return norm(ownText(lbl)) === norm(labelText);
    });
    if (formItem) {
      const sw = formItem.querySelector('[role="switch"], .ant-switch');
      if (sw) return sw;
    }
    // Fallback: search proximity by walking up from switches.
    const want = norm(labelText);
    const switches = qsa('[role="switch"], .ant-switch', root).filter(isVisible);
    for (const target of switches) {
      let current = target;
      let depth = 0;
      while (current && current !== root && depth < 7) {
        if (norm(textOf(current)).includes(want)) return target;
        current = current.parentElement;
        depth += 1;
      }
    }
    return null;
  }

  function switchChecked(element) {
    if (!element) return false;
    if (element.getAttribute('aria-checked')) {
      return element.getAttribute('aria-checked') === 'true';
    }
    return (
      /\bchecked\b/.test(element.className || '') ||
      /\bant-switch-checked\b/.test(element.className || '')
    );
  }

  async function setSwitch(root, labelText, checked) {
    const target = findSwitchByLabel(root, labelText);
    if (!target) return false;
    const current = switchChecked(target);
    if (current === checked) return true;
    clickElement(target);
    await wait(300);
    const latest = findSwitchByLabel(root, labelText) || target;
    return switchChecked(latest) === checked;
  }

  function currentPath() {
    return window.location.pathname;
  }

  function onRoute(path) {
    return currentPath() === path;
  }

  function bodyText() {
    return textOf(document.body);
  }

  function bodyHas(text) {
    return norm(bodyText()).includes(norm(text));
  }

  function extractReleasePlanHref() {
    const link = qsa('a', document).find((anchor) => {
      if (!isVisible(anchor)) return false;
      const href = anchor.getAttribute('href') || '';
      return href.includes('/devops/cicd/releasePlanApp');
    });
    return link ? link.href : '';
  }

  function extractScheduleDetailHrefByName(scheduleName) {
    if (!scheduleName) return '';
    const links = qsa('a[href*="/devops/cicd/deliveryScheduleDetail"]', document).filter(
      (anchor) => {
        if (!isVisible(anchor)) return false;
        const scope = anchor.closest(
          'tr, [role="row"], [role="dialog"], .ant-modal-body, .ant-card, .ant-table-wrapper, .ant-descriptions, .ant-space',
        );
        return norm(textOf(scope || anchor)).includes(norm(scheduleName));
      },
    );
    return links.length ? links[links.length - 1].href : '';
  }

  function isReleasePlanComplete() {
    const appName = state.run.appName || state.config.appName || '';
    if (!appName) return false;
    return norm(bodyText()).includes(norm(`完成 ${appName}`));
  }

  function findPromoteToProductionTrigger() {
    return findPageClickableByText(['推进到生产', '推进到生产发布', '进入生产发布']);
  }

  function isStage200ReadyForProduction() {
    const promoteBtn = findPromoteToProductionTrigger();
    if (promoteBtn && !isDisabled(promoteBtn)) {
      return true;
    }
    if (bodyHas('任务完成') && bodyHas('发布详情') && !bodyHas('取消编译')) {
      return true;
    }
    return (
      !bodyHas('取消编译') &&
      ['部署成功', '发布成功', '任务成功', '执行成功'].some((text) => bodyHas(text))
    );
  }

  function findSubmitApprovalTrigger() {
    return findPageClickableByText('发布生产需要提交审批');
  }

  function findApprovalRequestDialog() {
    const dialogs = getVisibleDialogs().slice().reverse();
    return (
      dialogs.find((dialog) => {
        const dialogText = norm(textOf(dialog));
        if (!dialogText) return false;
        const submitBtn = findClickableByText(
          ['提 交 审 批', '提交审批', '提 交', '提交', '确 定', '确定'],
          dialog,
          { exact: false },
        );
        if (!submitBtn) return false;
        const hasFormHints = ['摘要', '功能与需求', '需求与功能', '描述'].some((hint) =>
          dialogText.includes(norm(hint)),
        );
        return hasFormHints || allVisibleInputs(dialog).length >= 2;
      }) || null
    );
  }

  function chooseRadioInRow(row) {
    if (!row) return false;
    const radio = qs('input[type="radio"], [role="radio"], .ant-radio-wrapper', row);
    if (!radio) return false;
    return clickElement(radio.closest('label') || radio);
  }

  // ---------- Page: deliveryProcess ----------

  async function tryCreateFlowDialog() {
    const dialog = findDialogByText('新建常规研发交付流程');
    if (dialog) return dialog;
    const createBtn = findClickableByText('创建研发交付流程');
    if (!createBtn) {
      setStatus('等待主页面出现"创建研发交付流程"按钮');
      return null;
    }
    if (clickElement(createBtn)) {
      setStatus('已打开创建流程弹窗');
      await wait(1200);
    }
    return findDialogByText('新建常规研发交付流程');
  }

  async function fillCreateFlowDialog(dialog) {
    const nameInput = findInputByPlaceholder(dialog, '请输入') || allVisibleInputs(dialog)[0] || null;
    if (nameInput && !textOf(nameInput) && !nameInput.value) {
      const flowName = makeFlowName();
      setInputValue(nameInput, flowName);
      state.run.createdFlowName = flowName;
      saveRun();
      await wait(300);
    }

    await setSwitch(dialog, '提交MR后自动合并', !!state.config.autoMergeMr);
    await wait(200);
    await setSwitch(dialog, '允许Project/Release分支直接Push', !!state.config.allowDirectPush);
    await wait(200);

    if (state.run.taskKeyword) {
      const selectedMarks = norm(textOf(dialog)).match(/已选：(\d+)条/g) || [];
      const taskAlreadySelected = selectedMarks.some((item) => item.includes('1条'));
      if (!taskAlreadySelected) {
        const taskSearch = findInputByPlaceholder(dialog, '搜索需求/任务');
        if (taskSearch) {
          setInputValue(taskSearch, state.run.taskKeyword);
          taskSearch.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
          taskSearch.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
          await wait(1200);
        }
        const taskRow = findRowByText(dialog, state.run.taskKeyword);
        if (taskRow) {
          const selectBtn = findClickableByText('选择', taskRow);
          if (selectBtn) {
            clickElement(selectBtn);
            await wait(1000);
          }
        }
      }
    }

    const appFound = await ensureAppSelected(dialog, state.run.appName);
    if (!appFound) {
      state.run.active = false;
      saveRun();
      log(`未找到项目: ${state.run.appName}`);
      alert(`未找到项目 ${state.run.appName}，脚本已停止。`);
      return false;
    }

    const createBtn = findClickableByText(['创 建', '创建'], dialog);
    if (!createBtn) {
      setStatus('等待创建按钮可点击');
      return false;
    }
    clickElement(createBtn);
    setStatus('已点击创建，等待跳转到流程详情');
    return true;
  }

  async function ensureAppSelected(dialog, appName) {
    const visibleRow = findRowByText(dialog, appName);
    if (visibleRow) {
      const btn = findClickableByText('选择', visibleRow);
      if (btn) {
        clickElement(btn);
        await wait(800);
      }
      return true;
    }

    const appSearch = findInputByPlaceholder(dialog, '搜索应用');
    if (appSearch) {
      setInputValue(appSearch, appName);
      appSearch.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      appSearch.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
      await wait(1200);
      const searchedRow = findRowByText(dialog, appName);
      if (searchedRow) {
        const btn = findClickableByText('选择', searchedRow);
        if (btn) {
          clickElement(btn);
          await wait(800);
        }
        return true;
      }
    }

    if (appSearch) {
      setInputValue(appSearch, '');
      await wait(500);
    }

    for (let page = 0; page < 12; page += 1) {
      const row = findRowByText(dialog, appName);
      if (row) {
        const btn = findClickableByText('选择', row);
        if (btn) {
          clickElement(btn);
          await wait(800);
        }
        return true;
      }
      const nextPager = qsa('.ant-pagination-next, li.ant-pagination-next', dialog)
        .filter(isVisible)
        .filter((item) => !isDisabled(item));
      const lastNext = nextPager[nextPager.length - 1] || null;
      if (!lastNext) break;
      clickElement(lastNext.querySelector('button') || lastNext);
      await wait(1200);
    }
    return false;
  }

  async function handleDeliveryProcessPage() {
    if (state.run.pipelineId) {
      setStatus('流程已创建，等待跳转到详情页');
      return;
    }
    const dialog = await tryCreateFlowDialog();
    if (!dialog) return;
    await actOnce('create-flow-submit', () => fillCreateFlowDialog(dialog), WAIT_COOLDOWN_MS);
  }

  // ---------- Page: deliveryProcessDetail stage=200 ----------

  function getStage200Selections() {
    return {
      mergeBranch: getSelectValue(findFormSelectByLabel('Merge Branch')),
      intoBranch: getSelectValue(findFormSelectByLabel('Into')),
    };
  }

  function isReleaseBranchName(value) {
    return /^release_[a-z0-9_:-]+$/i.test(String(value || '').trim());
  }

  function isValidMergeBranch(value) {
    const text = String(value || '').trim();
    return !!text && text !== 'Merge Branch' && !/^Into[:：]?$/i.test(text) && text !== 'MR并部署';
  }

  function getStage200RunSummary() {
    const text = bodyText();
    const triggerMatch = text.match(/触发时间[:：]\s*([0-9-]{4}-[0-9-]{2}-[0-9-]{2}\s+[0-9:]{8})/);
    const compileMatch = text.match(/编译版本[:：]\s*([0-9A-Za-z_()\-]+)/);
    return {
      triggerTime: triggerMatch ? triggerMatch[1].trim() : '',
      compileVersion: compileMatch ? compileMatch[1].trim() : '',
    };
  }

  function rememberStage200Baseline(summary) {
    if (!state.run.stage200BaselineTriggerTime && summary.triggerTime) {
      state.run.stage200BaselineTriggerTime = summary.triggerTime;
    }
    if (!state.run.stage200BaselineCompileVersion && summary.compileVersion) {
      state.run.stage200BaselineCompileVersion = summary.compileVersion;
    }
    saveRun();
  }

  function hasStage200NewRunStarted(summary) {
    const triggerChanged =
      !!summary.triggerTime &&
      !!state.run.stage200BaselineTriggerTime &&
      summary.triggerTime !== state.run.stage200BaselineTriggerTime;
    const compileChanged =
      !!summary.compileVersion &&
      !!state.run.stage200BaselineCompileVersion &&
      summary.compileVersion !== state.run.stage200BaselineCompileVersion;
    return triggerChanged || compileChanged;
  }

  // NEW: pick the first non-empty option from Merge Branch's dropdown.
  async function selectFirstMergeBranch() {
    if (isValidMergeBranch(getSelectValue(findFormSelectByLabel('Merge Branch')))) {
      return true;
    }
    const select = findFormSelectByLabel('Merge Branch');
    if (!select) {
      setStatus('找不到 Merge Branch 下拉');
      return false;
    }
    const dropdown = await openAntSelect(select);
    if (!dropdown) {
      setStatus('Merge Branch 下拉未打开');
      return false;
    }
    // Wait for options to load
    const option = await waitFor(() => {
      const opts = qsa('.ant-select-item-option', dropdown).filter((o) => {
        if (!isVisible(o)) return false;
        if (o.classList.contains('ant-select-item-option-disabled')) return false;
        const t = textOf(o);
        return !!t && t !== '暂无数据' && t !== '请选择';
      });
      return opts[0] || null;
    }, 4000, 200);
    if (!option) {
      closeAllSelects();
      setStatus('Merge Branch 没有可选项');
      return false;
    }
    clickElement(option);
    await wait(600);
    return isValidMergeBranch(getSelectValue(findFormSelectByLabel('Merge Branch')));
  }

  // NEW: open Into dropdown, then click the "新建Release分支" entry that lives
  // in the dropdown header (the div that wraps the .anticon-plus).
  async function createNewReleaseBranchFromInto() {
    const select = findFormSelectByLabel('Into');
    if (!select) {
      setStatus('找不到 Into 下拉');
      return false;
    }
    const previous = getSelectValue(select);
    const dropdown = await openAntSelect(select);
    if (!dropdown) {
      setStatus('Into 下拉未打开');
      return false;
    }

    // Find the "新建Release分支" entry inside the open dropdown.
    let newBranchEntry = qsa('*', dropdown).find((el) => {
      if (!isVisible(el)) return false;
      const t = norm(ownText(el));
      return t === '新建Release分支' || t === '+新建Release分支';
    });
    if (!newBranchEntry) {
      const plus = qsa('.anticon-plus', dropdown).find(isVisible);
      if (plus) {
        let cur = plus.parentElement;
        for (let i = 0; i < 4 && cur && cur !== dropdown; i += 1) {
          if (norm(textOf(cur)).includes('新建Release分支')) {
            newBranchEntry = cur;
            break;
          }
          cur = cur.parentElement;
        }
      }
    }
    if (!newBranchEntry) {
      // Try selecting an existing release_* option as a fallback.
      const existing = qsa('.ant-select-item-option', dropdown).find((o) => {
        if (!isVisible(o)) return false;
        if (o.classList.contains('ant-select-item-option-disabled')) return false;
        const t = textOf(o);
        return isReleaseBranchName(t) && t !== previous;
      });
      if (existing) {
        clickElement(existing);
        await wait(800);
        return isReleaseBranchName(getSelectValue(findFormSelectByLabel('Into')));
      }
      closeAllSelects();
      setStatus('Into 下拉里找不到"新建Release分支"');
      return false;
    }

    clickElement(newBranchEntry);
    await wait(1500);
    await confirmTopDialog(CONFIRM_TEXTS);

    const updated = await waitFor(() => {
      const value = getSelectValue(findFormSelectByLabel('Into'));
      return isReleaseBranchName(value) && value !== previous ? value : null;
    }, 6000, 300);
    return !!updated;
  }

  function buildStage400Url() {
    const pipelineId = getPipelineIdFromUrl();
    return pipelineId ? `${ROUTES.deliveryProcessDetail}?PipelineID=${pipelineId}&stage=400&tab=1` : '';
  }

  async function handleStage200() {
    state.run.pipelineId = getPipelineIdFromUrl();
    saveRun();

    const summary = getStage200RunSummary();

    if (!state.run.actions['mr-deploy-click']) {
      rememberStage200Baseline(summary);

      const mergeSelectedThisTick = await actOnce(
        'merge-branch-first',
        selectFirstMergeBranch,
        WAIT_COOLDOWN_MS,
      );

      const selectedNow = getStage200Selections();
      if (!isValidMergeBranch(selectedNow.mergeBranch)) {
        setStatus('等待选择 Merge Branch');
        return;
      }
      if (mergeSelectedThisTick) {
        setStatus('已选择 Merge Branch，下一轮再处理 Into');
        return;
      }

      const releasePreparedThisTick = await actOnce(
        'create-release-branch',
        createNewReleaseBranchFromInto,
        WAIT_COOLDOWN_MS,
      );
      const preparedNow = getStage200Selections();
      if (!isReleaseBranchName(preparedNow.intoBranch)) {
        setStatus('等待 Into 中创建并选中新 Release 分支');
        return;
      }
      if (releasePreparedThisTick) {
        setStatus('已准备 Release 分支，下一轮再执行 MR 并部署');
        return;
      }

      await actOnce(
        'mr-deploy-click',
        async () => {
          const deployBtn = findClickableByText('MR并部署');
          if (!deployBtn) return false;
          const latestSummary = getStage200RunSummary();
          state.run.stage200BaselineTriggerTime =
            latestSummary.triggerTime || state.run.stage200BaselineTriggerTime;
          state.run.stage200BaselineCompileVersion =
            latestSummary.compileVersion || state.run.stage200BaselineCompileVersion;
          state.run.stage200ObservedTriggerTime = '';
          state.run.stage200ObservedCompileVersion = '';
          state.run.stage200NewRunObserved = false;
          saveRun();

          clickElement(deployBtn);
          await wait(1000);
          await confirmTopDialog(CONFIRM_TEXTS);
          setStatus('已触发 MR 并部署，等待测试线开始新一轮执行');
          return true;
        },
        WAIT_COOLDOWN_MS,
      );
      return;
    }

    if (!state.run.stage200NewRunObserved) {
      if (!hasStage200NewRunStarted(summary)) {
        setStatus('已点击 MR 并部署，等待触发时间或编译版本更新');
        return;
      }
      state.run.stage200ObservedTriggerTime = summary.triggerTime || '';
      state.run.stage200ObservedCompileVersion = summary.compileVersion || '';
      state.run.stage200NewRunObserved = true;
      saveRun();
    }

    await actOnce('dismiss-stage200-success-notice', dismissSuccessNotice, ACTION_COOLDOWN_MS);

    const readyForNext =
      state.run.stage200NewRunObserved && isStage200ReadyForProduction();

    if (!readyForNext) {
      setStatus('等待测试线部署完成');
      return;
    }

    const promoteTrigger = findPromoteToProductionTrigger();
    if (promoteTrigger && !isDisabled(promoteTrigger)) {
      const promoted = await actOnce(
        'click-promote-prod',
        async () => {
          await dismissSuccessNotice();
          const latestPromoteTrigger = findPromoteToProductionTrigger();
          if (!latestPromoteTrigger) return false;
          if (!clickElement(latestPromoteTrigger)) return false;
          await wait(1000);
          await confirmTopDialog(CONFIRM_TEXTS);
          return true;
        },
        WAIT_COOLDOWN_MS,
      );
      if (promoted) {
        setStatus('已点击推进到生产发布');
        return;
      }
    }
    if (promoteTrigger) {
      setStatus('等待"推进到生产发布"按钮可用');
      return;
    }

    const stage400Url = buildStage400Url();
    if (
      stage400Url &&
      window.location.href !== new URL(stage400Url, window.location.origin).href
    ) {
      setStatus('测试线完成，跳到生产发布阶段');
      window.location.href = stage400Url;
      return;
    }
    setStatus('等待"推进到生产发布"按钮可用');
  }

  // ---------- Page: deliveryProcessDetail stage=400 (release schedule) ----------

  function extractWindowMessage(rawText) {
    const jsonMatch = Array.from(String(rawText || '').matchAll(/message":"([^"]+)"/g));
    if (jsonMatch.length) return jsonMatch[0][1];
    const known = [
      '周五晚8至周六全天',
      '周一到周五，下午15点到24点',
      '周一到周五，上午8点到15点',
      '周一到周五，上午0点到8点',
      '周一到周五，上午8点到16点',
      '周一到周五，下午16点到24点',
      '周日全天',
    ];
    for (const item of known) {
      if (String(rawText).includes(item)) return item;
    }
    return String(rawText || '').trim();
  }

  function chineseDayToNumber(char) {
    return { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0 }[char];
  }

  function to24Hour(prefix, hour) {
    let value = Number(hour);
    if (prefix === '下午' && value < 12) value += 12;
    if (prefix === '晚上' && value < 12) value += 12;
    return value;
  }

  function isCurrentTimeInWindow(message) {
    const text = String(message || '').replace(/\s+/g, '');
    const now = new Date();
    const day = now.getDay();
    const minutes = now.getHours() * 60 + now.getMinutes();

    if (text.includes('周五晚8至周六全天')) {
      return (day === 5 && minutes >= 20 * 60) || day === 6;
    }
    if (text.includes('周日全天')) return day === 0;

    const rangeMatch = text.match(
      /周([一二三四五六日])到周([一二三四五六日])，?(上午|下午|晚上)?(\d{1,2})点到(\d{1,2})点/,
    );
    if (rangeMatch) {
      const startDay = chineseDayToNumber(rangeMatch[1]);
      const endDay = chineseDayToNumber(rangeMatch[2]);
      const prefix = rangeMatch[3] || '';
      const startHour = to24Hour(prefix, rangeMatch[4]);
      let endHour = Number(rangeMatch[5]);
      if (prefix === '下午' && endHour < 12) endHour += 12;
      const activeDay =
        startDay <= endDay ? day >= startDay && day <= endDay : day >= startDay || day <= endDay;
      if (!activeDay) return false;
      const startMinutes = startHour * 60;
      const endMinutes = endHour * 60;
      return minutes >= startMinutes && minutes < endMinutes;
    }
    return false;
  }

  async function chooseCurrentReleaseWindow(dialog) {
    // The release-window select is the LAST visible ant-select inside the "新建班次" dialog.
    const selects = qsa('.ant-select', dialog).filter(isVisible);
    const combo = selects[selects.length - 1] || null;
    if (!combo) return false;
    const dropdown = await openAntSelect(combo);
    if (!dropdown) return false;

    await wait(400);
    const options = qsa('.ant-select-item-option', dropdown).filter(isVisible);
    if (!options.length) {
      closeAllSelects();
      return false;
    }
    const matched = options.find((option) =>
      isCurrentTimeInWindow(extractWindowMessage(textOf(option))),
    );
    if (!matched) {
      closeAllSelects();
      return false;
    }
    clickElement(matched);
    await wait(500);
    return true;
  }

  async function openAssociateScheduleDialog() {
    const opened = findDialogByText('关联发布班次') || findDialogByText('已关联班次');
    if (opened) return opened;
    await dismissSuccessNotice();
    const trigger = findClickableByText(['关联生产班次', '关联班次']);
    if (!trigger) return null;
    clickElement(trigger);
    return await waitFor(
      () => findDialogByText('关联发布班次') || findDialogByText('已关联班次'),
      6000,
      300,
    );
  }

  async function createAndAssociateSchedule() {
    let dialog = await openAssociateScheduleDialog();
    if (!dialog) return false;

    const existingLink = extractScheduleDetailHrefByName(state.run.scheduleName);
    if (existingLink) {
      state.run.scheduleLinked = true;
      saveRun();
      return true;
    }

    if (!state.run.scheduleName) {
      const newBtn = findClickableByText('新建班次', dialog);
      if (!newBtn) {
        setStatus('未找到"新建班次"按钮');
        return false;
      }
      clickElement(newBtn);
      await wait(1000);

      const newDialog = await waitFor(() => findDialogByText('新建班次'), 6000, 300);
      if (!newDialog) {
        setStatus('"新建班次"弹窗未出现');
        return false;
      }

      const nameInput =
        findInputByPlaceholder(newDialog, '请输入班次名称') ||
        findInputByPlaceholder(newDialog, '请输入') ||
        allVisibleInputs(newDialog)[0] ||
        null;
      const scheduleName = makeScheduleName();
      if (nameInput) setInputValue(nameInput, scheduleName);
      state.run.scheduleName = scheduleName;
      saveRun();
      await wait(300);

      const windowChosen = await chooseCurrentReleaseWindow(newDialog);
      if (!windowChosen) {
        log('未匹配到当前时间可用的发布窗口');
        return false;
      }
      await wait(300);

      const createBtn = findClickableByText(['创 建', '创建'], newDialog);
      if (createBtn) {
        clickElement(createBtn);
        await wait(1500);
      }
    }

    dialog = await waitFor(
      () => findDialogByText('关联发布班次') || findDialogByText('已关联班次'),
      8000,
      300,
    );
    if (!dialog) return false;

    const row = await waitFor(() => findRowByText(dialog, state.run.scheduleName), 15000, 500);
    if (!row) return false;
    chooseRadioInRow(row);
    await wait(400);

    const linkBtn = findLastClickableByText(['关 联', '关联'], dialog, { exact: false });
    if (!linkBtn) return false;
    clickElement(linkBtn);
    await wait(1200);
    await dismissSuccessNotice();
    state.run.scheduleLinked = true;
    saveRun();
    return true;
  }

  // NEW: click "进入生产班次" then pick the schedule row inside the popup.
  async function enterCreatedSchedule() {
    // 1) Try an already-visible direct link first (covers the case where the
    //    parent page renders a `<a href*=deliveryScheduleDetail>` straight away).
    const directHref = extractScheduleDetailHrefByName(state.run.scheduleName);
    if (directHref && !findDialogByText('已关联班次') && !findDialogByText('关联发布班次')) {
      state.run.enteredSchedule = true;
      saveRun();
      window.location.href = directHref;
      return true;
    }

    // 2) Open the "进入生产班次" dialog if it isn't already open.
    let dialog = findDialogByText('已关联班次') || findDialogByText('关联发布班次');
    if (!dialog) {
      await dismissSuccessNotice();
      const enterBtn = findClickableByText('进入生产班次');
      if (!enterBtn) {
        setStatus('未找到"进入生产班次"按钮');
        return false;
      }
      clickElement(enterBtn);
      dialog = await waitFor(
        () => findDialogByText('已关联班次') || findDialogByText('关联发布班次'),
        6000,
        300,
      );
    }

    // 3) If clicking actually navigates straight to the schedule detail page,
    //    we'll catch it via the route check.
    if (onRoute(ROUTES.deliveryScheduleDetail)) {
      state.run.enteredSchedule = true;
      saveRun();
      return true;
    }

    if (!dialog) {
      setStatus('"进入生产班次"弹窗未出现');
      return false;
    }

    // 4) Locate the row with our schedule name inside the dialog.
    const row = await waitFor(() => findRowByText(dialog, state.run.scheduleName), 8000, 300);
    if (!row) {
      setStatus(`弹窗里找不到刚创建的班次: ${state.run.scheduleName}`);
      return false;
    }

    // 4a) Prefer an explicit "进入" / "查看" action button inside the row.
    const rowAction =
      findClickableByText(['进 入', '进入', '查 看', '查看', '详 情', '详情'], row, { exact: false }) ||
      qs('a[href*="/devops/cicd/deliveryScheduleDetail"]', row);
    if (rowAction) {
      const href = rowAction.getAttribute && rowAction.getAttribute('href');
      if (href && href.includes('deliveryScheduleDetail')) {
        state.run.enteredSchedule = true;
        saveRun();
        window.location.href = rowAction.href;
        return true;
      }
      clickElement(rowAction);
      await wait(1200);
      if (onRoute(ROUTES.deliveryScheduleDetail)) {
        state.run.enteredSchedule = true;
        saveRun();
        return true;
      }
    }

    // 4b) Fall back to selecting the radio + clicking the dialog footer button.
    if (chooseRadioInRow(row)) {
      await wait(300);
      const okBtn =
        findLastClickableByText(['进 入', '进入', '确 定', '确定'], dialog, { exact: false });
      if (okBtn) {
        clickElement(okBtn);
        await wait(1200);
        if (onRoute(ROUTES.deliveryScheduleDetail)) {
          state.run.enteredSchedule = true;
          saveRun();
          return true;
        }
      }
    }

    // 4c) Last resort: any href in the row that goes to the schedule detail.
    const link = qs('a[href*="/devops/cicd/deliveryScheduleDetail"]', row);
    if (link) {
      state.run.enteredSchedule = true;
      saveRun();
      window.location.href = link.href;
      return true;
    }

    // 4d) Or, if nothing else, try clicking the row itself.
    clickElement(row);
    await wait(1200);
    if (onRoute(ROUTES.deliveryScheduleDetail)) {
      state.run.enteredSchedule = true;
      saveRun();
      return true;
    }

    setStatus('点击班次后未跳转到班次详情，等待页面响应');
    return false;
  }

  async function handleStage400() {
    state.run.pipelineId = getPipelineIdFromUrl();
    saveRun();

    const existingHref = extractScheduleDetailHrefByName(state.run.scheduleName);
    if (existingHref && !state.run.scheduleLinked) {
      state.run.scheduleLinked = true;
      saveRun();
    }

    if (!state.run.scheduleLinked) {
      await actOnce('create-associate-schedule', createAndAssociateSchedule, WAIT_COOLDOWN_MS);
      if (state.run.scheduleLinked) {
        setStatus(`已关联生产班次: ${state.run.scheduleName}`);
      } else {
        setStatus('等待生产班次创建并关联');
      }
      return;
    }

    if (!state.run.enteredSchedule) {
      await actOnce('enter-created-schedule', enterCreatedSchedule, WAIT_COOLDOWN_MS);
      if (!state.run.enteredSchedule) {
        setStatus('等待进入刚创建的生产班次');
      }
    }
  }

  async function handleDeliveryProcessDetailPage() {
    state.run.pipelineId = getPipelineIdFromUrl();
    saveRun();
    const stage = parseQuery().get('stage') || '';

    if (stage === '400' || bodyHas('关联生产班次') || bodyHas('进入生产班次')) {
      await handleStage400();
      return;
    }
    if (stage === '200' || bodyHas('MR并部署')) {
      await handleStage200();
      return;
    }
    setStatus('等待流程详情页进入可执行阶段');
  }

  // ---------- Page: deliveryScheduleDetail ----------

  async function handleDeliveryScheduleDetailPage() {
    state.run.enteredSchedule = true;
    saveRun();

    if (!state.run.releaseInitialized && bodyHas('发布初始化')) {
      const initClicked = await clickTextAndConfirm(
        '发布初始化',
        CONFIRM_TEXTS,
        'schedule-release-init',
      );
      if (initClicked) {
        state.run.releaseInitialized = true;
        saveRun();
        setStatus('已点击发布初始化');
        return;
      }
      setStatus('等待"发布初始化"按钮可用');
      return;
    }

    // Click the "现在您可点此进行审批和Rolling" link if it exists, otherwise
    // navigate via any visible releasePlanApp anchor.
    const promoteLink =
      qsa('a', document).find(
        (a) =>
          isVisible(a) && norm(textOf(a)).includes('现在您可点此进行审批') &&
          ((a.getAttribute('href') || '').includes('releasePlanApp')),
      ) || null;

    const href = (promoteLink && promoteLink.href) || extractReleasePlanHref();
    if (!href) {
      setStatus('等待生成发布详情入口');
      return;
    }

    state.run.releaseInitialized = true;
    state.run.releasePlanEntered = true;
    saveRun();
    window.location.href = href;
  }

  // ---------- Page: releasePlanApp ----------

  async function clickTextAndConfirm(texts, confirmTexts, actionKey) {
    return actOnce(
      actionKey,
      async () => {
        const target = findClickableByText(texts);
        if (!target) return false;
        if (!clickElement(target)) return false;
        await wait(1000);
        if (confirmTexts && confirmTexts.length) {
          await confirmTopDialog(confirmTexts);
        }
        return true;
      },
      WAIT_COOLDOWN_MS,
    );
  }

  async function confirmTopDialog(texts) {
    const dialog = getTopDialog();
    if (!dialog) return false;
    const list = Array.isArray(texts) ? texts : [texts];
    // Prefer the primary confirm button.
    const primary = qsa('.ant-btn-primary', dialog)
      .filter(isVisible)
      .find((b) => list.some((t) => textMatch(b, t, false)));
    if (primary) {
      if (!clickElement(primary)) return false;
      await wait(900);
      return true;
    }
    const btn = findClickableByText(list, dialog, { exact: false });
    if (!btn) return false;
    if (!clickElement(btn)) return false;
    await wait(900);
    return true;
  }

  async function dismissSuccessNotice() {
    // Any global "知道了"/"我知道了"/"关闭" anywhere — usually a toast/notification.
    const globalBtn = findClickableByText(['知道了', '我知道了', '关闭']);
    if (globalBtn && clickElement(globalBtn)) {
      await wait(600);
      return true;
    }
    const dialog = getTopDialog();
    if (!dialog) return false;
    const dialogText = textOf(dialog);
    if (!/操作成功|Success|部署成功|成功|提示/.test(dialogText)) return false;
    const okBtn = findClickableByText(['知道了', '确 定', '确定', '关闭'], dialog);
    if (!okBtn) return false;
    if (!clickElement(okBtn)) return false;
    await wait(600);
    return true;
  }

  // NEW: submit-approval is more lenient about which inputs to fill.
  async function submitApprovalForm() {
    let dialog = findApprovalRequestDialog();
    if (!dialog) {
      const trigger = findSubmitApprovalTrigger();
      if (!trigger) return false;
      if (!clickElement(trigger)) return false;
      await wait(1200);
      dialog = await waitFor(() => findApprovalRequestDialog(), 5000, 200);
    }
    if (!dialog) return false;

    const approvalText = getApprovalSummaryText();
    const filled = new Set();

    // Try a wide range of placeholder hints (Chinese order varies).
    const placeholderHints = ['摘要', '功能与需求', '需求与功能', '功能', '需求', '描述'];
    for (const hint of placeholderHints) {
      for (const input of findInputsByPlaceholder(dialog, hint)) {
        if (filled.has(input)) continue;
        setInputValue(input, approvalText);
        filled.add(input);
      }
    }

    // Fall back: also fill inputs whose ant-form-item label matches.
    const labelHints = ['摘要', '功能与需求', '需求与功能', '功能', '需求', '描述'];
    for (const item of qsa('.ant-form-item', dialog).filter(isVisible)) {
      const lbl = item.querySelector('.ant-form-item-label label');
      const lt = lbl ? norm(ownText(lbl)) : '';
      if (!lt) continue;
      if (!labelHints.some((h) => lt.includes(norm(h)))) continue;
      for (const input of allVisibleInputs(item)) {
        if (filled.has(input)) continue;
        setInputValue(input, approvalText);
        filled.add(input);
      }
    }

    if (!filled.size) {
      // Final fallback: first two text inputs in the dialog.
      const inputs = allVisibleInputs(dialog).filter((input) => {
        const type = input.getAttribute('type') || 'text';
        return type === 'text' || input.tagName === 'TEXTAREA';
      });
      if (inputs[0]) {
        setInputValue(inputs[0], approvalText);
        filled.add(inputs[0]);
      }
      if (inputs[1]) {
        setInputValue(inputs[1], approvalText);
        filled.add(inputs[1]);
      }
    }

    if (filled.size) await wait(300);

    const submitBtn = findClickableByText(
      ['提 交 审 批', '提交审批', '提 交', '提交', '确 定', '确定'],
      dialog,
      { exact: false },
    );
    if (!submitBtn) return false;
    if (!clickElement(submitBtn)) return false;
    await wait(1500);
    await dismissSuccessNotice();

    const submitted = await waitFor(() => {
      const dialogStillOpen = !!findApprovalRequestDialog();
      const approvalBtnVisible = !!findApprovalTriggerButton();
      const inApproving = bodyHas('审批中');
      const approved = bodyHas('审批通过') && !inApproving;
      const submitTriggerVisible = !!findSubmitApprovalTrigger();
      if (approvalBtnVisible || inApproving || approved) return true;
      return !dialogStillOpen && !submitTriggerVisible;
    }, 8000, 250);
    if (!submitted) return false;

    state.run.approvalSubmitted = true;
    saveRun();
    return true;
  }

  // NEW: more specific approval-button matcher. The page also has a
  // "发布生产需要提交审批" button containing the word "审批" — match exactly
  // and skip any button that lives inside a modal/drawer so we don't
  // mistake the dialog's primary submit for the page-level trigger.
  function findApprovalTriggerButton() {
    return findPageClickableByText(['审批', '审 批'], { exact: true });
  }

  async function approveRelease() {
    // If the approval dialog (with radios) is already open, skip clicking
    // the page-level trigger; just deal with the open dialog.
    let dialog = getTopDialog();
    const hasApprovalRadios =
      dialog &&
      qsa('.ant-radio-wrapper', dialog)
        .filter(isVisible)
        .some((r) => norm(textOf(r)).includes('审批通过'));

    if (!hasApprovalRadios) {
      const trigger = findApprovalTriggerButton();
      if (!trigger) return false;
      if (!clickElement(trigger)) return false;
      await wait(1000);
      dialog = await waitFor(() => {
        const current = getTopDialog();
        if (!current) return null;
        const radiosOk = qsa('.ant-radio-wrapper', current)
          .filter(isVisible)
          .some((r) => norm(textOf(r)).includes('审批通过'));
        return radiosOk ? current : null;
      }, 6000, 250);
      if (!dialog) return false;
    }

    // Click the "审批通过" radio — match exactly to avoid "审批不通过".
    const approveOption = qsa('.ant-radio-wrapper', dialog)
      .filter(isVisible)
      .find((r) => norm(textOf(r)) === '审批通过');
    if (!approveOption) return false;
    if (!/ant-radio-wrapper-checked/.test(approveOption.className || '')) {
      const innerInput = approveOption.querySelector('input[type="radio"]');
      if (innerInput) {
        if (!clickElement(innerInput)) return false;
      } else if (!clickElement(approveOption)) {
        return false;
      }
      await wait(400);
      if (!/ant-radio-wrapper-checked/.test(approveOption.className || '')) {
        if (!clickElement(approveOption)) return false;
        await wait(400);
      }
    }

    // Click the dialog's primary submit. Prefer .ant-btn-primary inside the dialog.
    let submitBtn = qsa('.ant-btn-primary', dialog)
      .filter(isVisible)
      .find((b) => {
        const t = norm(textOf(b));
        return t === '审批' || t === '确定' || t === '提交' || t === '审 批' || t === '确 定';
      });
    if (!submitBtn) {
      submitBtn = qsa('button, .ant-btn, [role="button"]', dialog)
        .filter(isVisible)
        .find((b) => {
          const t = norm(textOf(b));
          return t === '审批' || t === '确定' || t === '提交';
        });
    }
    if (!submitBtn) return false;
    if (!clickElement(submitBtn)) return false;
    await wait(1500);

    // Accept any follow-up "操作成功 / 知道了" toast.
    await dismissSuccessNotice();

    // Verify by checking that either the dialog is gone or the page no longer
    // shows the standalone "审批" trigger.
    const stillOpen = !!getTopDialog() && hasApprovalRadios;
    const stillHasTrigger = !!findApprovalTriggerButton();
    if (stillOpen || stillHasTrigger) {
      // give the backend a moment, then re-check on the next tick
      await wait(800);
    }

    state.run.approvalApproved = true;
    saveRun();
    return true;
  }

  // Generic "if a confirm dialog is on top, press confirm".
  // Only fires for genuine `Modal.confirm()`-style popups so we don't
  // smash the primary button on feature dialogs (approval, schedule, etc.).
  async function maybeAcceptStrayConfirm() {
    const dialog = getTopDialog();
    if (!dialog) return false;
    // Skip any dialog that has interactive form controls — those need
    // dedicated handlers (approval modal has radios, schedule modal has
    // inputs/selects).
    const formControls = qsa(
      'input, textarea, .ant-select, .ant-radio-wrapper, [role="radio"], [role="combobox"], .ant-checkbox-wrapper',
      dialog,
    ).filter(isVisible);
    if (formControls.length > 0) return false;
    const cls = dialog.className || '';
    const wrap = dialog.closest('.ant-modal-wrap, .ant-modal-root') || dialog;
    const wrapCls = wrap ? wrap.className || '' : '';
    const isConfirmClass = /ant-modal-confirm|ant-modal-confirm-confirm|ant-modal-confirm-info|ant-modal-confirm-warning|ant-modal-confirm-success/.test(
      cls + ' ' + wrapCls,
    );
    if (!isConfirmClass) return false;
    return confirmTopDialog(CONFIRM_TEXTS);
  }

  // Re-derive approvalSubmitted / approvalApproved from the page so the
  // script can be (re)started mid-flow without getting stuck.
  function syncReleasePlanStateFromPage() {
    const hasSubmitBtn = !!findSubmitApprovalTrigger();
    const approvalBtnVisible = !!findApprovalTriggerButton();
    const inApproving = bodyHas('审批中');
    const approved = bodyHas('审批通过') && !inApproving;
    let changed = false;

    if (!state.run.approvalSubmitted && !hasSubmitBtn && (approvalBtnVisible || inApproving || approved)) {
      state.run.approvalSubmitted = true;
      changed = true;
    }
    if (!state.run.approvalApproved && approved && !approvalBtnVisible) {
      state.run.approvalApproved = true;
      changed = true;
    }
    if (changed) saveRun();
  }

  async function handleReleasePlanAppPage() {
    await actOnce('dismiss-release-plan-success-notice', dismissSuccessNotice, ACTION_COOLDOWN_MS);
    syncReleasePlanStateFromPage();

    if (!state.run.approvalSubmitted) {
      const approvalRequestDialog = findApprovalRequestDialog();
      const submitTrigger = findSubmitApprovalTrigger();
      if (approvalRequestDialog || submitTrigger) {
        const clicked = await actOnce(
          'submit-approval-request',
          submitApprovalForm,
          WAIT_COOLDOWN_MS,
        );
        if (clicked) {
          setStatus('已提交生产审批申请');
          return;
        }
        setStatus('等待"发布生产需要提交审批"按钮或弹窗可操作');
        return;
      }
      setStatus('等待编译完成，出现"发布生产需要提交审批"');
      return;
    }

    if (!state.run.approvalApproved) {
      // If the page already shows "审批通过" status (and not "审批中"), assume done.
      if (bodyHas('审批通过') && !bodyHas('审批中')) {
        state.run.approvalApproved = true;
        saveRun();
      } else {
        const approved = await actOnce('approve-release', approveRelease, WAIT_COOLDOWN_MS);
        if (approved) {
          setStatus('已审批通过');
          return;
        }
        setStatus('等待审批按钮可用');
        return;
      }
    }

    if (!state.run.grayReleased) {
      const gray = await clickTextAndConfirm(['灰度发布'], CONFIRM_TEXTS, 'gray-release');
      if (gray) {
        state.run.grayReleased = true;
        saveRun();
        setStatus('已触发灰度发布');
        return;
      }
      setStatus('等待灰度发布按钮');
      return;
    }

    if (!state.run.grayVerified) {
      const verifyGray = await clickTextAndConfirm(
        ['灰度验证通过'],
        CONFIRM_TEXTS,
        'gray-verify',
      );
      if (verifyGray) {
        state.run.grayVerified = true;
        saveRun();
        setStatus('已完成灰度验证');
        return;
      }
      setStatus('等待灰度发布执行完成');
      return;
    }

    if (!state.run.rollingReleased) {
      const rolling = await clickTextAndConfirm(
        ['rolling发布', 'Rolling发布', 'ROLLING发布'],
        CONFIRM_TEXTS,
        'rolling-release',
      );
      if (rolling) {
        state.run.rollingReleased = true;
        saveRun();
        setStatus('已触发 Rolling 发布');
        return;
      }
      setStatus('等待 Rolling 发布按钮');
      return;
    }

    if (!state.run.rollingVerified) {
      const rollingVerify = await clickTextAndConfirm(
        ['Rolling验证通过', 'rolling验证通过'],
        CONFIRM_TEXTS,
        'rolling-verify',
      );
      if (rollingVerify) {
        state.run.rollingVerified = true;
        saveRun();
        setStatus('已提交 Rolling 验证通过');
        return;
      }
      setStatus('等待 Rolling 执行完成');
      return;
    }

    if (!state.run.rollbackTagHandled) {
      const dialog = getTopDialog();
      if (dialog && /添加回滚标签|回滚标签/.test(textOf(dialog))) {
        const yesBtn =
          findLastClickableByText('是', dialog, { exact: true }) ||
          findLastClickableByText('是', dialog);
        if (yesBtn) {
          clickElement(yesBtn);
          await wait(1200);
          state.run.rollbackTagHandled = true;
          saveRun();
          setStatus('已确认添加回滚标签');
          return;
        }
      }
      if (bodyHas('添加标签成功') || bodyHas('Rolling回滚') || isReleasePlanComplete()) {
        state.run.rollbackTagHandled = true;
        saveRun();
      } else {
        setStatus('等待回滚标签提示或完成态');
        return;
      }
    }

    if (isReleasePlanComplete() || bodyHas('添加标签成功') || bodyHas('Rolling回滚')) {
      state.run.finished = true;
      state.run.active = false;
      saveRun();
      log('发布流程已完成');
      return;
    }
    setStatus('等待发布流程收尾完成');
  }

  // ---------- Router ----------

  async function routeTick() {
    if (state.run.active) {
      await maybeAcceptStrayConfirm();
    }
    if (onRoute(ROUTES.deliveryProcess)) {
      await handleDeliveryProcessPage();
      return;
    }
    if (onRoute(ROUTES.deliveryProcessDetail)) {
      await handleDeliveryProcessDetailPage();
      return;
    }
    if (onRoute(ROUTES.deliveryScheduleDetail)) {
      await handleDeliveryScheduleDetailPage();
      return;
    }
    if (onRoute(ROUTES.releasePlanApp)) {
      await handleReleasePlanAppPage();
      return;
    }
    setStatus('当前页面不在自动发布流程里');
  }

  async function tick() {
    if (!state.run.active || state.ticking) {
      renderPanel();
      return;
    }
    state.ticking = true;
    try {
      await routeTick();
    } catch (error) {
      console.error('[DevOpsAutoPublish] tick failed:', error);
      log(`脚本异常: ${error.message || error}`);
    } finally {
      state.ticking = false;
      renderPanel();
    }
  }

  function bootstrap() {
    ensurePanel();
    renderPanel();
    window.setInterval(tick, POLL_MS);
    window.setTimeout(tick, 1000);
  }

  bootstrap();
})();
