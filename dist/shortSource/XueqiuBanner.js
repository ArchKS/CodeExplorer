// Intro: 雪球股票页头像旁拉黑按钮
// Date: 2026.09.01
// Tag: 网页脚本

// ==UserScript==
// @name         雪球股票页头像旁拉黑按钮
// @namespace    https://xueqiu.com/
// @version      1.0.2
// @description  在雪球股票页的用户头像旁添加拉黑按钮
// @match        https://xueqiu.com/S/*
// @match        https://xueqiu.com/s/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

// ai coding: 按雪球真实时间线 DOM 增加点击即执行的头像拉黑按钮 2026/09/01: 10:25
(() => {
  'use strict';

  const BUTTON_CLASS = 'xq-quick-block-button';
  const PROFILE_LINK_SELECTOR = '.timeline__item > a.avatar[href]';
  const BLOCK_ENDPOINT = '/blocks/create.json';

  const style = document.createElement('style');
  style.textContent = `
    .${BUTTON_CLASS} {
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 42px;
      height: 24px;
      margin-left: 6px;
      padding: 0 8px;
      border: 1px solid #e05252;
      border-radius: 4px;
      background: #fff;
      color: #d43c33;
      font: 12px/1 -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
      vertical-align: middle;
      cursor: pointer;
    }
    .timeline__item > .${BUTTON_CLASS} {
      float: left;
      clear: left;
      min-width: 40px;
      margin: 5px 0 0;
      padding: 0 4px;
    }
    .${BUTTON_CLASS}:hover { background: #fff3f2; }
    .${BUTTON_CLASS}:disabled { border-color: #bbb; color: #999; cursor: default; }
    .${BUTTON_CLASS}[data-state="blocked"] { border-color: #b7b7b7; background: #f5f5f5; color: #888; }
    .xq-quick-block-toast {
      position: fixed;
      z-index: 2147483647;
      left: 50%;
      bottom: 48px;
      transform: translateX(-50%);
      padding: 9px 14px;
      border-radius: 5px;
      background: rgba(30, 30, 30, .9);
      color: #fff;
      font: 14px/1.4 -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);

  function getUserId(link) {
    try {
      return new URL(link.href, location.origin).pathname.match(/^\/(?:u\/)?(\d+)(?:\/|$)/)?.[1]
        || link.dataset.tooltip
        || '';
    } catch (_) {
      return '';
    }
  }

  function getCurrentUserId() {
    return document.cookie.match(/(?:^|;\s*)u=(\d+)/)?.[1] || '';
  }

  function isAvatarLink(link) {
    if (link.querySelector('img')) return true;
    if (/avatar/i.test(link.className)) return true;

    const child = link.firstElementChild;
    if (!child) return false;
    return /avatar/i.test(child.className) || child.style.backgroundImage.startsWith('url(');
  }

  function showToast(message) {
    document.querySelector('.xq-quick-block-toast')?.remove();
    const toast = document.createElement('div');
    toast.className = 'xq-quick-block-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    window.setTimeout(() => toast.remove(), 2200);
  }

  async function blockUser(userId) {
    const response = await fetch(BLOCK_ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: new URLSearchParams({ user_id: userId }),
    });

    const contentType = response.headers.get('content-type') || '';
    const result = contentType.includes('json') ? await response.json() : null;
    if (!response.ok) {
      throw new Error(result?.error_description || `请求失败（HTTP ${response.status}）`);
    }
    if (!result) {
      throw new Error('雪球未返回 JSON，请确认已登录且页面未触发访问验证');
    }
    if (result.error_code && result.error_code !== 0) {
      throw new Error(result.error_description || `雪球错误码 ${result.error_code}`);
    }
  }

  function markUserBlocked(userId) {
    document.querySelectorAll(`.${BUTTON_CLASS}[data-user-id="${userId}"]`).forEach((button) => {
      button.dataset.state = 'blocked';
      button.disabled = true;
      button.textContent = '已拉黑';
    });
  }

  function addButton(link, userId) {
    link.dataset.xqBlockButtonAdded = '1';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = BUTTON_CLASS;
    button.dataset.userId = userId;
    button.textContent = '拉黑';
    button.title = `拉黑用户 ${userId}`;

    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      button.disabled = true;
      button.textContent = '处理中';
      try {
        await blockUser(userId);
        markUserBlocked(userId);
        showToast('已拉黑该用户');
      } catch (error) {
        button.disabled = false;
        button.textContent = '拉黑';
        showToast(error instanceof Error ? error.message : '拉黑失败');
      }
    });

    link.insertAdjacentElement('afterend', button);
  }

  function scan() {
    if (!/^\/S\//i.test(location.pathname)) return;

    const currentUserId = getCurrentUserId();
    document.querySelectorAll(PROFILE_LINK_SELECTOR).forEach((link) => {
      if (link.dataset.xqBlockButtonAdded || !isAvatarLink(link)) return;
      const userId = getUserId(link);
      if (!userId || userId === currentUserId) return;
      addButton(link, userId);
    });
  }

  let scanTimer = 0;
  const observer = new MutationObserver(() => {
    window.clearTimeout(scanTimer);
    scanTimer = window.setTimeout(scan, 80);
  });

  scan();
  observer.observe(document.body, { childList: true, subtree: true });
})();
