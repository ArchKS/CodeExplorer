// Intro: 雪球文章导出 Markdown
// Date: 2026.08.03
// Tag: 网页脚本

// ==UserScript==
// @name         雪球文章导出 Markdown
// @namespace    https://xueqiu.com/
// @version      1.0.0
// @description  在雪球文章页一键导出带标题、作者、时间、链接和图片的 Markdown 文件
// @author       Codex
// @match        https://xueqiu.com/*/*
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const BUTTON_ID = 'xq-export-markdown-button';
  const ARTICLE_SELECTOR = 'article.article__bd';
  const CONTENT_SELECTOR = '.article__bd__detail';

  function cleanText(text) {
    return (text || '')
      .replace(/\u00a0/g, ' ')
      .replace(/[\t ]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function escapeInline(text) {
    return (text || '')
      .replace(/\\/g, '\\\\')
      .replace(/([`*_[\]<>])/g, '\\$1');
  }

  function escapeTableCell(text) {
    return cleanText(text)
      .replace(/\|/g, '\\|')
      .replace(/\n/g, '<br>');
  }

  function absoluteUrl(value) {
    if (!value) return '';
    if (/^(data:|blob:)/i.test(value)) return value;
    try {
      return new URL(value, location.href).href;
    } catch {
      return value;
    }
  }

  function imageUrl(img) {
    const srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset');
    if (srcset) {
      const candidates = srcset
        .split(',')
        .map(item => item.trim().split(/\s+/))
        .filter(parts => parts[0])
        .map(parts => ({
          url: parts[0],
          size: Number.parseFloat(parts[1]) || 0
        }))
        .sort((a, b) => b.size - a.size);
      if (candidates[0]) return absoluteUrl(candidates[0].url);
    }

    return absoluteUrl(
      img.getAttribute('data-original') ||
      img.getAttribute('data-src') ||
      img.currentSrc ||
      img.getAttribute('src') ||
      ''
    );
  }

  function inlineMarkdown(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return escapeInline(node.nodeValue);
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const tag = node.tagName.toLowerCase();

    // 雪球用 h-char/h-inner 包裹中文标点，直接取文本即可。
    if (tag === 'h-char') return node.textContent || '';
    if (tag === 'h-inner') return node.textContent || '';
    if (tag === 'br') return '  \n';
    if (tag === 'img') {
      const src = imageUrl(node);
      const alt = (node.getAttribute('alt') || '').replace(/[\[\]]/g, '');
      return src ? `![${alt}](${src})` : '';
    }

    const content = Array.from(node.childNodes).map(inlineMarkdown).join('');

    switch (tag) {
      case 'a': {
        const href = absoluteUrl(node.getAttribute('href'));
        const label = cleanText(content) || href;
        return href && !/^javascript:/i.test(href) ? `[${label}](${href})` : label;
      }
      case 'strong':
      case 'b':
        return content.trim() ? `**${content.trim()}**` : '';
      case 'em':
      case 'i':
        return content.trim() ? `*${content.trim()}*` : '';
      case 'del':
      case 's':
        return content.trim() ? `~~${content.trim()}~~` : '';
      case 'code':
        return content.includes('`') ? `\`\` ${content} \`\`` : `\`${content}\``;
      case 'sup':
        return `<sup>${content}</sup>`;
      case 'sub':
        return `<sub>${content}</sub>`;
      default:
        return content;
    }
  }

  function tableMarkdown(table) {
    const rows = Array.from(table.querySelectorAll('tr')).map(row =>
      Array.from(row.querySelectorAll(':scope > th, :scope > td'))
        .map(cell => escapeTableCell(inlineMarkdown(cell)))
    );

    if (!rows.length) return '';
    const columnCount = Math.max(...rows.map(row => row.length));
    const normalized = rows.map(row => [
      ...row,
      ...Array(Math.max(0, columnCount - row.length)).fill('')
    ]);

    const header = normalized[0];
    const divider = Array(columnCount).fill('---');
    return [
      `| ${header.join(' | ')} |`,
      `| ${divider.join(' | ')} |`,
      ...normalized.slice(1).map(row => `| ${row.join(' | ')} |`)
    ].join('\n');
  }

  function blockMarkdown(node, listDepth = 0) {
    if (node.nodeType === Node.TEXT_NODE) {
      return cleanText(node.nodeValue);
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const tag = node.tagName.toLowerCase();
    const inline = () => cleanText(
      Array.from(node.childNodes).map(inlineMarkdown).join('')
    );

    if (/^h[1-6]$/.test(tag)) {
      return `${'#'.repeat(Number(tag[1]))} ${inline()}`;
    }

    switch (tag) {
      case 'p':
        return inline();
      case 'blockquote':
        return blockChildren(node, listDepth)
          .split('\n')
          .map(line => `> ${line}`)
          .join('\n');
      case 'pre': {
        const code = node.textContent.replace(/^\n|\n$/g, '');
        const language =
          node.querySelector('code')?.className.match(/language-([\w-]+)/)?.[1] || '';
        const fence = code.includes('```') ? '````' : '```';
        return `${fence}${language}\n${code}\n${fence}`;
      }
      case 'ul':
      case 'ol': {
        const ordered = tag === 'ol';
        return Array.from(node.children)
          .filter(child => child.tagName.toLowerCase() === 'li')
          .map((item, index) => listItemMarkdown(item, ordered, index, listDepth))
          .join('\n');
      }
      case 'table':
        return tableMarkdown(node);
      case 'figure': {
        const images = Array.from(node.querySelectorAll('img'))
          .map(img => inlineMarkdown(img))
          .filter(Boolean);
        const caption = cleanText(node.querySelector('figcaption')?.textContent || '');
        return [...images, caption ? `*${escapeInline(caption)}*` : '']
          .filter(Boolean)
          .join('\n\n');
      }
      case 'img':
        return inlineMarkdown(node);
      case 'hr':
        return '---';
      case 'div':
      case 'section':
        return blockChildren(node, listDepth);
      default:
        return inline();
    }
  }

  function listItemMarkdown(item, ordered, index, depth) {
    const indent = '  '.repeat(depth);
    const marker = ordered ? `${index + 1}.` : '-';
    const ownNodes = Array.from(item.childNodes).filter(node =>
      !(node.nodeType === Node.ELEMENT_NODE && /^(ul|ol)$/i.test(node.tagName))
    );
    const ownText = cleanText(ownNodes.map(inlineMarkdown).join(''));
    const firstLine = `${indent}${marker} ${ownText}`;

    const nested = Array.from(item.children)
      .filter(child => /^(ul|ol)$/i.test(child.tagName))
      .map(child => blockMarkdown(child, depth + 1))
      .filter(Boolean);

    return [firstLine, ...nested].join('\n');
  }

  function blockChildren(container, listDepth = 0) {
    return Array.from(container.childNodes)
      .filter(node => {
        if (node.nodeType !== Node.ELEMENT_NODE) return cleanText(node.nodeValue);
        const style = getComputedStyle(node);
        return style.display !== 'none' && !node.hidden;
      })
      .map(node => blockMarkdown(node, listDepth))
      .map(cleanText)
      .filter(Boolean)
      .join('\n\n');
  }

  function yamlString(value) {
    return JSON.stringify((value || '').replace(/\r?\n/g, ' '));
  }

  function articleMetadata() {
    const article = document.querySelector(ARTICLE_SELECTOR);
    const title =
      article?.querySelector('.article__bd__title, h1')?.textContent?.trim() ||
      document.title.replace(/\s*[-_—|].*$/, '').trim() ||
      '雪球文章';

    const author =
      document.querySelector('.article__author .avatar__name .name')?.textContent?.trim() ||
      document.querySelector('.article__author .name')?.textContent?.trim() ||
      document.querySelector('meta[name="author"]')?.content?.trim() ||
      '';

    const time = document.querySelector('.article__container time');
    const published =
      time?.getAttribute('datetime') ||
      time?.getAttribute('title') ||
      time?.textContent?.trim() ||
      '';

    return {
      title,
      author: author.replace(/\(\)\s*$/, ''),
      published,
      url: location.href.split('#')[0]
    };
  }

  function buildMarkdown() {
    const content = document.querySelector(CONTENT_SELECTOR);
    if (!content) {
      throw new Error('没有找到文章正文，请确认当前页面是雪球文章详情页。');
    }

    const meta = articleMetadata();
    const body = blockChildren(content);
    if (!body) throw new Error('正文为空，可能是文章尚未加载完成。');

    const frontMatter = [
      '---',
      `title: ${yamlString(meta.title)}`,
      `author: ${yamlString(meta.author)}`,
      `date: ${yamlString(meta.published)}`,
      `source: ${yamlString(meta.url)}`,
      '---'
    ].join('\n');

    return {
      meta,
      markdown: `${frontMatter}\n\n# ${escapeInline(meta.title)}\n\n${body}\n`
    };
  }

  function safeFilename(name) {
    const cleaned = name
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
      .replace(/[.\s]+$/g, '')
      .slice(0, 120);
    return `${cleaned || '雪球文章'}.md`;
  }

  function downloadMarkdown() {
    try {
      const { meta, markdown } = buildMarkdown();
      const blob = new Blob(['\uFEFF', markdown], {
        type: 'text/markdown;charset=utf-8'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = safeFilename(meta.title);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (error) {
      window.alert(`导出失败：${error.message}`);
    }
  }

  function addButton() {
    if (document.getElementById(BUTTON_ID)) return;
    if (!document.querySelector(CONTENT_SELECTOR)) return;

    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.textContent = '导出 Markdown';
    button.title = '将当前雪球文章保存为 .md 文件';
    Object.assign(button.style, {
      position: 'fixed',
      right: '24px',
      bottom: '28px',
      zIndex: '2147483647',
      padding: '10px 16px',
      border: '0',
      borderRadius: '8px',
      color: '#fff',
      background: '#06a7ff',
      boxShadow: '0 4px 14px rgba(0, 0, 0, .18)',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer'
    });
    button.addEventListener('click', downloadMarkdown);
    document.body.appendChild(button);
  }

  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('导出当前文章为 Markdown', downloadMarkdown);
  }

  addButton();

  // 兼容站内跳转和正文延迟加载。
  const observer = new MutationObserver(() => {
    if (document.querySelector(CONTENT_SELECTOR)) addButton();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
