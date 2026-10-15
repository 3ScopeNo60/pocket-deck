// Noticing a newer published build, and telling the user what changed once they have it.
import notes from "../../release-notes.json";
import { freshCount, type Release } from "../core/whatsnew";

export const BUILD_ID: string = typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : "dev";
const LAST_BUILD_KEY = "pd-last-build";
const LAST_RELEASE_KEY = "pd-last-release";

export interface ReleaseNotes { title: string; releases: Release[] }
export const RELEASE_NOTES: ReleaseNotes = notes;

/** What the sheet shows: how many of the newest releases are new to this phone. */
export interface WhatsNew { fresh: number }

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
export function whatsNewOnce(): WhatsNew | null {
  if (BUILD_ID === "dev" || import.meta.env.MODE === "single") return null;
  try {
    const last = localStorage.getItem(LAST_BUILD_KEY);
    const lastRelease = localStorage.getItem(LAST_RELEASE_KEY);
    localStorage.setItem(LAST_BUILD_KEY, BUILD_ID);
    localStorage.setItem(LAST_RELEASE_KEY, RELEASE_NOTES.releases[0].id);
    return last && last !== BUILD_ID ? { fresh: freshCount(RELEASE_NOTES.releases, lastRelease) } : null;
  } catch {
    return null;
  }
}
