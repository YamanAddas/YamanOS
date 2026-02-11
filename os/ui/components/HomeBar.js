import { el } from '../../utils/dom.js';

export class HomeBar {
    constructor(onHome) {
        this.onHome = onHome;
        this.root = null;
    }

    render() {
        this.root = el('div', { class: 'home-bar-container' });

        // CSS (Inline for now)
        Object.assign(this.root.style, {
            position: 'fixed',
            bottom: '0',
            left: '0',
            right: '0',
            height: '24px', // Touch area
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-end',
            paddingBottom: '8px',
            zIndex: '10000',
            cursor: 'pointer',
            // mixBlendMode: 'difference' // Make it visible on white/black
        });

        const bar = el('div', { class: 'home-bar-pill' });
        Object.assign(bar.style, {
            width: '120px',
            height: '5px',
            borderRadius: '10px',
            background: '#ffffff',
            boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
            opacity: '0.8',
            transition: 'opacity 0.2s, transform 0.2s'
        });

        this.root.appendChild(bar);

        // Interactions
        this.root.onmouseenter = () => {
            bar.style.opacity = '1';
            bar.style.transform = 'scale(1.05)';
        };
        this.root.onmouseleave = () => {
            bar.style.opacity = '0.8';
            bar.style.transform = 'scale(1)';
        };

        // Click to go Home
        this.root.onclick = (e) => {
            e.stopPropagation();
            if (this.onHome) this.onHome();
        };

        // Simple Swipe Up Logic
        let startY = 0;
        this.root.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
        }, { passive: true });

        this.root.addEventListener('touchend', (e) => {
            const diff = startY - e.changedTouches[0].clientY;
            if (diff > 10) { // Slight swipe up
                if (this.onHome) this.onHome();
            }
        }, { passive: true });

        return this.root;
    }
}
