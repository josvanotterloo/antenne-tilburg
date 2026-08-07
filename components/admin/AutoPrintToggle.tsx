"use client";

import { useEffect, useState } from "react";

export const AUTO_PRINT_STORAGE_KEY = "antenne-tilburg:auto-print-on-receive";

// Per-browser preference, not per-account — deliberately localStorage, not a
// DB field. Read on mount rather than during render so server/client markup
// match on first paint.
export function AutoPrintToggle() {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChecked(localStorage.getItem(AUTO_PRINT_STORAGE_KEY) === "true");
  }, []);

  function toggle(next: boolean) {
    setChecked(next);
    localStorage.setItem(AUTO_PRINT_STORAGE_KEY, String(next));
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => toggle(e.target.checked)} />
      Auto-print label on receipt
    </label>
  );
}
