
// Intro: CDN油猴脚本
// Date: 2026.04.29
// Tag: 工作







// ==UserScript==
// @name         Cdns
// @namespace    http://tampermonkey.net/
// @version      2026-09-04
// @description  CDN 路径快速填充（兼容新版 React 页面）
// @author       You
// @match        http://10.228.130.212:42657/cdn
// @match        http://10.126.136.20:8042/
// @match        http://localhost:42657/cdn
// @icon         https://www.google.com/s2/favicons?sz=64&domain=eastmoney.com
// @grant        none
// @run-at       document-idle
// ==/UserScript==

// ai coding: 适配新版 CDN 页面行、按钮和 React 受控输入框，并保留旧版 DOM 兼容 2026/09/04: 19:12
(function () {
    "use strict";

    const CdnList = [
        {
            name: "新版话题H5",
            git: "mgubatopic2025",
            path: ["https://gbfek.dfcfw.com/deploy/fd_mgubatopic2025/work/"],
        },
        {
            name: "龙虾",
            git: "fd_clawsocial",
            path: ["https://gbfek.dfcfw.com/deploy/fd_clawsocial/work/static/"],
        },
        {
            name: "老版话题H5",
            git: "mtopic2020",
            path: ["https://gbfek.dfcfw.com/deploy/mtopic2020/work/"],
        },
        {
            name: "股吧Web",
            git: "",
            path: [
                "https://gbfek.dfcfw.com/deploy/fd_guba_web2022/work/",
                "https://gbfek.dfcfw.com/project/guba2022/",
            ],
        },
        {
            name: "股吧PC",
            git: "",
            path: ["https://gbfek.dfcfw.com/deploy/fd_guba_pc2022/work/"],
        },
        {
            name: "股吧Rank",
            git: "",
            path: ["https://gbfek.dfcfw.com/deploy/rank_web/work/rank_stock.js"],
        },
        {
            name: "期货正文",
            git: "",
            path: ["https://gbfek.dfcfw.com/gubaapi/qihuo_embed/"],
        },
        {
            name: "期货话题",
            git: "",
            path: ["https://gbfek.dfcfw.com/deploy/fd_guba_mqihuotopic/work/"],
        },
        {
            name: "问董秘",
            git: "",
            path: [
                "https://gbfek.dfcfw.com/deploy/mgubaqa/work/",
                "https://gbfek.dfcfw.com/deploy/guba_web_qa/work/",
            ],
        },
        {
            name: "举报",
            git: "",
            path: [
                "https://gbfek.dfcfw.com/deploy/help_web/work/",
                "https://gbfek.dfcfw.com/deploy/help_waph5/work/",
                "https://gbfek.dfcfw.com/deploy/help_apph5/work/",
            ],
        },
        {
            name: "财富号列表",
            git: "",
            path: ["https://gubawebcs.eastmoney.com/gubawebapi/comment_list_new/cfhlist.js"],
        },
        {
            name: "评论列表-资讯/财富号",
            git: "",
            path: ["https://gbfek.dfcfw.com/deploy/guba_module_comment_list_new/work/editor_and_list.js"],
        },
        {
            name: "群聊",
            git: "",
            path: [
                "https://gubawebcs.eastmoney.com/fd_groupchat/static/index.js",
                "https://gbfek.dfcfw.com/deploy/fd_groupchat_comp/work/",
                "https://gbfek.dfcfw.com/deploy/fd_groupchat_comp/work/static/",
            ],
        },
    ];

    const SELECTORS = {
        row: ".url-row, .list_item",
        input: "input[type='text'], input:not([type])",
        add: ".btn-add",
        remove: ".btn-remove, .delbtn",
    };

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const getRows = () => Array.from(document.querySelectorAll(SELECTORS.row));
    const getRowInput = (row) => row?.querySelector(SELECTORS.input) || null;

    const getAddRowBtn = () =>
        document.querySelector(SELECTORS.add) ||
        Array.from(document.querySelectorAll("button[type='button'], button")).find((button) =>
            button.textContent?.includes("增加一行"),
        );

    const waitUntil = async (predicate, timeout = 1200) => {
        const startedAt = Date.now();
        while (Date.now() - startedAt < timeout) {
            const result = predicate();
            if (result) return result;
            await sleep(30);
        }
        return null;
    };

    const setInputValue = (input, value) => {
        const setter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            "value",
        )?.set;

        if (setter) setter.call(input, value);
        else input.value = value;

        input.dispatchEvent(
            typeof InputEvent === "function"
                ? new InputEvent("input", {
                      bubbles: true,
                      inputType: "insertText",
                      data: value,
                  })
                : new Event("input", { bubbles: true }),
        );
        input.dispatchEvent(new Event("change", { bubbles: true }));
    };

    const findEmptyRow = () =>
        getRows().find((row) => {
            const input = getRowInput(row);
            return input && !input.value.trim();
        });

    const appendEmptyRow = async () => {
        const beforeRows = getRows();
        const beforeSet = new Set(beforeRows);
        const addRowBtn = getAddRowBtn();
        if (!addRowBtn || addRowBtn.disabled) return null;

        addRowBtn.click();
        return waitUntil(() => {
            const rows = getRows();
            return rows.find((row) => !beforeSet.has(row)) ||
                (rows.length > beforeRows.length ? rows[rows.length - 1] : null);
        });
    };

    const insertCdn = async (text, name) => {
        let targetRow = findEmptyRow();
        if (!targetRow) targetRow = await appendEmptyRow();

        const input = getRowInput(targetRow);
        if (!input) {
            console.warn("[Cdns] 未找到可填写的 CDN 输入框：", text);
            return;
        }

        input.focus();
        setInputValue(input, text);
        input.blur();
        targetRow.dataset.cdnOriginName = name;

        await waitUntil(() => getRows().some((row) => getRowInput(row)?.value === text), 500);
    };

    const findRemoveButton = (row) =>
        row.querySelector(SELECTORS.remove) ||
        Array.from(row.querySelectorAll("button")).find((button) => {
            const text = button.textContent?.trim();
            return text === "删除" || text === "X" || text === "×";
        });

    const removeOneMatchingRow = async (name, paths) => {
        const targetRow = getRows().find((row) => {
            const value = getRowInput(row)?.value.trim() || "";
            return row.dataset.cdnOriginName === name || paths.includes(value);
        });
        if (!targetRow) return false;

        const rowsBefore = getRows();
        const input = getRowInput(targetRow);
        const removeButton = findRemoveButton(targetRow);

        if (removeButton && !removeButton.disabled) {
            removeButton.click();
            await waitUntil(
                () => !document.contains(targetRow) || getRows().length < rowsBefore.length,
                800,
            );
        } else if (input) {
            setInputValue(input, "");
            input.blur();
            delete targetRow.dataset.cdnOriginName;
            await sleep(30);
        }

        return true;
    };

    const removeCdns = async (name) => {
        const item = CdnList.find((entry) => entry.name === name);
        if (!item) return;

        for (let index = 0; index < item.path.length + 2; index += 1) {
            const removed = await removeOneMatchingRow(name, item.path);
            if (!removed) break;
        }
    };

    const escapeHtml = (value) =>
        value.replace(
            /[&<>'"]/g,
            (char) =>
                ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
                    char
                ],
        );

    const createPanel = () => {
        if (document.querySelector("#manual-cdn")) return null;

        const panel = document.createElement("div");
        panel.id = "manual-cdn";
        panel.innerHTML = `
            <div class="cdn-header">
                <div class="cdn-header-top">
                    <span class="cdn-title">CDN 快速填充</span>
                    <span class="cdn-count">共 ${CdnList.length} 项</span>
                </div>
                <div class="cdn-search-box">
                    <input type="search" id="cdn-search-input" placeholder="搜索名称或 Git..." autocomplete="off">
                </div>
            </div>
            <div class="cdn-list-wrapper">
                ${CdnList.map((item, index) => {
                    const name = escapeHtml(item.name);
                    const git = escapeHtml(item.git);
                    const pathText = item.path.join("\n");
                    const preview = item.path[0].replace("https://gbfek.dfcfw.com/", ".../");
                    return `
                        <div class="item" data-search="${escapeHtml(
                            `${item.name} ${item.git} ${pathText}`.toLowerCase(),
                        )}" title="${escapeHtml(pathText)}">
                            <input type="checkbox" class="inp-item" id="cdn-item-${index}" data-name="${name}">
                            <label for="cdn-item-${index}">
                                <span class="item-info">
                                    <span class="item-header">
                                        <span class="name">${name}</span>
                                        ${git ? `<span class="git-tag">${git}</span>` : ""}
                                    </span>
                                    <span class="item-meta">
                                        <span>${item.path.length} 个地址</span>
                                        <span class="path-preview">${escapeHtml(preview)}</span>
                                    </span>
                                </span>
                            </label>
                        </div>`;
                }).join("")}
            </div>`;

        document.body.appendChild(panel);
        return panel;
    };

    const bindPanelEvents = (panel) => {
        const searchInput = panel.querySelector("#cdn-search-input");
        searchInput.addEventListener("input", () => {
            const query = searchInput.value.toLowerCase().trim();
            panel.querySelectorAll(".item").forEach((item) => {
                item.hidden = !item.dataset.search.includes(query);
            });
        });

        let operation = Promise.resolve();
        panel.querySelectorAll(".inp-item").forEach((checkbox) => {
            checkbox.addEventListener("change", () => {
                checkbox.disabled = true;
                operation = operation
                    .then(async () => {
                        const item = CdnList.find((entry) => entry.name === checkbox.dataset.name);
                        if (!item) return;

                        if (checkbox.checked) {
                            for (const path of item.path) await insertCdn(path, item.name);
                        } else {
                            await removeCdns(item.name);
                        }
                    })
                    .catch((error) => console.error("[Cdns] 更新 CDN 路径失败：", error))
                    .finally(() => {
                        checkbox.disabled = false;
                    });
            });
        });
    };

    const addStyles = () => {
        const style = document.createElement("style");
        style.textContent = `
            #manual-cdn {
                position: fixed; top: 20px; right: 20px; z-index: 10000;
                display: flex; flex-direction: column; width: 320px;
                max-height: calc(100vh - 40px); overflow: hidden;
                color: #24292e; background: #fff; border: 1px solid #e1e4e8;
                border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,.15);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }
            #manual-cdn * { box-sizing: border-box; }
            #manual-cdn .cdn-header {
                display: flex; flex-direction: column; gap: 8px; padding: 10px 14px;
                background: #f8f9fa; border-bottom: 1px solid #f1f1f1;
            }
            #manual-cdn .cdn-header-top,
            #manual-cdn .item-header,
            #manual-cdn .item-meta { display: flex; align-items: center; justify-content: space-between; }
            #manual-cdn .cdn-title { font-size: 13px; font-weight: 700; }
            #manual-cdn .cdn-count { color: #6a737d; font-size: 11px; }
            #manual-cdn #cdn-search-input {
                width: 100%; padding: 6px 10px; color: #24292e; background: #fff;
                border: 1px solid #ddd; border-radius: 4px; outline: none; font-size: 12px;
            }
            #manual-cdn #cdn-search-input:focus {
                border-color: #0366d6; box-shadow: 0 0 0 2px rgba(3,102,214,.1);
            }
            #manual-cdn .cdn-list-wrapper { flex: 1; overflow-y: auto; }
            #manual-cdn .item {
                display: flex; align-items: center; padding: 4px 12px;
                border-bottom: 1px solid #f6f8fa;
            }
            #manual-cdn .item[hidden] { display: none; }
            #manual-cdn .item:hover { background: #f1f8ff; }
            #manual-cdn .inp-item { width: 14px; height: 14px; margin: 0 10px 0 0; cursor: pointer; }
            #manual-cdn label { display: block; flex: 1; padding: 4px 0; cursor: pointer; }
            #manual-cdn .item-info { display: flex; flex-direction: column; line-height: 1.2; }
            #manual-cdn .item-header { justify-content: flex-start; gap: 6px; margin-bottom: 2px; }
            #manual-cdn .name { font-size: 13px; font-weight: 600; }
            #manual-cdn .git-tag {
                padding: 0 4px; color: #0366d6; background: #f1f8ff;
                border: 1px solid #c8e1ff; border-radius: 2px; font-size: 10px;
            }
            #manual-cdn .item-meta { color: #586069; font-size: 10px; }
            #manual-cdn .path-preview {
                max-width: 180px; overflow: hidden; color: #888;
                text-overflow: ellipsis; white-space: nowrap;
            }
            #manual-cdn .cdn-list-wrapper::-webkit-scrollbar { width: 4px; }
            #manual-cdn .cdn-list-wrapper::-webkit-scrollbar-thumb {
                background: #d1d5da; border-radius: 2px;
            }
        `;
        document.head.appendChild(style);
    };

    const init = async () => {
        const pageReady = await waitUntil(
            () => document.querySelector(".url-input-list, .list_item") && getAddRowBtn(),
            5000,
        );
        if (!pageReady) {
            console.warn("[Cdns] 页面初始化超时，未找到 CDN 输入区域。");
            return;
        }

        addStyles();
        const panel = createPanel();
        if (panel) bindPanelEvents(panel);
    };

    void init();
})();
