import { createRemoteJWKSet, jwtVerify } from "jose";

// Firebase ID tokens are signed by Google's securetoken service. Verifying them
// with the public keys avoids shipping a service-account secret to the server.
const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function verifyFirebaseToken(authHeader: string | undefined, projectId: string): Promise<string> {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) throw new HttpError(401, "unauthenticated", "Sign in to use AI features.");
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ["RS256"],
    });
    if (!payload.sub) throw new Error("missing sub");
    return payload.sub;
  } catch {
    throw new HttpError(401, "session_expired", "Your session expired. Sign in again, then retry.");
  }
}
