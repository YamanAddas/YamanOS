/**
 * YamanOS Kernel
 * The central nervous system of the OS.
 * Manages boot sequence, services, and global state.
 */

import { ProcessManager } from './core/processManager.js';
import { ClockService } from './services/clockService.js';
import { WeatherService } from './services/weatherService.js';
import { FileSystemService } from './services/fileSystemService.js';
import { VERSION, BUILD } from './version.js';

export class Kernel {
    constructor() {
        this.version = VERSION;
        this.bus = new EventTarget();
        this.services = new Map();
        this.apps = []; // Registry
        this.state = {
            isMobile: false,
            orientation: 'landscape',
            status: 'booting'
        };
        // ProcessManager must be initialized AFTER bus
        this.processManager = new ProcessManager(this);
    }

    registerApps(appList) {
        this.apps = appList;
    }

    getApps() {
        return this.apps;
    }

    async boot() {
        console.log(`[Kernel] Booting YamanOS ${this.version} (${BUILD})...`);

        try {
            // 1. Initialize Core Services
            await this.initServices();

            // 2. Detect Environment
            this.detectEnvironment();

            // 3. Mount UI
            this.mountUI();

            this.state.status = 'ready';
            this.emit('system:ready');
            console.log('[Kernel] System Ready');
        } catch (e) {
            console.error('[Kernel] Boot Failure:', e);
            this.emit('system:panic', e);
        }
    }

    async initServices() {
        // Minimal mobile-ready services
        const clock = new ClockService();
        this.registerService('clock', clock);
        this.registerService('weather', new WeatherService());

        const fs = new FileSystemService();
        fs.init();
        this.registerService('fs', fs);

        if (clock && typeof clock.start === 'function') {
            clock.start();
        }
    }

    registerService(name, instance) {
        this.services.set(name, instance);
    }

    getService(name) {
        return this.services.get(name);
    }

    detectEnvironment() {
        const ua = navigator.userAgent;
        const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
        this.state.isMobile = mobileRegex.test(ua) || window.matchMedia("(pointer: coarse)").matches;

        const updateOrientation = () => {
            const { width, height } = window.visualViewport || window;
            this.state.orientation = width > height ? 'landscape' : 'portrait';
            this.emit('display:orientation_change', this.state.orientation);
        };

        window.addEventListener('resize', updateOrientation);
        updateOrientation();
    }

    mountUI() {
        // Will delegate to specific Shells (Mobile/Desktop)
        this.emit('ui:mount');
    }

    emit(event, data) {
        const e = new CustomEvent(event, { detail: data });
        this.bus.dispatchEvent(e);
    }

    on(event, callback) {
        const handler = (e) => callback(e.detail);
        this.bus.addEventListener(event, handler);
        return () => this.bus.removeEventListener(event, handler);
    }
}

// Global Singleton
export const kernel = new Kernel();
