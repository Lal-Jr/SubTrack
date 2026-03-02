'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/powersync';

export default function WelcomeModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let mounted = true;
        const checkProfile = async () => {
            try {
                // Wait briefly for DB to init
                await new Promise(r => setTimeout(r, 500));

                let profile: any = null;
                try {
                    profile = await db.getOptional('SELECT id, name FROM profiles LIMIT 1');
                } catch {
                    // Ignore error on first try if DB not fully ready
                }

                if (mounted) {
                    // Only open the modal if we successfully queried the DB and the name is empty or missing
                    if (profile && !profile.name) {
                        setIsOpen(true);
                    } else if (!profile) {
                        // If no profile exists at all (edge case, sync should create), we might also want to prompt
                        // or just wait for next sync. Let's assume auth syncs a profile row eventually.
                        // We will check again shortly
                        setTimeout(async () => {
                            if (!mounted) return;
                            try {
                                const p2: any = await db.getOptional('SELECT id, name FROM profiles LIMIT 1');
                                if (p2 && !p2.name) setIsOpen(true);
                            } catch { }
                        }, 2000);
                    }
                    setLoading(false);
                }
            } catch (err) {
                console.error("Error checking profile for welcome screen", err);
                if (mounted) setLoading(false);
            }
        };
        checkProfile();
        return () => { mounted = false; };
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setSaving(true);
        try {
            const profile = await db.getOptional('SELECT id FROM profiles LIMIT 1');
            if (profile) {
                await db.execute('UPDATE profiles SET name = ?, updated_at = ? WHERE id = ?', [name.trim(), Date.now(), (profile as any).id]);
                setIsOpen(false);
                // Force a reload to update the Salutation immediately
                window.location.reload();
            } else {
                // Create a local profile row if none exists
                const newId = crypto.randomUUID();
                await db.execute('INSERT INTO profiles (id, name, updated_at) VALUES (?, ?, ?)', [newId, name.trim(), Date.now()]);
                setIsOpen(false);
                window.location.reload();
            }
        } catch (error) {
            console.error('Failed to save name', error);
            alert('Could not save your name. Try again later.');
        } finally {
            setSaving(false);
        }
    };

    if (loading || !isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md"></div>
            <div className="relative bg-[#121214] border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-500 delay-300 fill-mode-both">
                <div className="p-8 text-center">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/20">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M14 2 2 14"></path><path d="m14 2 8 8-12 12"></path><path d="m20 10-8-8"></path><path d="m10 20-8-8"></path><path d="m22 22-8-8"></path></svg>
                    </div>
                    <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 mb-2">Welcome to SubTrack</h1>
                    <p className="text-sm text-slate-400 mb-8">Let's get started. What should we call you?</p>

                    <form onSubmit={handleSave} className="flex flex-col gap-4">
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Your Name"
                            required
                            className="input w-full text-center text-lg py-3"
                            autoFocus
                        />
                        <button
                            type="submit"
                            disabled={saving || !name.trim()}
                            className="btn w-full py-3"
                        >
                            {saving ? 'Saving...' : 'Get Started'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
