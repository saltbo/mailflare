/** Cookie-authenticated writes use the configured public origin, including behind a proxy. */
export function hasValidSessionMutationOrigin(request: Request, publicOrigin?: string): boolean {
 const expectedOrigin = new URL(publicOrigin ?? request.url).origin;
 const origin = request.headers.get("Origin");
 if (origin !== null) return origin === expectedOrigin;
 return request.headers.get("Sec-Fetch-Site") === "same-origin";
}
