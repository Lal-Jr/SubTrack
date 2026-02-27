'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/powersync';

export default function Salutation() {
    const [greeting, setGreeting] = useState('');
    const [name, setName] = useState('');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 12) setGreeting('Good Morning');
        else if (hour < 18) setGreeting('Good Afternoon');
        else setGreeting('Good Evening');

        setMounted(true);

        const loadProfile = async () => {
            try {
                let attempts = 0;
                let result: any = null;
                while (attempts < 10) {
                    try {
                        result = await db.getOptional('SELECT name FROM profiles LIMIT 1');
                        break;
                    } catch (e: any) {
                        attempts++;
                        await new Promise(r => setTimeout(r, 300));
                    }
                }
                if (result && result.name) {
                    // Extract first name
                    setName(result.name.split(' ')[0]);
                }
            } catch (err) {
                console.error("Error loading profile for salutation", err);
            }
        };

        loadProfile();
    }, []);

    if (!mounted) return <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-slate-400 opacity-0">Welcome</h1>;

    return (
        <h1 className="text-3xl lg:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 tracking-tight">
            {greeting}{name ? `, ${name}` : ''}
        </h1>
    );
}
