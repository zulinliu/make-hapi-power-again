(function () {
    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
    const focusableSelector = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'textarea:not([disabled])',
        'select:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    function setText(selector, text) {
        const node = $(selector);
        if (node) node.textContent = text;
    }

    function toast(title, detail, icon = '⚡') {
        let stack = $('.toast-stack');
        if (!stack) {
            stack = document.createElement('div');
            stack.className = 'toast-stack';
            document.body.appendChild(stack);
        }
        const item = document.createElement('div');
        item.className = 'toast';
        item.innerHTML = `<div aria-hidden="true">${icon}</div><div><strong>${title}</strong><span>${detail}</span></div>`;
        stack.appendChild(item);
        setTimeout(() => item.remove(), 3600);
    }

    function setAppInert(isInert) {
        document.body.classList.toggle('overlay-open', isInert);
        Array.from(document.body.children).forEach((child) => {
            if (child.classList.contains('overlay-root') || child.classList.contains('toast-stack') || child.classList.contains('power-grid') || child.tagName === 'SCRIPT') return;
            if (isInert) child.setAttribute('inert', '');
            else child.removeAttribute('inert');
        });
    }

    function syncOverlayState() {
        $$('.overlay-root').forEach((root) => {
            const isOpen = root.dataset.open === 'true';
            root.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
            root.inert = !isOpen;
        });
        setAppInert(Boolean($('.overlay-root[data-open="true"]')));
    }

    function closeOverlay(root, options = {}) {
        if (!root) return;
        const { restoreFocus = true } = options;
        root.dataset.open = 'false';
        root.setAttribute('aria-hidden', 'true');
        root.inert = true;
        syncOverlayState();
        const last = root.__lastFocus;
        if (restoreFocus && last && typeof last.focus === 'function') setTimeout(() => last.focus(), 40);
    }

    function openOverlay(id, trigger) {
        const root = document.getElementById(id);
        if (!root) return;
        $$('.overlay-root[data-open="true"]').forEach((openRoot) => {
            if (openRoot !== root) closeOverlay(openRoot, { restoreFocus: false });
        });
        root.__lastFocus = trigger || document.activeElement;
        root.inert = false;
        root.dataset.open = 'true';
        root.setAttribute('aria-hidden', 'false');
        syncOverlayState();
        const focusTarget = $('[data-autofocus], button, input, textarea, [tabindex]:not([tabindex="-1"])', root);
        if (focusTarget) setTimeout(() => focusTarget.focus(), 40);
    }

    function getTopOverlay() {
        const open = $$('.overlay-root[data-open="true"]');
        return open[open.length - 1] || null;
    }

    function trapFocus(event) {
        const root = getTopOverlay();
        if (!root) return;
        const focusables = $$(focusableSelector, root).filter((node) => node.offsetParent !== null || node === document.activeElement);
        if (!focusables.length) {
            event.preventDefault();
            return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    function enhanceMobileSheets() {
        $$('.mobile-sheet .overlay-body').forEach((body) => {
            if ($('[data-close-overlay]', body)) return;
            const close = document.createElement('button');
            close.className = 'icon-btn sheet-close';
            close.type = 'button';
            close.setAttribute('data-close-overlay', '');
            close.setAttribute('aria-label', '关闭');
            close.textContent = '×';
            body.prepend(close);
        });
    }

    function initAccessibilityState() {
        $$('[data-mobile-tab]').forEach((item) => item.setAttribute('aria-selected', item.classList.contains('active') ? 'true' : 'false'));
        $$('[data-module]').forEach((item) => item.setAttribute('aria-current', item.classList.contains('active') ? 'page' : 'false'));
        $$('.git-step-tab').forEach((item) => item.setAttribute('aria-selected', item.classList.contains('active') ? 'true' : 'false'));
        $$('.overlay-root').forEach((root) => { root.inert = root.dataset.open !== 'true'; });
        syncOverlayState();
    }

    window.HapiProto = { toast, openOverlay, closeOverlay };

    enhanceMobileSheets();
    initAccessibilityState();

    document.addEventListener('click', (event) => {
        const closeBtn = event.target.closest('[data-close-overlay]');
        const openBtn = event.target.closest('[data-open-overlay]');
        if (closeBtn) {
            closeOverlay(closeBtn.closest('.overlay-root'), { restoreFocus: !openBtn });
            if (!openBtn) return;
        }
        if (openBtn) {
            openOverlay(openBtn.dataset.openOverlay, openBtn);
            return;
        }
        if (event.target.classList.contains('scrim')) {
            closeOverlay(event.target.closest('.overlay-root'));
            return;
        }
        const toastBtn = event.target.closest('[data-toast]');
        if (toastBtn) {
            toast(toastBtn.dataset.toast || '操作已完成', toastBtn.dataset.toastDetail || '状态已同步到工作台。', toastBtn.dataset.toastIcon || '⚡');
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            $$('.overlay-root[data-open="true"]').forEach((root) => closeOverlay(root));
        }
        if (event.key === 'Tab') trapFocus(event);
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            const target = document.getElementById('command-palette') ? 'command-palette' : 'mobile-search';
            openOverlay(target, document.activeElement);
        }
    });

    function activateByData(groupSelector, itemSelector, attr, callback) {
        $$(itemSelector).forEach((item) => {
            item.addEventListener('click', () => {
                const group = item.closest(groupSelector) || document;
                const items = $$(itemSelector, group);
                items.forEach((n) => {
                    n.classList.remove('active');
                    if (n.hasAttribute('aria-selected')) n.setAttribute('aria-selected', 'false');
                    if (n.hasAttribute('aria-current')) n.setAttribute('aria-current', 'false');
                });
                item.classList.add('active');
                if (item.hasAttribute('aria-selected')) item.setAttribute('aria-selected', 'true');
                if (item.hasAttribute('aria-current')) item.setAttribute('aria-current', 'page');
                callback?.(item.dataset[attr], item);
            });
        });
    }

    activateByData('[data-module-tabs]', '[data-module]', 'module', (module, item) => {
        const root = item.closest('.prototype-frame') || document;
        $$('[data-module-view]', root).forEach((view) => {
            view.hidden = view.dataset.moduleView !== module;
        });
        setText('[data-current-module]', item.textContent.trim());
        const subtitles = {
            chat: '驾驶 Agent、发送实时引导、观察上下文风险。',
            files: '统一文件管理、搜索、预览、编辑和上传入口。',
            git: '分支态势、Diff、提交篮和同步风险在一个决策舱内完成。',
            terminal: '远程 PTY、常用快捷键和运行状态。',
            assets: '把会话沉淀为摘要、决策、PRD、导出包和项目记忆。',
            extensions: '管理 Skills、Plugins 和工作台扩展。',
            settings: '外观、通知、语言、权限和安全。',
            models: '模型供应商、健康检查、能力矩阵和 Agent 分配。'
        };
        setText('[data-current-subtitle]', subtitles[module] || '统一工作台模块。');
        toast('已切换模块', `当前查看：${item.textContent.trim()}`, '↗');
    });

    activateByData('[data-mobile-tabs]', '[data-mobile-tab]', 'mobileTab', (tab, item) => {
        const device = item.closest('.mobile-device') || document;
        $$('[data-mobile-page]', device).forEach((page) => page.classList.toggle('active', page.dataset.mobilePage === tab));
        const titles = { chat: '聊天', files: '文件', git: 'Git', terminal: '终端', assets: '资产' };
        setText('[data-mobile-title]', titles[tab] || 'Hapi Power');
    });

    activateByData('[data-segments]', '[data-segment]', 'segment', (segment, item) => {
        const target = item.closest('[data-segment-target]')?.dataset.segmentTarget;
        if (!target) return;
        $$(`[data-segment-view="${target}"]`).forEach((view) => {
            view.hidden = view.dataset.segmentValue !== segment;
        });
    });

    $$('.tree-row, .git-row, .data-row, .session-card').forEach((row) => {
        row.addEventListener('click', () => {
            const container = row.closest('.file-tree, .list-panel, .sidebar, .module-body') || document;
            $$('.tree-row, .git-row, .data-row, .session-card', container).forEach((n) => n.classList.remove('active'));
            row.classList.add('active');
            const title = row.querySelector('.row-title, .session-title')?.textContent?.trim() || row.textContent.trim();
            if ($('[data-inspector-focus]')) $('[data-inspector-focus]').textContent = title.replace(/\s+/g, ' ').slice(0, 56);
        });
    });

    $$('.git-flow-step').forEach((btn) => {
        btn.addEventListener('click', () => {
            const step = Number(btn.dataset.step || '1');
            $$('[data-git-step]').forEach((node) => {
                node.hidden = Number(node.dataset.gitStep) !== step;
            });
            $$('.git-step-tab').forEach((n) => {
                const active = Number(n.dataset.step || '1') === step;
                n.classList.toggle('active', active);
                n.setAttribute('aria-selected', active ? 'true' : 'false');
            });
        });
    });

    const keyboardToggle = $('[data-keyboard-toggle]');
    if (keyboardToggle) {
        keyboardToggle.addEventListener('click', () => {
            document.body.classList.toggle('keyboard-preview');
            const bar = $('.bottom-command');
            if (bar) {
                const on = document.body.classList.contains('keyboard-preview');
                bar.style.bottom = on ? '306px' : '';
                toast(on ? '键盘避让已预览' : '键盘避让已关闭', on ? 'Composer 与底栏自动上移，避免被遮挡。' : '恢复普通安全区布局。', '⌨');
            }
        });
    }
})();
