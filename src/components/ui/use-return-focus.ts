"use client";

import * as React from "react";

type AutoFocusHandlers = {
  onOpenAutoFocus?: (event: Event) => void;
  onCloseAutoFocus?: (event: Event) => void;
};

/**
 * Returns focus to whatever opened an overlay. Radix restores focus only to its own `Trigger`;
 * Lexora opens most overlays from state instead (the menu button, ⌘K, a save button), and
 * without this, closing one drops keyboard focus to <body>, back at the top of the page.
 *
 * Radix fires `onOpenAutoFocus` before it moves focus in, so the opener still has focus then.
 * If the opener has since left the page, Radix's own behaviour applies.
 */
export function useReturnFocus({ onOpenAutoFocus, onCloseAutoFocus }: AutoFocusHandlers) {
  const opener = React.useRef<HTMLElement | null>(null);

  return {
    onOpenAutoFocus(event: Event) {
      const active = document.activeElement;
      opener.current = active instanceof HTMLElement && active !== document.body ? active : null;
      onOpenAutoFocus?.(event);
    },
    onCloseAutoFocus(event: Event) {
      onCloseAutoFocus?.(event);
      const target = opener.current;
      opener.current = null;
      if (event.defaultPrevented || !target?.isConnected) return;
      event.preventDefault();
      target.focus();
    },
  };
}
