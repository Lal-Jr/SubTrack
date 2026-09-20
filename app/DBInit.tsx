"use client";

import { useEffect } from "react";
import { db } from "@/lib/db";
import { runMigrations } from "@/lib/db/migrations";
import { settingsStore } from "@/lib/db/settings";

export default function DBInit() {
    useEffect(() => {
        let mounted = true;

        async function init() {
            try {
                console.log("Calling db.init()...");
                await db.init();
                await runMigrations(settingsStore);

                if (mounted) {
                    console.log("Local database ready (local-only).");
                }
            } catch (err) {
                console.error("DB init failed:", err);
            }
        }

        init();

        return () => {
            mounted = false;
        };
    }, []);

    return null;
}