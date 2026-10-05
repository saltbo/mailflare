"use client";

import { getUserTimeZone } from "@/lib/time/utils";
import { clearUserTimeZonePreference } from "@/lib/time/client";
import type {
	AuthFetchOptions,
	AuthSessionChangedDetail,
} from "./client-types";

const SESSION_STORAGE_KEY = "mailflare-session-token";
export const AUTH_SESSION_CHANGED_EVENT = "mailflare:auth-session-changed";

function dispatchAuthSessionChanged(authenticated: boolean): void {
	if (typeof window === "undefined") return;
	window.dispatchEvent(
		new CustomEvent<AuthSessionChangedDetail>(AUTH_SESSION_CHANGED_EVENT, {
			detail: { authenticated },
		}),
	);
}


export function clearClientSessionToken(): void {
	localStorage.removeItem(SESSION_STORAGE_KEY);
	clearUserTimeZonePreference();
	dispatchAuthSessionChanged(false);
}

export function getAuthHeaders(headers?: HeadersInit): Headers {
	const nextHeaders = new Headers(headers);
	if (typeof window !== "undefined" && !nextHeaders.has("X-Time-Zone")) {
		nextHeaders.set("X-Time-Zone", getUserTimeZone());
	}
	return nextHeaders;
}

export async function authFetch(input: RequestInfo | URL, init: AuthFetchOptions = {}): Promise<Response> {
	const { redirectOnUnauthorized = true, headers, ...requestInit } = init;
	const response = await fetch(input, {
		...requestInit,
		headers: getAuthHeaders(headers),
	});

	if (response.status === 401 && redirectOnUnauthorized && typeof window !== "undefined") {
		clearClientSessionToken();
		window.location.assign("/login");
	}

	return response;
}
