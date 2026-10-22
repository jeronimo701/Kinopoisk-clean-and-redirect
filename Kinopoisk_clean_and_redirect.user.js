// ==UserScript==
// @name         Кинопоиск: очистка UTM и переход к плееру
// @namespace    https://teletype.in/@fbdostup/
// @version      1.2.1
// @description  Удаляет UTM, добавляет кнопку перехода и скрывает блок .topAdPad на целевой странице фильма.
// @match        https://kinopoisk.ru/*
// @match        https://www.kinopoisk.ru/*
// @match        *://*/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @author       Jeronimo701
// @license      LicenseRef-Jeronimo701-Personal-Use-1.0
// @updateURL    none
// @homepageURL  https://github.com/jeronimo701/Kinopoisk-clean-and-redirect
// ==/UserScript==

(function () {
    'use strict';

    const SETTINGS_KEY = 'kinopoisk_clean_redirect_settings';
    const HANDOFF_KEY = 'kinopoisk_clean_redirect_handoff_until';
    const DEFAULT_SETTINGS = {
        cleanUtm: true,
        targetHost: 'kinokino.win',
    };

    if (isKinopoiskHost(location.hostname)) {
        GM_registerMenuCommand('Настройки Кинопоиска', openSettings);
        runKinopoisk();
    } else {
        hideFilmPageAdBlock();
    }

    function isKinopoiskHost(hostname) {
        return hostname === 'kinopoisk.ru' || hostname.endsWith('.kinopoisk.ru');
    }

    function getSettings() {
        return { ...DEFAULT_SETTINGS, ...(GM_getValue(SETTINGS_KEY, {}) || {}) };
    }

    function normalizeHostname(value) {
        return String(value || '')
            .trim()
            .replace(/^https?:\/\//i, '')
            .replace(/[/?#].*$/, '')
            .toLowerCase();
    }

    function cleanUtmParameters(url) {
        let changed = false;
        for (const key of [...url.searchParams.keys()]) {
            if (/^utm_/i.test(key)) {
                url.searchParams.delete(key);
                changed = true;
            }
        }
        return changed;
    }

    function runKinopoisk() {
        const settings = getSettings();
        const url = new URL(location.href);
        const hadUtm = settings.cleanUtm && cleanUtmParameters(url);

        if (hadUtm) {
            history.replaceState(history.state, '', url.href);
        }
        addWatchButton();
    }

    function addWatchButton() {
        const add = () => {
            if (!document.body || document.getElementById('kp-watch-online')) return;
            const button = document.createElement('button');
            button.id = 'kp-watch-online';
            button.type = 'button';
            button.textContent = '▶ Смотреть онлайн';
            button.title = 'Открыть эту страницу на сайте из настроек';
            Object.assign(button.style, {
                position: 'fixed', top: '14px', right: '14px', zIndex: '2147483646',
                padding: '10px 14px', border: '1px solid rgba(255,255,255,.24)',
                borderRadius: '8px', background: '#e50914', color: '#fff',
                font: '600 14px/1.2 system-ui, sans-serif', cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(0,0,0,.25)',
            });
            button.addEventListener('click', () => {
                const targetHost = normalizeHostname(getSettings().targetHost);
                if (!targetHost) return;
                const target = new URL(location.href);
                target.hostname = targetHost;
                cleanUtmParameters(target);
                GM_setValue(HANDOFF_KEY, Date.now() + 5 * 60 * 1000);
                location.assign(target.href);
            });
            document.body.appendChild(button);
        };
        if (document.body) add();
        else new MutationObserver((_, observer) => {
            if (document.body) {
                observer.disconnect();
                add();
            }
        }).observe(document.documentElement, { childList: true });
    }

    function hideFilmPageAdBlock() {
        if (!/^\/(?:film|series)\/\d+(?:\/|$)/i.test(location.pathname)) return;
        const expiresAt = Number(GM_getValue(HANDOFF_KEY, 0));
        if (!expiresAt || expiresAt < Date.now()) {
            if (expiresAt) GM_deleteValue(HANDOFF_KEY);
            return;
        }
        GM_deleteValue(HANDOFF_KEY);

        const hide = () => {
            document.querySelectorAll('.topAdPad').forEach((element) => {
                element.style.setProperty('display', 'none', 'important');
            });
        };
        const install = () => {
            const root = document.documentElement;
            if (!root) return false;
            if (!document.getElementById('kp-hide-top-ad-pad')) {
                const style = document.createElement('style');
                style.id = 'kp-hide-top-ad-pad';
                style.textContent = '.topAdPad{display:none!important;visibility:hidden!important}';
                root.appendChild(style);
            }
            hide();
            return true;
        };
        if (install()) {
            new MutationObserver(hide).observe(document.documentElement, { childList: true, subtree: true });
        } else {
            const observer = new MutationObserver(() => {
                if (install()) {
                    observer.disconnect();
                    new MutationObserver(hide).observe(document.documentElement, { childList: true, subtree: true });
                }
            });
            observer.observe(document, { childList: true, subtree: true });
        }
    }

    function openSettings() {
        const settings = getSettings();
        const overlay = document.createElement('div');
        Object.assign(overlay.style, {
            position: 'fixed', zIndex: '2147483647', inset: '0', display: 'grid',
            placeItems: 'center', background: 'rgba(0,0,0,.55)', padding: '16px',
        });
        const box = document.createElement('div');
        Object.assign(box.style, {
            width: 'min(440px, 100%)', padding: '18px', borderRadius: '8px',
            background: '#fff', color: '#202124', font: '14px/1.45 system-ui, sans-serif',
            boxShadow: '0 12px 40px rgba(0,0,0,.3)',
        });
        box.innerHTML = `
            <h2 style="font-size:18px;margin:0 0 14px">Настройки Кинопоиска</h2>
            <label style="display:block;margin:10px 0"><input data-field="clean" type="checkbox"> Удалять параметры utm_* из адреса</label>
            <label style="display:block;margin:12px 0 4px">Домен назначения</label>
            <input data-field="host" type="text" placeholder="kinokino.win" style="box-sizing:border-box;width:100%;padding:8px;border:1px solid #9aa0a6;border-radius:4px">
            <p style="font-size:12px;color:#5f6368">Это сторонний сайт, не принадлежащий Кинопоиску. Скрипт переносит путь и параметры страницы на указанный домен.</p>
            <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
                <button data-action="close" type="button">Закрыть</button>
                <button data-action="save" type="button">Сохранить</button>
            </div>`;
        box.querySelector('[data-field="clean"]').checked = settings.cleanUtm;
        box.querySelector('[data-field="host"]').value = settings.targetHost;
        box.querySelector('[data-action="save"]').addEventListener('click', () => {
            const host = normalizeHostname(box.querySelector('[data-field="host"]').value);
            if (!host) {
                box.querySelector('[data-field="host"]').focus();
                return;
            }
            GM_setValue(SETTINGS_KEY, {
                cleanUtm: box.querySelector('[data-field="clean"]').checked,
                targetHost: host,
            });
            overlay.remove();
        });
        box.querySelector('[data-action="close"]').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('mousedown', (event) => {
            if (event.target === overlay) overlay.remove();
        });
        overlay.appendChild(box);
        (document.body || document.documentElement).appendChild(overlay);
    }
})();
