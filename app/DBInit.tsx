"use client";

import { useEffect } from "react";
import { db } from "@/lib/powersync";

export default function DBInit() {
    useEffect(() => {
        let mounted = true;

        async function init() {
            try {
                console.log("Calling db.init()...");
                await db.init();
                if (mounted) {
                    console.log("PowerSync DB initialized successfully");
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