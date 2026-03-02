"use client";

import { useEffect } from "react";

export default function SerwistPWAInit() {
    useEffect(() => {
        if ("serviceWorker" in navigator && (window as any).serwist !== undefined) {
            // @serwist/next auto registers in pages router, but might need manual invocation or next config
            // The Next config plugin *should* inject it unless it's strictly in development.
            // We will manually register it to guarantee it works.
            navigator.serviceWorker.register("/sw.js").then((reg) => {
                console.log("Serwist Service Worker Registered", reg);
            }).catch(() => {
                // Silently ignore in dev if sw doesn't exist
            });
        } else if ("serviceWorker" in navigator) {
            navigator.serviceWorker.register("/sw.js").then((reg) => {
                // Service worker loaded (could be dev dummy or actual production sw)
            }).catch(() => {
                // Ignore register errors if the browser doesn't support or file is completely missing
            });
        }
    }, []);

    return null;
}
