"use client";

import { useToast } from "./providers/Providers";

export function CopyButton({
  value,
  label = "Copy",
  done = "Copied",
  empty = "Posts at launch",
  className = "",
}: {
  value: string;
  label?: string;
  done?: string;
  empty?: string;
  className?: string;
}) {
  const toast = useToast();
  return (
    <button
      type="button"
      className={`btn ${className}`}
      aria-disabled={!value}
      title={value ? undefined : empty}
      onClick={async () => {
        if (!value) return toast(empty);
        try {
          await navigator.clipboard.writeText(value);
          toast(done);
        } catch {
          toast("Copy failed. Select the address and copy it by hand.");
        }
      }}
    >
      {label}
    </button>
  );
}
