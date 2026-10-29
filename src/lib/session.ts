const KEY = "pharmagenie.desk";

export function isAuthed(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  return sessionStorage.getItem(KEY) === "XYZ123";
}

export function signIn(username: string, password: string): boolean {
  const ok = username.trim() === "XYZ123" && password === "0000";
  if (ok) sessionStorage.setItem(KEY, "XYZ123");
  return ok;
}

export function signOut(): void {
  sessionStorage.removeItem(KEY);
}
