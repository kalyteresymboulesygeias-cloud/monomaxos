import { NextResponse, type NextRequest } from "next/server";
import { isLegacyGone } from "./lib/legacy-gone";

export function proxy(request: NextRequest) {
  if (isLegacyGone(request.nextUrl.pathname)) {
    return new NextResponse("Η σελίδα δεν υπάρχει πια.", {
      status: 410,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "x-robots-tag": "noindex",
        "cache-control": "public, max-age=86400",
      },
    });
  }
  if ((request.method === "GET" || request.method === "HEAD") && request.nextUrl.searchParams.has("nocache")) {
    const url = request.nextUrl.clone();
    url.searchParams.delete("nocache");
    return NextResponse.redirect(url, 301);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
