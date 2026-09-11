import { useEffect, useRef, useState } from 'react';

/**
 * Returns a ref + whether the element has scrolled into view (once true, stays
 * true). Used to defer heavy data fetching until a panel is actually visible —
 * this keeps the initial page load to a handful of requests instead of ~100.
 */
export function useInView<T extends HTMLElement>(rootMargin = '300px') {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (inView) return;
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      const t = setTimeout(() => setInView(true), 0);
      return () => clearTimeout(t);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView, rootMargin]);

  return { ref, inView };
}
