// Intro: 微信公众号文章导出 Markdown
// Date: 2026.08.03
// Tag: 网页脚本

// ==UserScript==
// @name         微信公众号文章导出 Markdown
// @namespace    https://mp.weixin.qq.com/
// @version      1.0.0
// @description  在微信公众号文章页一键导出标题、公众号、日期、链接、图片和正文为 Markdown
// @author       Codex
// @match        https://mp.weixin.qq.com/s*
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const BUTTON_ID = 'wx-export-markdown-button';
  const CONTENT_SELECTORS = ['#js_content', '.rich_media_content'];

  function firstElement(selectors, root = document) {
    for (const selector of selectors) {
      const element = root.querySelector(selector);
      if (element) return element;
    }
    return null;
  }

  function firstText(selectors, root = document) {
    return firstElement(selectors, root)?.textContent?.trim() || '';
  }

  function cleanText(text) {
    return (text || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\u200b/g, '')
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
    const srcset =
      img.getAttribute('data-srcset') ||
      img.getAttribute('srcset') ||
      '';

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
      img.getAttribute('data-src') ||
      img.getAttribute('data-original') ||
      img.getAttribute('data-backsrc') ||
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

    if (['script', 'style', 'noscript', 'iframe', 'button'].includes(tag)) {
      return '';
    }
    if (tag === 'br') return '  \n';
    if (tag === 'img') {
      const src = imageUrl(node);
      const alt = (
        node.getAttribute('alt') ||
        node.getAttribute('data-title') ||
        ''
      ).replace(/[\[\]\r\n]/g, '');
      return src ? `![${alt}](${src})` : '';
    }

    const content = Array.from(node.childNodes).map(inlineMarkdown).join('');

    switch (tag) {
      case 'a': {
        const href = absoluteUrl(
          node.getAttribute('data-itemshowtype') === '0'
            ? node.getAttribute('data-link')
            : node.getAttribute('href')
        );
        const label = cleanText(content) || href;
        return href && !/^javascript:/i.test(href)
          ? `[${label}](${href})`
          : label;
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

  function hasBlockChildren(element) {
    return Array.from(element.children).some(child =>
      /^(ADDRESS|ARTICLE|ASIDE|BLOCKQUOTE|DIV|DL|FIGURE|H[1-6]|HR|OL|P|PRE|SECTION|TABLE|UL)$/.test(
        child.tagName
      )
    );
  }

  function blockMarkdown(node, listDepth = 0) {
    if (node.nodeType === Node.TEXT_NODE) {
      return cleanText(node.nodeValue);
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const tag = node.tagName.toLowerCase();
    const inline = () =>
      cleanText(Array.from(node.childNodes).map(inlineMarkdown).join(''));

    if (/^h[1-6]$/.test(tag)) {
      return `${'#'.repeat(Number(tag[1]))} ${inline()}`;
    }

    switch (tag) {
      case 'script':
      case 'style':
      case 'noscript':
      case 'iframe':
      case 'button':
        return '';
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
          node.querySelector('code')?.className.match(/language-([\w-]+)/)?.[1] ||
          '';
        const fence = code.includes('```') ? '````' : '```';
        return `${fence}${language}\n${code}\n${fence}`;
      }
      case 'ul':
      case 'ol': {
        const ordered = tag === 'ol';
        return Array.from(node.children)
          .filter(child => child.tagName.toLowerCase() === 'li')
          .map((item, index) =>
            listItemMarkdown(item, ordered, index, listDepth)
          )
          .join('\n');
      }
      case 'table':
        return tableMarkdown(node);
      case 'figure': {
        const images = Array.from(node.querySelectorAll('img'))
          .map(img => inlineMarkdown(img))
          .filter(Boolean);
        const caption = cleanText(
          node.querySelector('figcaption')?.textContent || ''
        );
        return [
          ...images,
          caption ? `*${escapeInline(caption)}*` : ''
        ].filter(Boolean).join('\n\n');
      }
      case 'img':
        return inlineMarkdown(node);
      case 'hr':
        return '---';
      case 'div':
      case 'section':
      case 'article':
        return hasBlockChildren(node)
          ? blockChildren(node, listDepth)
          : inline();
      default:
        return inline();
    }
  }

  function listItemMarkdown(item, ordered, index, depth) {
    const indent = '  '.repeat(depth);
    const marker = ordered ? `${index + 1}.` : '-';
    const ownNodes = Array.from(item.childNodes).filter(node =>
      !(
        node.nodeType === Node.ELEMENT_NODE &&
        /^(ul|ol)$/i.test(node.tagName)
      )
    );
    const ownText = cleanText(ownNodes.map(inlineMarkdown).join(''));
    const firstLine = `${indent}${marker} ${ownText}`;

    const nested = Array.from(item.children)
      .filter(child => /^(ul|ol)$/i.test(child.tagName))
      .map(child => blockMarkdown(child, depth + 1))
      .filter(Boolean);

    return [firstLine, ...nested].join('\n');
  }

  function isVisibleContentNode(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return Boolean(cleanText(node.nodeValue));
    }
    if (node.hidden) return false;
    const style = (node.getAttribute('style') || '').replace(/\s+/g, '');
    return !/display:none/i.test(style);
  }

  function blockChildren(container, listDepth = 0) {
    return Array.from(container.childNodes)
      .filter(isVisibleContentNode)
      .map(node => blockMarkdown(node, listDepth))
      .map(cleanText)
      .filter(Boolean)
      .join('\n\n');
  }

  function yamlString(value) {
    return JSON.stringify((value || '').replace(/\r?\n/g, ' '));
  }

  function canonicalSource() {
    const canonical =
      document.querySelector('link[rel="canonical"]')?.href ||
      document.querySelector('meta[property="og:url"]')?.content ||
      location.href;
    return canonical.split('#')[0];
  }

  function articleMetadata() {
    const title =
      firstText(['#activity-name', '.rich_media_title', 'h1']) ||
      document.querySelector('meta[property="og:title"]')?.content?.trim() ||
      document.title.trim() ||
      '微信公众号文章';

    const account =
      firstText([
        '#js_name',
        '#js_wx_follow_nickname',
        '.rich_media_meta_nickname',
        '.wx_follow_nickname'
      ]) ||
      document.querySelector('meta[name="author"]')?.content?.trim() ||
      '';

    const author =
      firstText([
        '#js_author_name',
        '.rich_media_meta_text.rich_media_meta_nickname'
      ]) || account;

    const published = firstText([
      '#publish_time',
      '#js_publish_time',
      '.rich_media_meta_text'
    ]);

    const cover = absoluteUrl(
      document.querySelector('meta[property="og:image"]')?.content ||
      document.querySelector('meta[name="twitter:image"]')?.content ||
      ''
    );

    const description =
      document.querySelector('meta[property="og:description"]')?.content?.trim() ||
      document.querySelector('meta[name="description"]')?.content?.trim() ||
      '';

    return {
      title,
      account,
      author,
      published,
      cover,
      description,
      url: canonicalSource()
    };
  }

  function preparedContent() {
    const source = firstElement(CONTENT_SELECTORS);
    if (!source) {
      throw new Error('没有找到文章正文，请确认当前页面是微信公众号文章页。');
    }

    const clone = source.cloneNode(true);
    clone.querySelectorAll([
      'script',
      'style',
      'noscript',
      'iframe',
      '.js_product_container',
      '.js_miniprogram_container',
      'mp-common-profile',
      'mp-common-videosnap',
      '[data-tools="135编辑器"] > ._135editor_copyright'
    ].join(',')).forEach(element => element.remove());

    return clone;
  }

  function buildMarkdown() {
    const meta = articleMetadata();
    const content = preparedContent();
    const body = blockChildren(content);

    if (!body) {
      throw new Error('正文为空，可能是文章尚未加载完成。');
    }

    const frontMatter = [
      '---',
      `title: ${yamlString(meta.title)}`,
      `account: ${yamlString(meta.account)}`,
      `author: ${yamlString(meta.author)}`,
      `date: ${yamlString(meta.published)}`,
      `source: ${yamlString(meta.url)}`,
      `cover: ${yamlString(meta.cover)}`,
      `description: ${yamlString(meta.description)}`,
      '---'
    ].join('\n');

    const cover = meta.cover ? `\n\n![封面](${meta.cover})` : '';
    const byline = [meta.account, meta.published].filter(Boolean).join(' · ');
    const bylineMarkdown = byline ? `\n\n> ${escapeInline(byline)}` : '';

    return {
      meta,
      markdown:
        `${frontMatter}\n\n# ${escapeInline(meta.title)}` +
        `${bylineMarkdown}${cover}\n\n${body}\n`
    };
  }

  function safeFilename(name) {
    const cleaned = name
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
      .replace(/[.\s]+$/g, '')
      .slice(0, 120);
    return `${cleaned || '微信公众号文章'}.md`;
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
    if (!firstElement(CONTENT_SELECTORS)) return;

    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.textContent = '导出 Markdown';
    button.title = '将当前微信公众号文章保存为 .md 文件';
    Object.assign(button.style, {
      position: 'fixed',
      right: '22px',
      bottom: '28px',
      zIndex: '2147483647',
      padding: '10px 16px',
      border: '0',
      borderRadius: '8px',
      color: '#fff',
      background: '#07c160',
      boxShadow: '0 4px 14px rgba(0, 0, 0, .18)',
      fontSize: '14px',
      fontWeight: '600',
      lineHeight: '20px',
      cursor: 'pointer'
    });
    button.addEventListener('click', downloadMarkdown);
    document.body.appendChild(button);
  }

  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('导出当前文章为 Markdown', downloadMarkdown);
  }

  addButton();

  // 兼容正文延迟渲染。
  const observer = new MutationObserver(() => {
    if (firstElement(CONTENT_SELECTORS)) addButton();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
