// Intro: 东财证券报表同比显示
// Prev: ../img/EmSheetPrev.png
// Tag: 网页脚本
// 油猴脚本

// ==UserScript==
// @name         财务报表同比显示
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  在营业总收入行后面显示对应的同比百分比，正同比显示红色，负同比显示绿色
// @author       GitHub Copilot
// @match        https://emweb.securities.eastmoney.com/*/pages/home/index.html?code=*&type=web&color=w
// @match        file:///*
// @require      https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js
// @require      https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    let showYoY = false;

    const style = document.createElement('style');
    style.textContent = `
    #title,#webHeader,.topAnchor,#zyzbChart,.top-nav-wrap,#bottom,.remind,.content.content_zyzb{
        display: none;
    }
        .gm-yoy-append {
            margin-left: 0.2em;
            font-weight: 600;
            font-size: 12px;
            white-space: nowrap;
        }
        .container{
            width: auto !important;
        }
        /* 强制表格及容器加宽并居中 */
        table, .table-wrapper, .main-table, .content-wrapper {
            width: 98% !important;
            max-width: 1400px !important; /* 限制一个最大宽度，防止在大屏上拉得太稀 */
            margin-left: auto !important;
            margin-right: auto !important;
            table-layout: auto !important;
            float: none !important; /* 移除可能的浮动干扰 */
        }
        /* 确保单元格不会因为内容增加而强制换行 */
        td.txtRight {
            white-space: nowrap !important;
            min-width: 120px;
        }
        /* 加宽第一列（指标名称列） */
        td.white, th.white,
        tr td:first-child,
        tr th:first-child {
            min-width: 200px !important;
            width: 200px !important;
            white-space: normal !important; /* 第一列允许折行以保持宽度 */
            text-align: left !important;
        }
        #gm-yoy-toggle-btn, #gm-download-btn {
            position: fixed;
            bottom: 20px;
            z-index: 99999;
            padding: 8px 16px;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            font-size: 14px;
            font-family: sans-serif;
            transition: background 0.3s;
        }
        #gm-yoy-toggle-btn {
            right: 20px;
            background: #2196F3;
        }
        #gm-download-btn {
            right: 150px;
            background: #4CAF50;
        }
        #gm-yoy-toggle-btn:hover { background: #1976D2; }
        #gm-download-btn:hover { background: #45a049; }
        #gm-yoy-toggle-btn.active { background: #f44336; }

        /* 图表容器样式 */
        #gm-chart-container {
            position: fixed;
            top: 60px;
            right: 20px;
            width: 600px;
            height: 400px;
            min-width: 400px;
            min-height: 300px;
            background: white;
            z-index: 100000;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            border-radius: 12px;
            padding: 15px;
            display: none;
            border: 1px solid #ddd;
            cursor: move;
            resize: both; /* 允许双向拉伸 */
            overflow: hidden; /* 配合 resize */
        }
        #gm-chart-close {
            position: absolute;
            top: 5px;
            right: 10px;
            cursor: pointer;
            font-size: 24px;
            color: #999;
            font-weight: bold;
            z-index: 100001; /* 确保在图表之上 */
            padding: 5px;
        }
        #gm-chart-close:hover { color: #f44336; }
        tr:hover td { background-color: #f0f7ff !important; cursor: pointer; }
    `;
    document.head.appendChild(style);

    function formatPercent(raw) {
        const num = parseFloat(raw.replace(/[^\d.-]+/g, ''));
        if (Number.isNaN(num)) return null;
        const sign = num > 0 ? '+' : '';
        return `${sign}${num.toFixed(2)}%`;
    }

    function parseValue(text, tr = null) {
        if (!text || text === '--' || text === '-') return null;

        // 只处理斜杠前的原始数值部分
        let rawValStr = text.split('/')[0].trim();
        let val = parseFloat(rawValStr.replace(/[^\d.-]+/g, ''));
        if (Number.isNaN(val)) return null;

        // 单位识别优先级：文本内单位 > tr属性单位
        let multiplier = 1;
        const unitText = rawValStr + (tr ? (tr.getAttribute('data-unit') || '') : '');

        if (unitText.includes('亿')) {
            multiplier = 100000000;
        } else if (unitText.includes('万')) {
            multiplier = 10000;
        }

        return val * multiplier;
    }

    let isProcessing = false;

    async function collectAllData() {
        if (isProcessing) return;
        isProcessing = true;

        // 1. 清理现有的同比数据，确保从白纸开始汇总
        document.querySelectorAll('.gm-yoy-append').forEach(el => el.remove());
        updateBtn('正在全历史数据汇总...', true);

        const sections = document.querySelectorAll('.content');
        for (const section of sections) {
            // 2. 切换到“年度”
            const annualTab = Array.from(section.querySelectorAll('.dataTab li'))
                .find(t => t.textContent.includes('年度'));
            if (annualTab && !annualTab.classList.contains('active')) {
                annualTab.click();
                await new Promise(r => setTimeout(r, 800));
            }

            // 3. 循环采集并翻页（此时不计算同比）
            const tableData = new Map();
            let allYears = new Set();

            while (true) {
                const table = section.querySelector('table');
                if (!table) break;

                const rows = Array.from(table.querySelectorAll('tr'));
                const headerCells = Array.from(rows[0].querySelectorAll('th, td')).slice(1);
                const currentYears = headerCells.map(c => c.textContent.trim());

                currentYears.forEach(y => allYears.add(y));

                rows.slice(1).forEach(row => {
                    const labelCell = row.querySelector('td.white, th.white');
                    if (!labelCell) return;
                    const label = labelCell.textContent.trim();
                    const valueCells = Array.from(row.querySelectorAll('td.txtRight'));

                    if (!tableData.has(label)) tableData.set(label, {});
                    currentYears.forEach((year, idx) => {
                        if (valueCells[idx]) {
                            tableData.get(label)[year] = valueCells[idx].textContent.trim();
                        }
                    });
                });

                let nextBtn = section.querySelector('.tableBtn .next');
                if (nextBtn && getComputedStyle(nextBtn).display !== 'none') {
                    nextBtn.click();
                    await new Promise(r => setTimeout(r, 600)); // 翻页等待
                } else {
                    break;
                }
            }

            // 4. 重绘该表格（生成包含所有年份的超宽表）
            const sortedYears = Array.from(allYears).sort((a, b) => {
                const getVal = s => parseInt(s.replace(/[^\d]/g, '')) || 0;
                return getVal(b) - getVal(a);
            });

            const table = section.querySelector('table');
            const rows = Array.from(table.querySelectorAll('tr'));

            const headerRow = rows[0];
            const firstHeader = headerRow.querySelector('th, td');
            headerRow.innerHTML = '';
            headerRow.appendChild(firstHeader);
            sortedYears.forEach(y => {
                const th = document.createElement('th');
                th.textContent = y;
                headerRow.appendChild(th);
            });

            rows.slice(1).forEach(row => {
                const labelCell = row.querySelector('td.white, th.white');
                if (!labelCell) return;
                const label = labelCell.textContent.trim();
                const rowData = tableData.get(label) || {};

                row.innerHTML = '';
                row.appendChild(labelCell);
                sortedYears.forEach(y => {
                    const td = document.createElement('td');
                    td.className = 'txtRight';
                    td.textContent = rowData[y] || '--';
                    row.appendChild(td);
                });
            });
        }

        // 5. 所有表格重绘完毕后，再进行一次性的同比计算
        isProcessing = false;
        updateBtn('隐藏同比数据', false);
        const btn = document.getElementById('gm-yoy-toggle-btn');
        if (btn) btn.classList.add('active');

        // 延迟一帧确保 DOM 渲染完成再计算
        requestAnimationFrame(() => {
            processAllTables();
        });
    }

    function processAllTables() {
        const rows = Array.from(document.querySelectorAll('tr'));

        rows.forEach(row => {
            const labelCell = row.querySelector('td.white, th.white, td.txtLeft');
            if (!labelCell) return;
            const label = labelCell.textContent.trim();

            // 无论是否开启同比，都强制隐藏截止日期行
            if (label.includes("截止日期") || label.includes("报表截止日")) {
                row.style.setProperty('display', 'none', 'important');
                return;
            }

            if (!showYoY || isProcessing) return; // 如果未开启同比或正在同步，跳过后续计算逻辑

            if (label.includes('%') || label.includes('增长') || label.includes('比率') || label.includes('点')) return;

            const cells = Array.from(row.querySelectorAll('td.txtRight'));
            if (cells.length < 2) return;

            cells.forEach((cell, i) => {
                if (cell.querySelector('.gm-yoy-append')) return;

                const currentVal = parseValue(cell.textContent, row);
                const nextCell = cells[i + 1];
                if (currentVal !== null && currentVal !== 0 && nextCell) {
                    const prevVal = parseValue(nextCell.textContent, row);
                    if (prevVal !== null && prevVal !== 0) {
                        const calc = ((currentVal - prevVal) / Math.abs(prevVal)) * 100;
                        const sign = calc > 0 ? '+' : '';
                        const color = calc > 0 ? '#f00' : '#008000';

                        const span = document.createElement('span');
                        span.className = 'gm-yoy-append';
                        span.textContent = `/${sign}${calc.toFixed(2)}%`;
                        span.style.color = color;
                        cell.appendChild(span);
                    }
                }
            });
        });
    }

    function updateBtn(text, processing) {
        const btn = document.getElementById('gm-yoy-toggle-btn');
        if (!btn) return;
        btn.textContent = text;
        if (processing) btn.classList.add('processing');
        else btn.classList.remove('processing');
    }

    function toggleYoY() {
        if (isProcessing) return;
        showYoY = !showYoY;
        if (showYoY) {
            collectAllData();
        } else {
            document.querySelectorAll('.gm-yoy-append').forEach(el => el.remove());
            updateBtn('显示同比数据', false);
            const btn = document.getElementById('gm-yoy-toggle-btn');
            if (btn) btn.classList.remove('active');
        }
    }

    async function downloadImage() {
        const target = document.querySelector('.container') || document.body;
        const btn = document.getElementById('gm-download-btn');
        const oldText = btn.textContent;
        btn.textContent = '正在生成图片...';
        btn.disabled = true;

        try {
            const canvas = await html2canvas(target, {
                useCORS: true,
                scale: 2, // 提高清晰度
                backgroundColor: '#ffffff',
                onclone: (clonedDoc) => {
                    // 隐藏截图中的按钮
                    clonedDoc.getElementById('gm-yoy-toggle-btn').style.display = 'none';
                    clonedDoc.getElementById('gm-download-btn').style.display = 'none';
                }
            });

            const link = document.createElement('a');
            link.download = `财务报表_${document.title}_${new Date().toLocaleDateString()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (e) {
            console.error('截图失败:', e);
            alert('图片生成失败，请稍后重试');
        } finally {
            btn.textContent = oldText;
            btn.disabled = false;
        }
    }

    function makeDraggable(el) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        el.onmousedown = (e) => {
            // 1. 如果点击的是关闭按钮，不拖拽
            if (e.target.id === 'gm-chart-close') return;

            // 2. 如果点击的是右下角的拉伸手柄区域（边缘20px内），不拖拽
            const rect = el.getBoundingClientRect();
            const isResizeArea = (e.clientX > rect.right - 20) || (e.clientY > rect.bottom - 20);
            if (isResizeArea) return;

            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = () => {
                document.onmouseup = null;
                document.onmousemove = null;
            };
            document.onmousemove = (e) => {
                e.preventDefault();
                pos1 = pos3 - e.clientX;
                pos2 = pos4 - e.clientY;
                pos3 = e.clientX;
                pos4 = e.clientY;
                el.style.top = (el.offsetTop - pos2) + "px";
                el.style.left = (el.offsetLeft - pos1) + "px";
                el.style.right = 'auto'; // 拖动后解除右对齐限制
            };
        };
    }

    function createButton() {
        if (document.getElementById('gm-yoy-toggle-btn')) return;

        // 创建图表容器
        const chartDiv = document.createElement('div');
        chartDiv.id = 'gm-chart-container';
        chartDiv.innerHTML = '<div id="gm-chart-close">×</div><div id="gm-chart-main" style="width:100%;height:100%;"></div>';
        document.body.appendChild(chartDiv);

        // 绑定关闭事件
        document.getElementById('gm-chart-close').onclick = (e) => {
            e.stopPropagation();
            chartDiv.style.display = 'none';
        };

        // 启用拖拽
        makeDraggable(chartDiv);

        // 监听拉伸事件，自动重绘图表
        const resizeObserver = new ResizeObserver(() => {
            if (myChart) myChart.resize();
        });
        resizeObserver.observe(chartDiv);

        const yoyBtn = document.createElement('button');
        yoyBtn.id = 'gm-yoy-toggle-btn';
        yoyBtn.textContent = '显示同比数据';
        yoyBtn.onclick = toggleYoY;
        document.body.appendChild(yoyBtn);

        const dlBtn = document.createElement('button');
        dlBtn.id = 'gm-download-btn';
        dlBtn.textContent = '下载报表图片';
        dlBtn.onclick = downloadImage;
        document.body.appendChild(dlBtn);

        // 绑定行点击事件
        document.addEventListener('click', (e) => {
            const tr = e.target.closest('tr');
            if (!tr || tr.querySelector('th')) return;
            const labelCell = tr.querySelector('td.white, th.white');
            if (!labelCell) return;
            console.log('click',tr);
            initChart(tr);
        });
    }

    let myChart = null;
    function initChart(tr) {
        const label = tr.querySelector('td.white, th.white').textContent.trim();
        console.log({label});
        const headerRow = tr.closest('table').querySelector('tr');
        const rawYears = Array.from(headerRow.querySelectorAll('th, td')).slice(1).map(c => c.textContent.trim());

        // 智能格式化函数
        const smartFormat = (v, decimals = 3) => {
            if (v === null || v === undefined) return '--';
            const absV = Math.abs(v);
            if (absV >= 100000000) return (v / 100000000).toFixed(decimals) + ' 亿';
            if (absV >= 10000) return (v / 10000).toFixed(2) + ' 万';
            return v.toFixed(2);
        };

        // 将日期格式（如 24-12-31 或 2024-12-31）统一转为 YYYY 格式
        const years = rawYears.map(y => {
            if (y.includes('-')) {
                let parts = y.split('-');
                let year = parts[0];
                if (year.length === 2) {
                    return (parseInt(year) > 50 ? '19' : '20') + year;
                }
                return year;
            }
            return y;
        });

        const valueCells = Array.from(tr.querySelectorAll('td.txtRight'));

        const dataValues = [];
        const dataYoys = [];

        valueCells.forEach(cell => {
            const fullText = cell.textContent;
            const val = parseValue(fullText, tr);
            dataValues.push(val);

            const yoySpan = cell.querySelector('.gm-yoy-append');
            let yoyVal = null;
            if (yoySpan) {
                yoyVal = parseFloat(yoySpan.textContent.replace(/[^\d.-]+/g, ''));
            }
            dataYoys.push(yoyVal);
        });

        // 倒序展示，让时间从旧到新
        years.reverse();
        dataValues.reverse();
        dataYoys.reverse();

        const container = document.getElementById('gm-chart-container');
        container.style.display = 'block';

        if (!myChart) {
            myChart = echarts.init(document.getElementById('gm-chart-main'));
        }

        const option = {
            title: { text: label, left: 'center', textStyle: { fontSize: 14 } },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                formatter: (params) => {
                    let res = params[0].name + '<br/>';
                    params.forEach(item => {
                        if (item.seriesName === '数值') {
                            res += item.marker + item.seriesName + ': ' + smartFormat(item.value) + '<br/>';
                        } else {
                            const val = item.value === null ? '--' : item.value + '%';
                            res += item.marker + item.seriesName + ': ' + val + '<br/>';
                        }
                    });
                    return res;
                }
            },
            legend: { data: ['数值', '同比'], top: 30 },
            grid: { top: 80, bottom: 40, right: 60, left: 80 },
            xAxis: { type: 'category', data: years },
            yAxis: [
                {
                    type: 'value',
                    name: '数值',
                    axisLabel: {
                        formatter: (v) => {
                            if (Math.abs(v) >= 100000000) return (v / 100000000).toFixed(1) + '亿';
                            if (Math.abs(v) >= 10000) return (v / 10000).toFixed(0) + '万';
                            return v;
                        }
                    }
                },
                { type: 'value', name: '同比', axisLabel: { formatter: '{value}%' }, splitLine: { show: false } }
            ],
            series: [
                {
                    name: '数值',
                    type: 'bar',
                    data: dataValues,
                    itemStyle: { color: '#2196F3' },
                    label: {
                        show: true,
                        position: 'top',
                        formatter: (p) => p.value ? smartFormat(p.value, 2) : ''
                    }
                },
                { name: '同比', type: 'line', yAxisIndex: 1, data: dataYoys, itemStyle: { color: '#f44336' }, lineStyle: { width: 3 } }
            ]
        };

        myChart.setOption(option, true);
    }

    // 初始化按钮并监听DOM变化
    createButton();
    const observer = new MutationObserver(() => {
        createButton();
        // 只有当不是正在同步且开启状态时，才尝试计算
        if (showYoY && !isProcessing) {
            processAllTables();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // 初始尝试一次
    setTimeout(processAllTables, 1000);
})();
