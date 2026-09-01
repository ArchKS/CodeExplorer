
// Intro: CDN油猴脚本
// Date: 2026.04.29
// Tag: 工作


// ==UserScript==
// @name         Tips
// @namespace    http://tampermonkey.net/
// @version      2025-04-14
// @description  try to take over the world!
// @author       You
// @match        http://10.228.130.212:42657/cdn
// @match        http://10.126.136.20:42657/cdn
// @match        http://localhost:42657/cdn
// @icon         https://www.google.com/s2/favicons?sz=64&domain=eastmoney.com
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const CdnList = [
        {
            name: "新版话题H5",
            git: "mgubatopic2025",
            path: ["https://gbfek.dfcfw.com/deploy/fd_mgubatopic2025/work/"],
        },
        {
            name: "老版话题H5",
            path: ["https://gbfek.dfcfw.com/deploy/mtopic2020/work/"],
            git: "mtopic2020"
        },
        {
            name: "股吧Web",
            path: ["https://gbfek.dfcfw.com/deploy/fd_guba_web2022/work/"],
            git: ''
        },
        {
            name: "股吧PC",
            path: ["https://gbfek.dfcfw.com/deploy/fd_guba_pc2022/work/"],
            git: ''
        },
        {
            name: "股吧Rank",
            path: ["https://gbfek.dfcfw.com/deploy/rank_web/work/rank_stock.js"],
            git: ''
        },
        {
            name: "期货正文",
            path: ["https://gbfek.dfcfw.com/gubaapi/qihuo_embed/"],
            git: ''
        },
        {
            name: "期货话题",
            path: ["https://gbfek.dfcfw.com/deploy/fd_guba_mqihuotopic/work/"],
            git: ''
        },
        {
            name: "问董秘",
            path: ["https://gbfek.dfcfw.com/deploy/mgubaqa/work/", "https://gbfek.dfcfw.com/deploy/guba_web_qa/work/"],
            git: ''
        },
        {
            name: "举报",
            path: [
                "https://gbfek.dfcfw.com/deploy/help_web/work/",
                "https://gbfek.dfcfw.com/deploy/help_waph5/work/",
                "https://gbfek.dfcfw.com/deploy/help_apph5/work/",
            ],
            git: ''
        },
        {
            name: "财富号列表",
            path: ["https://gubawebcs.eastmoney.com/gubawebapi/comment_list_new/cfhlist.js"],
            git: "",
        },
        {
            name: "评论列表-资讯/财富号",
            path:["https://gbfek.dfcfw.com/deploy/guba_module_comment_list_new/work/editor_and_list.js"],
            git: "",
        },
        {
            name: "群聊",
            path: ["https://gbfek.dfcfw.com/deploy/fd_groupchat_comp/work/","https://gbfek.dfcfw.com/deploy/fd_groupchat_comp/work/static/"],
            git: "",
        }
    ];

    const getAddRowBtn = () => {
        return Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('增加一行')) ||
               document.querySelector('button[type="button"]');
    };

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    const ManualEl = document.createElement("div");
    ManualEl.id = 'manual-cdn';

    let html = `
        <div class="cdn-header">
            <div class="cdn-header-top">
                <span class="cdn-title">CDN 快速填充</span>
                <span class="cdn-count">共 ${CdnList.length} 项</span>
            </div>
            <div class="cdn-search-box">
                <input type="text" id="cdn-search-input" placeholder="搜索名称或 Git..." autocomplete="off">
            </div>
        </div>
        <div class="cdn-list-wrapper">
    `;

    CdnList.forEach(item => {
        html += `
            <div class="item" title="${item.path.join('\n')}">
                <input type="checkbox" class="inp-item" id="chk-${item.name}" data-name="${item.name}"/>
                <label for="chk-${item.name}">
                    <div class="item-info">
                        <div class="item-header">
                            <span class="name">${item.name}</span>
                            ${item.git ? `<span class="git-tag">${item.git}</span>` : ''}
                        </div>
                        <div class="item-meta">
                            <span class="path-count">${item.path.length}个地址</span>
                            <span class="path-preview">${item.path[0].replace('https://gbfek.dfcfw.com/', '.../')}</span>
                        </div>
                    </div>
                </label>
            </div>
        `;
    })
    html += '</div>';

    ManualEl.innerHTML = html;
    document.body.insertAdjacentElement("beforeend", ManualEl);

    // === 搜索功能实现 ===
    const searchInput = ManualEl.querySelector('#cdn-search-input');
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const items = ManualEl.querySelectorAll('.item');
        items.forEach(item => {
            const name = item.querySelector('.name').innerText.toLowerCase();
            const gitTag = item.querySelector('.git-tag');
            const git = gitTag ? gitTag.innerText.toLowerCase() : '';
            const paths = item.getAttribute('title').toLowerCase();
            if (name.includes(query) || git.includes(query) || paths.includes(query)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    });

    const insertCdn = async (text, name) => {
        let listItems = Array.from(document.querySelectorAll(".list_item"));
        // 查找第一个空的输入框，优先使用现有的空位
        let targetItem = listItems.find(item => {
            const inp = item.querySelector("input");
            return inp && (!inp.value || inp.value.trim() === "");
        });

        if (!targetItem) {
            const addRowBtn = getAddRowBtn();
            if (addRowBtn) {
                addRowBtn.click();
                await sleep(100); // 等待页面渲染完成
                listItems = Array.from(document.querySelectorAll(".list_item"));
                targetItem = listItems[listItems.length - 1];
            }
        }

        if (targetItem) {
            const inp = targetItem.querySelector("input");
            if (inp) {
                // 关键：兼容 React/Vue 等框架的赋值方式
                // 直接修改 value 属性可能不会触发框架的状态更新，导致点击增加行时旧数据丢失
                const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                if (setter) {
                    setter.call(inp, text);
                } else {
                    inp.value = text;
                }
                
                targetItem.dataset.originName = name;
                // 触发必要事件以通知框架更新状态
                inp.dispatchEvent(new Event('input', { bubbles: true }));
                inp.dispatchEvent(new Event('change', { bubbles: true }));
                // 某些框架在 blur 时同步数据
                inp.dispatchEvent(new Event('blur', { bubbles: true }));
            }
        }
    }

    const removeCdns = async (name) => {
        const filterItem = CdnList.find(it => it.name === name);
        const paths = filterItem ? filterItem.path : [];
        const addRowBtn = getAddRowBtn();
        
        // 多次扫描，确保所有条目都被正确删除
        let found = true;
        let attempts = 0;
        while (found && attempts < 10) {
            found = false;
            attempts++;
            
            const rows = Array.from(document.querySelectorAll(".list_item"));
            for (const row of rows) {
                const inp = row.querySelector('input');
                const rowValue = inp ? inp.value.trim() : '';
                
                // 匹配逻辑：通过 dataset 或者直接匹配路径值（防止框架重绘导致 dataset 丢失）
                if (row.dataset.originName === name || (rowValue && paths.includes(rowValue))) {
                    found = true;
                    
                    // 更强大的删除按钮查找逻辑
                    const delBtn = row.querySelector('.delbtn') || 
                                   row.querySelector('button[type="button"]') ||
                                   Array.from(row.querySelectorAll('button')).find(b => {
                                       const text = b.innerText.trim();
                                       return text.includes('删除') || text === 'X' || text === '×' || 
                                              b.classList.contains('delbtn') || b.classList.contains('del');
                                   });
                    
                    if (delBtn && delBtn !== addRowBtn) {
                        delBtn.click();
                        await sleep(50); // 等待删除完成
                    } else if (inp) {
                        // 如果没找到删除按钮，先清空value
                        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                        if (setter) setter.call(inp, '');
                        else inp.value = '';
                        delete row.dataset.originName;
                        inp.dispatchEvent(new Event('input', { bubbles: true }));
                        inp.dispatchEvent(new Event('change', { bubbles: true }));
                        inp.dispatchEvent(new Event('blur', { bubbles: true }));
                        await sleep(30);
                        
                        // 再尝试找到删除按钮并点击
                        const delBtn2 = row.querySelector('.delbtn') || 
                                       row.querySelector('button[type="button"]') ||
                                       Array.from(row.querySelectorAll('button')).find(b => {
                                           const text = b.innerText.trim();
                                           return text.includes('删除') || text === 'X' || text === '×';
                                       });
                        if (delBtn2 && delBtn2 !== addRowBtn) {
                            delBtn2.click();
                            await sleep(50);
                        }
                    }
                    break; // 删除一个后重新扫描
                }
            }
        }
    }

    document.querySelectorAll(".inp-item").forEach(checkbox => {
        checkbox.addEventListener("change", async (e) => {
            const name = e.target.dataset.name;
            const filterItem = CdnList.find(it => it.name === name);
            if (e.target.checked) {
                for (const p of filterItem.path) {
                    await insertCdn(p, name);
                }
            } else {
                await removeCdns(name);
            }
        })
    });

    // === ✨ 优化 UI 样式 ===
    const style = document.createElement('style');
    style.innerHTML = `
        #manual-cdn {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #fff;
            border-radius: 10px;
            width: 320px;
            max-height: calc(100vh - 40px);
            display: flex;
            flex-direction: column;
            z-index: 10000;
            box-shadow: 0 10px 30px rgba(0,0,0,0.15);
            border: 1px solid #e1e4e8;
            font-family: -apple-system, system-ui, sans-serif;
            overflow: hidden;
        }

        .cdn-header {
            padding: 10px 14px;
            border-bottom: 1px solid #f1f1f1;
            display: flex;
            flex-direction: column;
            gap: 8px;
            background: #f8f9fa;
        }

        .cdn-header-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .cdn-title {
            font-weight: bold;
            font-size: 13px;
            color: #24292e;
        }

        .cdn-search-box input {
            width: 100%;
            padding: 6px 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 12px;
            outline: none;
            box-sizing: border-box;
            transition: border-color 0.2s;
        }

        .cdn-search-box input:focus {
            border-color: #0366d6;
            box-shadow: 0 0 0 2px rgba(3,102,214,0.1);
        }

        .cdn-count {
            font-size: 11px;
            color: #6a737d;
        }

        .cdn-list-wrapper {
            overflow-y: auto;
            flex: 1;
        }

        #manual-cdn .item {
            display: flex;
            align-items: center;
            padding: 4px 12px;
            border-bottom: 1px solid #f6f8fa;
            transition: background 0.1s;
        }

        #manual-cdn .item:last-child {
            border-bottom: none;
        }

        #manual-cdn .item:hover {
            background: #f1f8ff;
        }

        #manual-cdn .inp-item {
            margin: 0 10px 0 0;
            cursor: pointer;
            width: 14px;
            height: 14px;
        }

        #manual-cdn label {
            flex: 1;
            cursor: pointer;
            margin: 0;
            padding: 4px 0;
            display: block;
        }

        .item-info {
            display: flex;
            flex-direction: column;
            line-height: 1.2;
        }

        .item-header {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 2px;
        }

        .item-info .name {
            font-size: 13px;
            font-weight: 600;
            color: #24292e;
        }

        .item-info .git-tag {
            font-size: 10px;
            color: #0366d6;
            background: #f1f8ff;
            padding: 0 4px;
            border-radius: 2px;
            border: 1px solid #c8e1ff;
        }

        .item-meta {
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            color: #586069;
        }

        .path-preview {
            max-width: 180px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: #888;
        }

        .cdn-list-wrapper::-webkit-scrollbar {
            width: 4px;
        }
        .cdn-list-wrapper::-webkit-scrollbar-thumb {
            background: #d1d5da;
            border-radius: 2px;
        }
    `;
    document.head.appendChild(style);

})();
