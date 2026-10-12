import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';

createInertiaApp({
    title: (title) => (title ? `${title} · Northline` : 'Client Portal Management System'),
    resolve: (name) => {
        const pages = import.meta.glob('./Pages/**/*.tsx', { eager: true });
        const page = pages[`./Pages/${name}.tsx`];
        if (!page) {
            throw new Error(`Missing page ${name}`);
        }
        return page as never;
    },
    setup({ el, App, props }) {
        if (!el) {
            return;
        }
        createRoot(el).render(<App {...props} />);
    },
    progress: { color: '#c4622d', showSpinner: true },
});
