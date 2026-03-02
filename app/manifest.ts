import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Subtrack - Personal Finance & Subscriptions',
        short_name: 'Subtrack',
        description: 'Offline-first personal finance and subscription analyzer.',
        start_url: '/',
        display: 'standalone',
        background_color: '#000000',
        theme_color: '#2563eb',
        icons: [
            {
                src: '/icon.svg',
                sizes: '192x192',
                type: 'image/svg+xml',
            },
            {
                src: '/icon.svg',
                sizes: '512x512',
                type: 'image/svg+xml',
            },
        ],
    };
}
