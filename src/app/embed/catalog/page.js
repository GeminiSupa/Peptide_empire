"use client";

import CatalogPage from "@/app/catalog/page";
import { useEffect } from "react";

export default function EmbedCatalog() {
  useEffect(() => {
    // Inject CSS to hide header, sticky sections, and footer
    // This allows the catalog to be embedded seamlessly into another site (like WordPress)
    const style = document.createElement('style');
    style.innerHTML = `
      .main-header { display: none !important; }
      .header-sticky-section { top: 0 !important; }
      .footer { display: none !important; }
      .customer-transformation-banner { display: none !important; }
      body { background: transparent !important; }
      .app-wrapper { padding-top: 0 !important; }
    `;
    document.head.appendChild(style);
    
    // Auto-resize message sender to parent window.
    //
    // The reported height is capped to about one screen. Growing the frame to
    // the full catalog (26,000px and more) made every pop-up unreachable: a
    // dialog is positioned against the frame's viewport, which IS the whole
    // frame, so an order form centred in a 26,000px frame was drawn 13,000px
    // away from whatever the visitor was looking at and simply never appeared.
    // A frame roughly one screen tall scrolls its own content and puts dialogs
    // back where the visitor is.
    const maxHeight = () => Math.max(600, Math.round((window.screen?.availHeight || 900) * 0.85));

    let lastSent = 0;
    const sendHeight = (contentHeight) => {
      const height = Math.min(contentHeight + 50, maxHeight());
      // Re-posting the same number on every observer tick wakes the parent up
      // for nothing; the cap means it settles almost immediately.
      if (Math.abs(height - lastSent) < 1) return;
      lastSent = height;
      if (window.parent) window.parent.postMessage({ type: 'resize', height }, '*');
    };

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) sendHeight(entry.contentRect.height);
    });

    resizeObserver.observe(document.body);
    sendHeight(document.body.getBoundingClientRect().height);

    return () => {
      document.head.removeChild(style);
      resizeObserver.disconnect();
    };
  }, []);

  // Render the exact same catalog component, just with the CSS overrides active
  return <CatalogPage />;
}
