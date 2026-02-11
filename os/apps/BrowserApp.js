import { App } from '../core/App.js';
import { el } from '../utils/dom.js';

const THEMES = ['aurora', 'graphite', 'midnight'];
const ENGINE_LABEL = {
    google: 'Google',
    duck: 'DuckDuckGo',
    bing: 'Bing',
};

const DEFAULT_BOOKMARKS = [
    { label: 'Google', url: 'https://www.google.com' },
    { label: 'YouTube', url: 'https://www.youtube.com' },
    { label: 'GitHub', url: 'https://github.com' },
    { label: 'Wikipedia', url: 'https://www.wikipedia.org' },
    { label: 'Reddit', url: 'https://www.reddit.com' },
    { label: 'Netflix', url: 'https://www.netflix.com' },
];

export class BrowserApp extends App {
    constructor(kernel, pid) {
        super(kernel, pid);
        this.metadata = {
            name: 'Browser',
            id: 'browser',
            icon: 'assets/browser-icon.png',
        };
        this.storeKey = 'yamanos_browser_v1';
        this.prefsKey = 'yamanos_browser_prefs_v1';
        this._onSettingsChanged = null;
        this.queryInput = null;
    }

    async init() {
        this.root = el('div', { class: 'app-window app-browser-v2' });
        this.prefs = this.loadPrefs();
        this.state = this.loadState();
        this.savePrefs();
        this.saveState();

        this._onSettingsChanged = (event) => {
            this.prefs = this.loadPrefs(event?.detail);
            this.savePrefs();
            this.render();
        };
        window.addEventListener('yamanos:browser-settings-changed', this._onSettingsChanged);

        this.render();
    }

    destroy() {
        if (this._onSettingsChanged) {
            window.removeEventListener('yamanos:browser-settings-changed', this._onSettingsChanged);
            this._onSettingsChanged = null;
        }
        this.queryInput = null;
        super.destroy();
    }

    loadPrefs(override = null) {
        const defaults = {
            searchEngine: localStorage.getItem('yamanosSearchEngine') || 'google',
            forceWebParam: true,
            historyLimit: 20,
            startTheme: 'aurora',
        };

        let stored = {};
        try {
            stored = JSON.parse(localStorage.getItem(this.prefsKey) || '{}');
        } catch {
            stored = {};
        }

        const merged = { ...defaults, ...stored, ...(override && typeof override === 'object' ? override : {}) };
        const searchEngine = ['google', 'duck', 'bing'].includes(merged.searchEngine) ? merged.searchEngine : 'google';
        const forceWebParam = merged.forceWebParam !== false;
        const limit = Number(merged.historyLimit);
        const historyLimit = Number.isFinite(limit) ? Math.max(10, Math.min(100, Math.round(limit))) : 20;
        const startTheme = THEMES.includes(merged.startTheme) ? merged.startTheme : defaults.startTheme;

        return { searchEngine, forceWebParam, historyLimit, startTheme };
    }

    savePrefs() {
        localStorage.setItem(this.prefsKey, JSON.stringify(this.prefs));
        localStorage.setItem('yamanosSearchEngine', this.prefs.searchEngine);
    }

    loadState() {
        let raw = {};
        try {
            raw = JSON.parse(localStorage.getItem(this.storeKey) || '{}');
        } catch {
            raw = {};
        }

        let bookmarks = this._normalizeBookmarks(raw.bookmarks);
        if (!bookmarks.length) bookmarks = this._normalizeBookmarks(this._loadLegacyBookmarks());
        if (!bookmarks.length) bookmarks = DEFAULT_BOOKMARKS.map((entry) => ({ ...entry }));

        return {
            currentUrl: typeof raw.currentUrl === 'string' ? raw.currentUrl : '',
            bookmarks,
            history: this._normalizeHistory(raw.history),
        };
    }

    saveState() {
        localStorage.setItem(this.storeKey, JSON.stringify({
            currentUrl: this.state.currentUrl,
            bookmarks: this.state.bookmarks,
            history: this.state.history,
            searchEngine: this.prefs.searchEngine,
            activeFolderId: 'all',
        }));
    }

    _loadLegacyBookmarks() {
        try {
            const raw = JSON.parse(localStorage.getItem('yamanosBookmarks') || '[]');
            return Array.isArray(raw) ? raw : [];
        } catch {
            return [];
        }
    }

    _normalizeBookmarks(items) {
        if (!Array.isArray(items)) return [];
        const out = [];
        const seen = new Set();

        items.forEach((item) => {
            const url = this.resolveUrl(item?.url || '');
            if (!url || seen.has(url)) return;
            seen.add(url);

            const labelRaw = String(item?.label || '').trim();
            const label = labelRaw || this._hostFromUrl(url) || 'Saved Site';
            out.push({ label: label.slice(0, 28), url });
        });

        return out.slice(0, 36);
    }

    _normalizeHistory(items) {
        if (!Array.isArray(items)) return [];
        const out = [];
        const seen = new Set();

        items.forEach((entry) => {
            const url = this.resolveUrl(entry || '');
            if (!url || seen.has(url)) return;
            seen.add(url);
            out.push(url);
        });

        return out.slice(-Math.max(10, this.prefs.historyLimit));
    }

    render() {
        this.root.innerHTML = '';

        const shell = el('div', { class: `bb-shell bb-theme-${this.prefs.startTheme}` });
        const header = el('header', { class: 'bb-header' }, [
            el('div', { class: 'bb-title-wrap' }, [
                el('div', { class: 'bb-title' }, 'Browser'),
                el('div', { class: 'bb-subtitle' }, 'Always opens websites in a new tab'),
            ]),
            el('div', { class: 'bb-header-actions' }, [
                el('span', { class: 'bb-mode-pill' }, 'New Tab Mode'),
                el('button', {
                    class: 'bb-close',
                    type: 'button',
                    onclick: () => this.close(),
                    'aria-label': 'Close Browser',
                }, '✕'),
            ]),
        ]);

        const scroll = el('div', { class: 'bb-scroll' });
        scroll.append(
            this._buildHero(),
            this._buildActions(),
            this._buildBookmarksSection(),
            this._buildHistorySection(),
        );

        shell.append(header, scroll);
        this.root.appendChild(shell);
    }

    _buildHero() {
        this.queryInput = el('input', {
            class: 'bb-input',
            type: 'text',
            spellcheck: 'false',
            autocapitalize: 'off',
            autocomplete: 'off',
            placeholder: 'Search or type a URL…',
            value: this.state.currentUrl || '',
            onkeydown: (event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                this.navigate(this.queryInput.value);
            },
        });

        const engineRow = el('div', { class: 'bb-engine-row' });
        ['google', 'duck', 'bing'].forEach((engineId) => {
            const button = el('button', {
                class: `bb-engine-btn ${this.prefs.searchEngine === engineId ? 'is-active' : ''}`,
                type: 'button',
                onclick: () => {
                    this.prefs.searchEngine = engineId;
                    this.savePrefs();
                    this.render();
                },
            }, ENGINE_LABEL[engineId]);
            engineRow.appendChild(button);
        });

        return el('section', { class: 'bb-hero' }, [
            el('div', { class: 'bb-hero-title' }, 'Search The Web'),
            el('div', { class: 'bb-search-row' }, [
                this.queryInput,
                el('button', {
                    class: 'bb-go-btn',
                    type: 'button',
                    onclick: () => this.navigate(this.queryInput.value),
                }, 'Go'),
            ]),
            engineRow,
        ]);
    }

    _buildActions() {
        return el('div', { class: 'bb-actions' }, [
            this._actionButton('Add Bookmark', () => this.addBookmarkPrompt(this.queryInput?.value || this.state.currentUrl)),
            this._actionButton('Clear History', () => this.clearHistory()),
            this._actionButton('Theme', () => this.cycleTheme()),
        ]);
    }

    _buildBookmarksSection() {
        const section = el('section', { class: 'bb-section' }, [
            this._sectionHeader('Favorites', `${this.state.bookmarks.length} saved`),
            el('div', { class: 'bb-grid' }),
        ]);
        const grid = section.querySelector('.bb-grid');

        this.state.bookmarks.forEach((bookmark, index) => {
            const card = el('article', { class: 'bb-card' }, [
                el('button', {
                    class: 'bb-card-open',
                    type: 'button',
                    onclick: () => this.navigate(bookmark.url),
                }, [
                    el('img', {
                        class: 'bb-favicon',
                        src: this._faviconForUrl(bookmark.url),
                        alt: '',
                        loading: 'lazy',
                    }),
                    el('div', { class: 'bb-card-label', title: bookmark.label }, bookmark.label),
                    el('div', { class: 'bb-card-meta', title: bookmark.url }, this._hostFromUrl(bookmark.url) || bookmark.url),
                ]),
                el('div', { class: 'bb-card-actions' }, [
                    el('button', {
                        class: 'bb-mini-btn',
                        type: 'button',
                        title: 'Edit bookmark',
                        onclick: () => this.editBookmark(index),
                    }, 'Edit'),
                    el('button', {
                        class: 'bb-mini-btn is-danger',
                        type: 'button',
                        title: 'Remove bookmark',
                        onclick: () => this.removeBookmark(index),
                    }, 'Remove'),
                ]),
            ]);
            grid.appendChild(card);
        });

        return section;
    }

    _buildHistorySection() {
        const list = el('div', { class: 'bb-history-list' });
        const recent = this.state.history.slice().reverse().slice(0, Math.max(10, this.prefs.historyLimit));

        if (!recent.length) {
            list.appendChild(el('div', { class: 'bb-empty' }, 'No recent websites yet.'));
        } else {
            recent.forEach((url) => {
                list.appendChild(el('div', { class: 'bb-history-row' }, [
                    el('div', { class: 'bb-history-info' }, [
                        el('div', { class: 'bb-history-host' }, this._hostFromUrl(url) || 'Website'),
                        el('div', { class: 'bb-history-url', title: url }, url),
                    ]),
                    el('div', { class: 'bb-history-actions' }, [
                        el('button', {
                            class: 'bb-mini-btn',
                            type: 'button',
                            onclick: () => this.navigate(url),
                        }, 'Open'),
                        el('button', {
                            class: 'bb-mini-btn',
                            type: 'button',
                            onclick: () => this.addBookmarkPrompt(url),
                        }, 'Save'),
                    ]),
                ]));
            });
        }

        return el('section', { class: 'bb-section' }, [
            this._sectionHeader('Recent', `Limit ${this.prefs.historyLimit}`),
            list,
        ]);
    }

    _sectionHeader(title, meta) {
        return el('div', { class: 'bb-section-head' }, [
            el('div', { class: 'bb-section-title' }, title),
            el('div', { class: 'bb-section-meta' }, meta),
        ]);
    }

    _actionButton(label, handler) {
        return el('button', {
            class: 'bb-action-btn',
            type: 'button',
            onclick: handler,
        }, label);
    }

    cycleTheme() {
        const index = THEMES.indexOf(this.prefs.startTheme);
        const nextIndex = index >= 0 ? (index + 1) % THEMES.length : 0;
        this.prefs.startTheme = THEMES[nextIndex];
        this.savePrefs();
        this.render();
    }

    editBookmark(index) {
        const current = this.state.bookmarks[index];
        if (!current) return;

        const nextLabel = prompt('Bookmark name:', current.label);
        if (!nextLabel) return;
        const nextUrlRaw = prompt('Bookmark URL:', current.url);
        if (!nextUrlRaw) return;

        const nextUrl = this.resolveUrl(nextUrlRaw);
        if (!nextUrl) return;

        this.state.bookmarks[index] = { label: nextLabel.trim().slice(0, 28), url: nextUrl };
        this.state.bookmarks = this._normalizeBookmarks(this.state.bookmarks);
        this.saveState();
        this.render();
    }

    addBookmarkPrompt(seedUrl = '') {
        const prefilled = this.resolveUrl(seedUrl || '');
        const urlRaw = prompt('Bookmark URL:', prefilled || 'https://');
        if (!urlRaw) return;

        const url = this.resolveUrl(urlRaw);
        if (!url) return;

        const suggested = this._hostFromUrl(url) || 'Saved Site';
        const labelRaw = prompt('Bookmark Name:', suggested);
        if (!labelRaw) return;

        this.state.bookmarks.push({
            label: labelRaw.trim().slice(0, 28),
            url,
        });
        this.state.bookmarks = this._normalizeBookmarks(this.state.bookmarks);
        this.saveState();
        this.render();
    }

    removeBookmark(index) {
        const current = this.state.bookmarks[index];
        if (!current) return;
        if (!confirm(`Remove "${current.label}" bookmark?`)) return;

        this.state.bookmarks.splice(index, 1);
        this.saveState();
        this.render();
    }

    clearHistory() {
        if (!this.state.history.length) return;
        if (!confirm('Clear browsing history?')) return;
        this.state.history = [];
        this.saveState();
        this.render();
    }

    _hostFromUrl(url) {
        try {
            return new URL(url).hostname.replace(/^www\./i, '');
        } catch {
            return '';
        }
    }

    _faviconForUrl(url) {
        const host = this._hostFromUrl(url);
        if (!host) return 'assets/browser-icon.png';
        return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
    }

    resolveUrl(input) {
        const text = String(input || '').trim();
        if (!text) return '';

        const shortcuts = {
            google: 'https://www.google.com',
            youtube: 'https://www.youtube.com',
            facebook: 'https://www.facebook.com',
            twitter: 'https://x.com',
            x: 'https://x.com',
            instagram: 'https://www.instagram.com',
            reddit: 'https://www.reddit.com',
            wikipedia: 'https://www.wikipedia.org',
            gh: 'https://github.com',
            github: 'https://github.com',
            yt: 'https://www.youtube.com',
            amazon: 'https://www.amazon.com',
            netflix: 'https://www.netflix.com',
        };
        const lower = text.toLowerCase();
        if (shortcuts[lower]) return shortcuts[lower];

        if (/^https?:\/\//i.test(text)) return text;
        if (/^[a-z]+:\/\//i.test(text)) return text;
        if (text.includes('.') && !text.includes(' ')) return `https://${text}`;

        if (this.prefs.searchEngine === 'duck') return `https://duckduckgo.com/?q=${encodeURIComponent(text)}`;
        if (this.prefs.searchEngine === 'bing') return `https://www.bing.com/search?q=${encodeURIComponent(text)}`;
        return `https://www.google.com/search?q=${encodeURIComponent(text)}`;
    }

    _applyBrowserParam(url) {
        if (!this.prefs.forceWebParam) return url;
        try {
            const parsed = new URL(url);
            if (!/^https?:$/i.test(parsed.protocol)) return url;
            parsed.searchParams.set('yamanos_web', '1');
            return parsed.toString();
        } catch {
            return url;
        }
    }

    _openInNewTab(url) {
        const popup = window.open(url, '_blank', 'noopener,noreferrer');
        if (popup) return;

        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    }

    navigate(input) {
        const resolved = this.resolveUrl(input);
        if (!resolved) return;

        const url = this._applyBrowserParam(resolved);
        this.state.currentUrl = url;
        this._openInNewTab(url);
        this._rememberHistory(url);

        if (this.queryInput) this.queryInput.value = url;
    }

    _rememberHistory(url) {
        const list = this.state.history.filter((item) => item !== url);
        list.push(url);
        this.state.history = list.slice(-Math.max(10, this.prefs.historyLimit));
        this.saveState();
        this.render();
    }

    loadUrl(url) {
        this.navigate(url);
    }
}
