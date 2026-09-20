'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/db';

export interface LiveQuery<T> {
    data: T[];
    /** True until the first result arrives. */
    loading: boolean;
    error: Error | null;
}

/** Subscribes to a SQL query and re-renders whenever the underlying tables change. */
export function useLiveQuery<T>(sql: string, params: unknown[] = []): LiveQuery<T> {
    const [state, setState] = useState<LiveQuery<T>>({ data: [], loading: true, error: null });
    const key = JSON.stringify(params);

    useEffect(() => {
        const abort = new AbortController();
        db.waitForReady()
            .then(() => {
                if (abort.signal.aborted) return;
                db.watchWithCallback(
                    sql,
                    JSON.parse(key),
                    {
                        onResult: (result) => setState({ data: (result.rows?._array ?? []) as T[], loading: false, error: null }),
                        onError: (error) => setState((s) => ({ ...s, loading: false, error })),
                    },
                    { signal: abort.signal },
                );
            })
            .catch((error) => setState((s) => ({ ...s, loading: false, error })));
        return () => abort.abort();
    }, [sql, key]);

    return state;
}
