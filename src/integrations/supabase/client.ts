// Local auth stub — replaces Supabase while there is no backend.
// Persists a fake user/session in localStorage so login/register/settings
// continue to work end-to-end in the UI without a database.

type User = { id: string; email: string; user_metadata: Record<string, unknown> };
type Session = { access_token: string; user: User };
type AuthError = { message: string };
type Listener = (event: string, session: Session | null) => void;

const STORAGE_USERS = "stub.users";
const STORAGE_SESSION = "stub.session";

const isBrowser = typeof window !== "undefined" && typeof localStorage !== "undefined";

const read = <T,>(key: string, fallback: T): T => {
  if (!isBrowser) return fallback;
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, value: unknown) => {
  if (!isBrowser) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
};

const listeners = new Set<Listener>();
const emit = (event: string, session: Session | null) => {
  listeners.forEach(l => {
    try {
      l(event, session);
    } catch {
      /* ignore */
    }
  });
};

const makeSession = (user: User): Session => ({
  access_token: `stub.${user.id}.${Date.now()}`,
  user,
});

const getCurrentSession = (): Session | null => read<Session | null>(STORAGE_SESSION, null);

type StoredUser = { id: string; email: string; password: string; user_metadata: Record<string, unknown> };
const getUsers = (): StoredUser[] => read<StoredUser[]>(STORAGE_USERS, []);
const saveUsers = (users: StoredUser[]) => write(STORAGE_USERS, users);

const stripUser = (u: StoredUser): User => ({
  id: u.id,
  email: u.email,
  user_metadata: u.user_metadata ?? {},
});

const auth = {
  async getSession() {
    return { data: { session: getCurrentSession() }, error: null as AuthError | null };
  },
  async getUser() {
    const s = getCurrentSession();
    return { data: { user: s?.user ?? null }, error: null as AuthError | null };
  },
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    const users = getUsers();
    const found = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!found || found.password !== password) {
      return { data: { session: null, user: null }, error: { message: "Invalid login credentials" } as AuthError };
    }
    const session = makeSession(stripUser(found));
    write(STORAGE_SESSION, session);
    emit("SIGNED_IN", session);
    return { data: { session, user: session.user }, error: null as AuthError | null };
  },
  async signUp({ email, password, options }: { email: string; password: string; options?: { data?: Record<string, unknown>; emailRedirectTo?: string } }) {
    const users = getUsers();
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      return { data: { session: null, user: null }, error: { message: "User already registered" } as AuthError };
    }
    const newUser: StoredUser = {
      id: crypto.randomUUID(),
      email,
      password,
      user_metadata: options?.data ?? {},
    };
    users.push(newUser);
    saveUsers(users);
    const session = makeSession(stripUser(newUser));
    write(STORAGE_SESSION, session);
    emit("SIGNED_IN", session);
    return { data: { session, user: session.user }, error: null as AuthError | null };
  },
  async signOut() {
    if (isBrowser) localStorage.removeItem(STORAGE_SESSION);
    emit("SIGNED_OUT", null);
    return { error: null as AuthError | null };
  },
  async updateUser(patch: { password?: string; data?: Record<string, unknown> }) {
    const session = getCurrentSession();
    if (!session) return { data: { user: null }, error: { message: "Not authenticated" } as AuthError };
    const users = getUsers();
    const idx = users.findIndex(u => u.id === session.user.id);
    if (idx < 0) return { data: { user: null }, error: { message: "User not found" } as AuthError };
    if (patch.password) users[idx].password = patch.password;
    if (patch.data) users[idx].user_metadata = { ...users[idx].user_metadata, ...patch.data };
    saveUsers(users);
    const updated = stripUser(users[idx]);
    const newSession = { ...session, user: updated };
    write(STORAGE_SESSION, newSession);
    emit("USER_UPDATED", newSession);
    return { data: { user: updated }, error: null as AuthError | null };
  },
  onAuthStateChange(cb: Listener) {
    listeners.add(cb);
    return {
      data: {
        subscription: {
          unsubscribe: () => listeners.delete(cb),
        },
      },
    };
  },
};

// Chainable no-op query builder so `supabase.from(...).select()...` doesn't crash.
const emptyResult = { data: null, error: null as AuthError | null };
const builder: any = new Proxy(
  {},
  {
    get(_t, prop) {
      if (prop === "then") {
        return (resolve: (v: typeof emptyResult) => unknown) => resolve(emptyResult);
      }
      if (prop === "maybeSingle" || prop === "single") {
        return async () => emptyResult;
      }
      return () => builder;
    },
  },
);

export const supabase = {
  auth,
  from(_table: string) {
    return builder;
  },
};
