// Making and reading a backup file. Uses the share sheet on a phone (Save to Files / iCloud
// Drive), and a plain download where that isn't available.
import { backupFilename, exportAll, importAll } from "../core/backup";

export type BackupResult = "shared" | "downloaded" | "cancelled" | "blocked";

export async function makeBackup(): Promise<BackupResult> {
  const json = JSON.stringify(await exportAll());
  const name = backupFilename();
  const file = new File([json], name, { type: "application/json" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Pocket Deck backup" });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "cancelled";
      // fall through to a download
    }
  }
  try {
    const url = URL.createObjectURL(file);
    const a = Object.assign(document.createElement("a"), { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return "downloaded";
  } catch {
    return "blocked";
  }
}

/** Replace everything on this phone with the backup's contents. Throws a plain message if it isn't one. */
export async function restoreBackup(file: File): Promise<void> {
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error("That file isn't a Pocket Deck backup.");
  }
  await importAll(data);
}

export function ago(iso?: string, now = Date.now()): string {
  if (!iso) return "never";
  const days = Math.floor((now - Date.parse(iso)) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  return `${Math.floor(days / 7)} weeks ago`;
}
