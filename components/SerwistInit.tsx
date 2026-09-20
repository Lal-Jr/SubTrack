"use client";

import { useEffect } from "react";

/** Registers the service worker so the app works offline. Registration failures (e.g. dev) are ignored. */
export default function SerwistPWAInit() {
    useEffect(() => {
        if ("serviceWorker" in navigator) {
            navigator.serviceWorker.register("/sw.js").catch(() => {});
        }
    }, []);

    return null;
}
