'use client';

import { AI_BUSINESS_USE_CASES } from '@/lib/ai-business-use-cases';
import { cn } from '@/lib/utils';

const FIRST_HALF = AI_BUSINESS_USE_CASES.slice(0, 50);
const SECOND_HALF = AI_BUSINESS_USE_CASES.slice(50, 100);

function MarqueeStrip({
  items,
  direction,
}: {
  items: readonly string[];
  direction: 'ltr' | 'rtl';
}) {
  return (
    <div className="w-full overflow-hidden">
      <div
        className={cn(
          'flex w-max',
          direction === 'ltr' ? 'ai-use-case-marquee-ltr' : 'ai-use-case-marquee-rtl',
        )}
      >
        {[0, 1].map((dup) => (
          <div
            key={dup}
            className="flex shrink-0 items-center gap-x-7 pr-14 sm:gap-x-9 sm:pr-18"
            aria-hidden={dup === 1}
          >
            {items.map((label) => (
              <span
                key={`${dup}-${label}`}
                className="whitespace-nowrap font-heading text-[10px] font-semibold uppercase tracking-[0.14em] text-white/[0.13] sm:text-[11px]"
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

/** Ambient scrolling use-case labels (LTR + RTL rows). */
export function UseCasesMarqueeBackdrop({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'pointer-events-none flex select-none flex-col gap-4 sm:gap-6',
        className,
      )}
      aria-hidden
    >
      <MarqueeStrip items={FIRST_HALF} direction="ltr" />
      <MarqueeStrip items={SECOND_HALF} direction="rtl" />
    </div>
  );
}
