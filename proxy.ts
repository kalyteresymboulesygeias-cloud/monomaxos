import { NextResponse, type NextRequest } from "next/server";
import { isLegacyGone } from "./lib/legacy-gone";

export function proxy(request: NextRequest) {
  if (!isLegacyGone(request.nextUrl.pathname)) return NextResponse.next();
  return new NextResponse("Η σελίδα δεν υπάρχει πια.", {
    status: 410,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "x-robots-tag": "noindex",
      "cache-control": "public, max-age=86400",
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
