'use client';

import { useEffect, useRef } from 'react';

export default function CheckoutRedirect({ plan, interrupted, failed }: {
  plan: 'diy' | 'expert'; interrupted: boolean; failed: boolean;
}) {
  const form = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);
  useEffect(() => {
    if (!interrupted && !submitted.current) {
      submitted.current = true;
      form.current?.requestSubmit();
    }
  }, [interrupted]);
  return (
    <form ref={form} method="post" action="/api/billing" className="mt-6">
      <input type="hidden" name="action" value={plan} />
      <p className="mb-4 text-sm text-[#9AAAC0]">{failed ? 'We could not open checkout. Please try again.' : interrupted ? 'Your trial has not started. Continue when you’re ready.' : 'Your account is ready. Opening secure Stripe checkout…'}</p>
      <button className="brand-button brand-button-primary w-full">Continue to card details</button>
    </form>
  );
}
