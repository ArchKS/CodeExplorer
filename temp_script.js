        // 使用 dom-to-image 实现全页截图功能
        async function downloadPageAsPNG() {
            const btn = event.currentTarget;
            const originalContent = btn.innerHTML;
            const node = document.body;
            
            try {
                btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> 生成中...';
                btn.disabled = true;

                const filter = (el) => {
                    if (el.classList && el.classList.contains('fixed')) return false;
                    return true;
                };

                const dataUrl = await domtoimage.toPng(node, {
                    bgcolor: '#f5f7fa',
                    filter: filter,
                    width: node.scrollWidth,
                    height: node.scrollHeight
                });

                const link = document.createElement('a');
                const title = document.getElementById('mainTitle').textContent.trim();
                link.download = `${title}_全页快照.png`;
                link.href = dataUrl;
                link.click();
            } catch (e) {
                console.error('截图失败:', e);
                alert('截图生成失败，建议使用 Chrome 浏览器。');
            } finally {
                btn.innerHTML = originalContent;
                btn.disabled = false;
            }
        }
