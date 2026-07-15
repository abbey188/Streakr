/**
 * A tiny in-memory cache that survives client-side navigation (module-level, not
 * React state), so returning to a page can show last-good data INSTANTLY and
 * refresh in the background — killing the empty→pop-in "hard refresh" flash on
 * Play / Squads / Inbox. Cleared on a full page reload, which is fine: the first
 * fetch after load fills it again.
 *
 * Usage:
 *   const [rows, setRows] = useState(() => getCached<Row[]>("key") ?? []);
 *   useEffect(() => { fetchRows().then((r) => { setRows(r); setCached("key", r); }); }, []);
 */
const store = new Map<string, unknown>();

export function getCached<T>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}

export function setCached<T>(key: string, val: T): void {
  store.set(key, val);
}
