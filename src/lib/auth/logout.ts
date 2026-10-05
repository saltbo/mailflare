import { authFetch, clearClientSessionToken } from "./client";
export async function logoutClientSession(): Promise<boolean> {
 const response = await authFetch("/api/auth/logout", { method: "POST", redirectOnUnauthorized: false });
 if (!response.ok) throw new Error("Could not sign out. Please try again.");
 clearClientSessionToken();
 return false;
}
