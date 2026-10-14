// Noticing a newer published build, and telling the user what changed once they have it.
import notes from "../../release-notes.json";

export const BUILD_ID: string = typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : "dev";
const LAST_BUILD_KEY = "pd-last-build";

export interface ReleaseNotes { title: string; notes: string[] }
export const RELEASE_NOTES: ReleaseNotes = notes;

/** Ask the server which build is newest. Null if it's the one running, or we can't tell (offline, dev, preview). */
export async function newerBuild(fetchFn: typeof fetch = fetch, base = import.meta.env.BASE_URL): Promise<{ id: string } | null> {
  if (BUILD_ID === "dev" || import.meta.env.MODE === "single") return null;
  try {
    const res = await fetchFn(`${base}version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const v = (await res.json()) as { id?: string };
    return v.id && v.id !== BUILD_ID ? { id: v.id } : null;
  } catch {
    return null;
  }
}

/** The release notes to show once, the first time this build opens after an update. */
export function whatsNewOnce(): ReleaseNotes | null {
  if (BUILD_ID === "dev" || import.meta.env.MODE === "single") return null;
  try {
    const last = localStorage.getItem(LAST_BUILD_KEY);
    localStorage.setItem(LAST_BUILD_KEY, BUILD_ID);
    return last && last !== BUILD_ID ? RELEASE_NOTES : null;
  } catch {
    return null;
  }
}
