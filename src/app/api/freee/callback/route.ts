import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export async function GET(request: NextRequest) {
    const { origin } = new URL(request.url);
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.id) {
            return NextResponse.redirect(`${origin}/?error=freee_unauthorized`);
        }

        const searchParams = request.nextUrl.searchParams;
        const code = searchParams.get("code");

        if (!code) {
            return NextResponse.redirect(`${origin}/?error=freee_no_code_provided`);
        }

        const FREEE_CLIENT_ID = process.env.FREEE_CLIENT_ID;
        const FREEE_CLIENT_SECRET = process.env.FREEE_CLIENT_SECRET;

        if (!FREEE_CLIENT_ID || !FREEE_CLIENT_SECRET) {
            console.error("Missing freee credentials");
            return NextResponse.redirect(`${origin}/?error=freee_config_missing`);
        }

        const redirectUri = `${origin}/api/freee/callback`;

        // Exchange code for tokens
        console.log(`[freee/callback] Exchanging code for token with redirect_uri: ${redirectUri}`);
        const tokenResponse = await fetch("https://accounts.secure.freee.co.jp/public_api/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                client_id: FREEE_CLIENT_ID,
                client_secret: FREEE_CLIENT_SECRET,
                code: code,
                redirect_uri: redirectUri,
            }),
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.text();
            console.error("Freee token exchange failed:", errorData);
            return NextResponse.redirect(`${origin}/?error=freee_token_exchange_failed`);
        }

        const data = await tokenResponse.json();

        // Save tokens in DB
        console.log(`[freee/callback] Saving tokens for user: ${session.user.id}`);
        await prisma.freeeAccount.upsert({
            where: { userId: session.user.id },
            update: {
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
            },
            create: {
                userId: session.user.id,
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
            },
        });

        // Redirect back to dashboard indicating success
        return NextResponse.redirect(`${origin}/?freee_linked=true`);

    } catch (error) {
        console.error("Freee callback error:", error);
        return NextResponse.redirect(`${origin}/?error=freee_server_error`);
    }
}
