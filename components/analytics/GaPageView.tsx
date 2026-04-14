"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/** Sends page_view on client-side navigations (initial load is handled by gtag in root layout). */
export function GaPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const skipFirst = useRef(true);

  const searchKey = searchParams?.toString() ?? "";

  useEffect(() => {
    const gtag = window.gtag;
    if (typeof gtag !== "function") return;

    const pagePath = searchKey ? `${pathname}?${searchKey}` : pathname;

    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }

    const pageLocation = `${window.location.origin}${pagePath.startsWith("/") ? pagePath : `/${pagePath}`}`;

    gtag("event", "page_view", {
      page_location: pageLocation,
      page_path: pagePath,
    });
  }, [pathname, searchKey]);

  return null;
}
