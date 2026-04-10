'use client';

import { useEffect, useState } from 'react';
import { AI_MARKETING_MARQUEE_LABELS } from '@/lib/ai-marketing-use-cases';
import { cn } from '@/lib/utils';

const ROW_COUNT = 16;
/** At least two full passes of all labels so long titles still tile smoothly */
const MIN_LABELS_PER_STRIP = Math.max(22, AI_MARKETING_MARQUEE_LABELS.length * 2);

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Repeat/cycle row labels so the horizontal loop has enough width */
function expandForMarquee(items: string[], minLen: number): string[] {
  if (items.length === 0) return [];
  const out: string[] = [];
  while (out.length < minLen) {
    for (const x of items) {
      out.push(x);
      if (out.length >= minLen) break;
    }
  }
  return out;
}

function MarqueeStrip({
  items,
  direction,
  durationSec,
}: {
  items: readonly string[];
  direction: 'ltr' | 'rtl';
  durationSec: number;
}) {
  return (
    <div className="w-full min-w-0 overflow-hidden">
      <div
        className={cn(
          'flex w-max',
          direction === 'ltr' ? 'ai-use-case-marquee-ltr' : 'ai-use-case-marquee-rtl',
        )}
        style={{ animationDuration: `${durationSec}s` }}
      >
        {[0, 1].map((dup) => (
          <div
            key={dup}
            className="flex shrink-0 items-center gap-x-8 pr-14 sm:gap-x-10 sm:pr-20 md:gap-x-12 md:pr-24"
            aria-hidden={dup === 1}
          >
            {items.map((label, idx) => (
              <span
                key={`${dup}-${idx}-${label}`}
                className="whitespace-nowrap font-heading text-base font-semibold uppercase tracking-[0.1em] text-white/[0.2] sm:text-lg md:text-xl"
              >
                {label}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

type RowConfig = {
  items: string[];
  dir: 'ltr' | 'rtl';
  durationSec: number;
};

/** Full-height ambient marquees: each row shuffles all 20 titles independently, then cycles that order; random direction & speed (client-only). */
export function UseCasesMarqueeBackdrop({ className }: { className?: string }) {
  const [rows, setRows] = useState<RowConfig[] | null>(null);

  useEffect(() => {
    const built: RowConfig[] = Array.from({ length: ROW_COUNT }, () => {
      const rowOrder = shuffleInPlace([...AI_MARKETING_MARQUEE_LABELS]);
      const expanded = expandForMarquee(rowOrder, MIN_LABELS_PER_STRIP);
      return {
        items: expanded,
        dir: Math.random() < 0.5 ? 'ltr' : 'rtl',
        // Longer duration = slower scroll (was ~140–360s; now ~320–820s per loop)
        durationSec: 320 + Math.random() * 500,
      };
    });

    setRows(built);
  }, []);

  if (!rows) {
    return <div className={cn('h-full min-h-[20dvh]', className)} aria-hidden />;
  }

  return (
    <div
      className={cn(
        'flex h-full min-h-0 w-full flex-col-reverse justify-between gap-y-0.5 py-1 sm:gap-y-1 sm:py-2',
        className,
      )}
      aria-hidden
    >
      {rows.map((row, i) => (
        <div key={i} className="flex min-h-0 flex-1 items-center">
          <MarqueeStrip items={row.items} direction={row.dir} durationSec={row.durationSec} />
        </div>
      ))}
    </div>
  );
}
