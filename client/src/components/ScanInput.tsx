import { useEffect, useRef, useState } from "react";

interface ScanInputProps {
  onScan: (code: string, source: "scanner" | "manual") => void;
  disabled?: boolean;
}

// Hardware barcode scanners act as a keyboard and "type" the barcode
// followed by Enter almost instantly. We track the interval between
// keystrokes: a burst where every key lands under FAST_KEY_THRESHOLD_MS
// apart is treated as a scanner read; anything slower is normal typing.
// Either way the same value is submitted on Enter, so this only affects
// the "source" label shown to the user.
const FAST_KEY_THRESHOLD_MS = 40;

export function ScanInput({ onScan, disabled }: ScanInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const lastKeyTime = useRef<number>(0);
  const looksLikeScanner = useRef<boolean>(true);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const now = performance.now();
    if (e.key !== "Enter") {
      const delta = now - lastKeyTime.current;
      if (lastKeyTime.current > 0 && delta > FAST_KEY_THRESHOLD_MS) {
        looksLikeScanner.current = false;
      }
      lastKeyTime.current = now;
      return;
    }

    e.preventDefault();
    const code = value.trim();
    if (!code) return;
    onScan(code, looksLikeScanner.current ? "scanner" : "manual");
    setValue("");
    lastKeyTime.current = 0;
    looksLikeScanner.current = true;
  }

  function handleManualSubmit() {
    const code = value.trim();
    if (!code) return;
    onScan(code, "manual");
    setValue("");
  }

  return (
    <div className="scan-input">
      <input
        ref={inputRef}
        type="text"
        value={value}
        placeholder="Scan or type a barcode, then press Enter"
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={(e) => {
          // Only steal focus back if it isn't going to another interactive
          // element (dropdown, button, other input) — otherwise this would
          // yank focus away from whatever the user just clicked.
          if (e.relatedTarget === null) {
            setTimeout(() => inputRef.current?.focus(), 100);
          }
        }}
        autoComplete="off"
      />
      <button type="button" onClick={handleManualSubmit} disabled={disabled || !value.trim()}>
        Lookup
      </button>
    </div>
  );
}
