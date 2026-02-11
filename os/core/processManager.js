
/**
 * YamanOS v0.6 Process Manager
 * Handles application lifecycle, isolation, and resource cleanup.
 */

export class ProcessManager {
    constructor(kernel) {
        this.kernel = kernel;
        this.processes = new Map(); // pid -> process
        this.registry = new Map(); // appId -> AppClass
        this.nextPid = 1000;

        // Listen for launch requests from UI
        this.kernel.on('app:open', (appId) => this.spawn(appId));
        this.kernel.on('process:kill', (pid) => this.kill(pid));
    }

    register(appId, appClass) {
        this.registry.set(appId, appClass);
    }

    async spawn(appId, config = {}) {
        console.log(`[ProcessManager] Request to spawn: ${appId}`);

        // A. Internal App (OS Process) - PRIORITY
        // If the app is registered internally, we ALWAYS prefer it over external links.
        // This fixes issues where "Settings" or "Files" tried to open iOS schemes.
        const AppClass = this.registry.get(appId);

        if (AppClass) {
            const pid = this.nextPid++;
            console.log(`[ProcessManager] Spawning Internal ${appId} (PID: ${pid})`);

            const process = {
                pid,
                name: appId,
                instance: null,
                state: 'starting',
                startTime: Date.now()
            };

            try {
                // Instantiate App
                process.instance = new AppClass(this.kernel, pid);
                this.processes.set(pid, process);

                // Lifecycle: Init
                await process.instance.init(config || {});

                process.state = 'running';

                // Announce to Shells (Payload includes the app instance for mounting)
                this.kernel.emit('process:started', { pid, appId, app: process.instance });

                return pid;

            } catch (e) {
                console.error(`[ProcessManager] Failed to spawn ${appId}:`, e?.message || e);
                this.kernel.emit('system:app-error', { appId, message: e?.message || String(e) });
                this.processes.delete(pid);
                return -1;
            }
        }

        // B. External / Native / Shortcut Handlers
        const allApps = this.kernel.getApps();
        const appMeta = allApps.find(a => a.id === appId);

        if (appMeta) {
            // 1. Native Scheme with Web Fallback (The "Shortcut" Behavior)
            if (appMeta.scheme && appMeta.url) {
                console.log(`[ProcessManager] Launching Shortcut: ${appMeta.name}`);

                // 1. Try Native App
                const start = Date.now();
                window.location.href = appMeta.scheme;

                // 2. Fallback to Web (if detection fails or valid timeout)
                setTimeout(() => {
                    const elapsed = Date.now() - start;
                    const c = confirm(`Open ${appMeta.name} in Browser? (Cancel if App opened)`);
                    if (c) window.open(appMeta.url, '_blank');
                }, 1500);

                return;
            }

            // 2. Pure Native Scheme
            if (appMeta.scheme) {
                console.log(`[ProcessManager] Native Link: ${appMeta.scheme}`);
                window.location.href = appMeta.scheme;
                return;
            }

            // 3. Pure Web URL
            if (appMeta.url) {
                console.log(`[ProcessManager] Web Link: ${appMeta.url}`);
                window.open(appMeta.url, '_blank');
                return;
            }
        }

        console.warn(`[ProcessManager] App Implementation not found: ${appId}`);
        return;
    }

    kill(pid) {
        const process = this.processes.get(pid);
        if (!process) return false;

        console.log(`[ProcessManager] Killing process ${pid} (${process.name})`);

        // 1. Lifecycle: Dipose
        if (process.instance && process.instance.destroy) {
            try {
                process.instance.destroy();
            } catch (e) {
                console.warn(`[ProcessManager] Error disposing ${pid}: `, e);
            }
        }

        // 2. Remove
        this.processes.delete(pid);
        this.kernel.emit('process:stopped', { pid });
        return true;
    }
}
