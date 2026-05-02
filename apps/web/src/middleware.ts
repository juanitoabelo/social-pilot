import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const publicPaths = ["/login", "/register", "/api/auth", "/api/register"];

async function verifySession(request: NextRequest) {
  const possibleNames = [
    "authjs.session-token",
    "__Secure-authjs.session-token",
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
  ];

  for (const name of possibleNames) {
    const cookie = request.cookies.get(name);
    if (!cookie?.value) continue;

    console.log(`[Middleware] Found cookie: ${name} (first 20 chars: ${cookie.value.substring(0, 20)}...)`);

    try {
      const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
      const { payload } = await jwtVerify(cookie.value, secret);
      console.log(`[Middleware] Session verified for user: ${payload.sub}`);
      return payload;
    } catch (err) {
      console.log(`[Middleware] Failed to verify cookie ${name}:`, err);
      continue;
    }
  }
  
  console.log("[Middleware] No valid session cookie found");
  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const payload = await verifySession(request);

  if (!payload) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
