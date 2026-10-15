import { ChevronLeft } from "lucide-react";

/**
 * A back control you can hit with a thumb: a 44px disc in the menu's glass style plus the label,
 * and the whole row is the target (48px tall). `where` is spoken for screen readers.
 */
export function BackButton({ label, where, onClick }: { label: string; where?: string; onClick: () => void }) {
  return (
    <button className="back-btn" onClick={onClick} aria-label={where ? `Back to ${where}` : "Back"}>
      <span className="back-disc" aria-hidden="true"><ChevronLeft size={22} strokeWidth={2.25} /></span>
      <span className="back-label">{label}</span>
    </button>
  );
}
