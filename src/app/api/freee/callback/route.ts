import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

const FREEE_CLIENT_ID = process.env.FREEE_CLIENT_ID;
const FREEE_CLIENT_SECRET = process.env.FREEE_CLIENT_SECRET;
const FREEE_REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/api/freee/callback` : "http://localhost:3000/api/freee/callback";

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.id) {
            return NextResponse.redirect("/?error=freee_unauthorized");
        }

        const searchParams = request.nextUrl.searchParams;
        const code = searchParams.get("code");

        if (!code) {
            return NextResponse.redirect("/?error=freee_no_code_provided");
        }

        if (!FREEE_CLIENT_ID || !FREEE_CLIENT_SECRET) {
            console.error("Missing freee credentials");
            return NextResponse.redirect("/?error=freee_config_missing");
        }

        // Exchange code for tokens
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
                redirect_uri: FREEE_REDIRECT_URI,
            }),
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.text();
            console.error("Freee token exchange failed:", errorData);
            return NextResponse.redirect("/?error=freee_token_exchange_failed");
        }

        const data = await tokenResponse.json();

        // Save tokens in DB
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
        return NextResponse.redirect(new URL("/?freee_linked=true", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"));

    } catch (error) {
        console.error("Freee callback error:", error);
        return NextResponse.redirect("/?error=freee_server_error");
    }
}
