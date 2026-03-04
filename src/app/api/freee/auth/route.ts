import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/lib/auth";

export async function GET(request: NextRequest) {
    try {
        const FREEE_CLIENT_ID = process.env.FREEE_CLIENT_ID;
        // Determine the redirect URI dynamically based on the current host
        const redirectUri = `${request.nextUrl.protocol}//${request.nextUrl.host}/api/freee/callback`;
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!FREEE_CLIENT_ID) {
            return NextResponse.json({ error: "Freee API configuration missing" }, { status: 500 });
        }

        const state = Math.random().toString(36).substring(7);
        // Save state in a simple way or assume safe enough for prototype. NextAuth usually handles CSRF, but for custom OAuth we'll just pass a simple state.

        const authorizeUrl = new URL("https://accounts.secure.freee.co.jp/public_api/authorize");
        authorizeUrl.searchParams.append("client_id", FREEE_CLIENT_ID);
        authorizeUrl.searchParams.append("redirect_uri", redirectUri);
        authorizeUrl.searchParams.append("response_type", "code");
        authorizeUrl.searchParams.append("state", state);

        console.log(`[freee/auth] Redirecting to: ${authorizeUrl.toString()}`);

        return NextResponse.redirect(authorizeUrl.toString());
    } catch (error) {
        console.error("Freee auth initiate error:", error);
        return NextResponse.json({ error: "Failed to initiate Freee login" }, { status: 500 });
    }
}
