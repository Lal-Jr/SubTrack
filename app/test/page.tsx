"use client";

import { useEffect } from "react";
import { db } from "@/lib/powersync";
import { v4 as uuid } from "uuid";

export default function Test() {
    useEffect(() => {
        async function run() {
            try {
                console.log("Starting DB test script...");
                const now = new Date();
                const next = new Date(Date.now() + 30 * 86400000);

                console.log("Executing insert...");
                await db.execute(
                    `INSERT INTO subscriptions
            (id, name, amount, currency, interval_days, last_charge_date, next_charge_date, source, confidence, active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        uuid(),
                        "Netflix",
                        649,
                        "INR",
                        30,
                        now.toISOString(),
                        next.toISOString(),
                        "manual",
                        1,
                        1,
                        Date.now(),
                        Date.now(),
                    ]
                );
                console.log("Insert successful. Fetching all rows...");

                const rows = await db.getAll(`SELECT * FROM subscriptions`);
                console.log("Fetched rows:", rows);
            } catch (err) {
                console.error("Error running DB test:", err);
            }
        }

        run();
    }, []);

    return <div>Check console for subscriptions</div>;
}