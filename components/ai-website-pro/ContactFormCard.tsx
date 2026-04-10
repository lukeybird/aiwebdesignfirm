'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { CONTACT_SECTION_THEME } from '@/lib/ai-website-pro-contact-theme';

const theme = CONTACT_SECTION_THEME;

export function ContactFormCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('relative rounded-3xl', className)}>
      <div className={theme.formBacklightBleed} aria-hidden />
      <motion.div
        className={cn(
          'absolute -inset-2 sm:-inset-3 rounded-[1.35rem] sm:rounded-[1.45rem] blur-2xl sm:blur-[44px] -z-10 pointer-events-none transition-colors duration-500',
          theme.formGlowMotion,
        )}
        animate={{ opacity: [0.55, 0.9, 0.55] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div
        className={cn(
          'absolute -inset-px rounded-3xl blur-xl sm:blur-2xl -z-10 pointer-events-none transition-colors duration-500',
          theme.formGlowStatic,
        )}
      />
      <div
        className={cn(
          'relative rounded-3xl p-8 md:p-9 overflow-hidden transition-all duration-500',
          theme.formCard,
        )}
      >
        <div
          className={cn(
            'absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl pointer-events-none transition-colors duration-500',
            theme.formBlobTL,
          )}
        />
        <div
          className={cn(
            'absolute bottom-0 left-0 w-32 h-32 rounded-full blur-2xl pointer-events-none transition-colors duration-500',
            theme.formBlobBR,
          )}
        />
        <div className="relative">{children}</div>
      </div>
    </div>
  );
}
