"use client";

import { BUY_URL } from "@/lib/config";
import { useToast } from "./providers/Providers";

export function BuyButton({ className = "" }: { className?: string }) {
  const toast = useToast();
  if (BUY_URL) {
    return (
      <a className={`btn ${className}`} href={BUY_URL} target="_blank" rel="noopener noreferrer">
        Buy $AMC
      </a>
    );
  }
  return (
    <button type="button" className={`btn ${className}`} aria-disabled="true" title="The buy link posts at launch" onClick={() => toast("The buy link posts at launch")}>
      Buy $AMC
    </button>
  );
}
