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
            }).catch((err) => {
                console.error("Serwist Service Worker Registration Failed", err);
            });
        } else if ("serviceWorker" in navigator) {
            navigator.serviceWorker.register("/sw.js").then((reg) => {
                console.log("Service Worker Registered Manually", reg);
            }).catch((err) => {
                console.error("Service Worker Registration Failed Manually", err);
            });
        }
    }, []);

    return null;
}
