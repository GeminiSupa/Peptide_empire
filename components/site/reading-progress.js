'use client';

import { useEffect, useRef } from 'react';

/**
 * The article's reading bar, and the sticky shop button that shows between
 * 15% and 97% of the way through, as in the prototype's `postAfter`.
 */
export default function ReadingProgress() {
  const bar = useRef(null);
  useEffect(() => {
    const onScroll = () => {
      const article = document.querySelector('.article');
      const sticky = document.getElementById('stickyCta');
      if (!article || !bar.current) return;
      const rect = article.getBoundingClientRect();
      const share = Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height - window.innerHeight)));
      bar.current.style.width = `${share * 100}%`;
      sticky?.classList.toggle('show', share > 0.15 && share < 0.97);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return <div className="readbar"><i ref={bar} /></div>;
}
