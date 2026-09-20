'use client';

import { useRef, type ReactNode } from 'react';

/** A horizontally swipeable row of cards with a title, snap scrolling and desktop arrow buttons. */
export default function Row({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
    const scroller = useRef<HTMLDivElement>(null);
    const scrollBy = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * scroller.current.clientWidth * 0.8, behavior: 'smooth' });

    return (
        <section aria-label={title} className="group/row">
            <div className="flex items-baseline justify-between gap-4 mb-3">
                <h2 className="font-display text-3xl leading-none">{title}</h2>
                {hint && <p className="text-xs text-ink-3">{hint}</p>}
            </div>
            <div className="relative">
                <div ref={scroller} className="no-scrollbar flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-px-5 -mx-5 px-5 py-3 -my-3">
                    {children}
                </div>
                {(['left', 'right'] as const).map((side) => (
                    <button
                        key={side}
                        type="button"
                        onClick={() => scrollBy(side === 'left' ? -1 : 1)}
                        aria-label={`Scroll ${side}`}
                        className={`hidden md:flex absolute top-0 bottom-0 ${side === 'left' ? '-left-5' : '-right-5'} w-12 items-center justify-center text-3xl text-ink opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 transition-opacity bg-gradient-to-${side === 'left' ? 'r' : 'l'} from-canvas/90 to-transparent z-20`}
                    >
                        {side === 'left' ? '‹' : '›'}
                    </button>
                ))}
            </div>
        </section>
    );
}
