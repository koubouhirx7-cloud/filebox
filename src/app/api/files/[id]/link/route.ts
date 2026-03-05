import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { google } from "googleapis";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;

        // Verify document exists and belongs to user
        const document = await prisma.document.findUnique({
            where: { id }
        });

        if (!document || document.userId !== session.user.id) {
            return NextResponse.json({ error: "Document not found or forbidden" }, { status: 404 });
        }

        const account = await prisma.account.findFirst({
            where: { userId: session.user.id, provider: "google" }
        });

        if (!account || !account.access_token) {
            return NextResponse.json({ error: "Google Drive permission not granted." }, { status: 401 });
        }

        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );

        oauth2Client.setCredentials({
            access_token: account.access_token,
            refresh_token: account.refresh_token,
            expiry_date: account.expires_at ? account.expires_at * 1000 : null,
        });

        const drive = google.drive({ version: "v3", auth: oauth2Client });

        // Fetch webViewLink
        const fileRes = await drive.files.get({
            fileId: document.driveFileId,
            fields: "webViewLink"
        });

        return NextResponse.json({ link: fileRes.data.webViewLink });

    } catch (error: any) {
        console.error("Link Fetch API Error:", error);

        // Auto-cleanup Zombie Files: 
        // If Google Drive returns a 404 (file not found or trashed), the user deleted it directly in Drive.
        // We should prune our local database to match this reality.
        if (error.code === 404 || error.status === 404) {
            try {
                await prisma.document.delete({ where: { id: (await params).id } });
                console.log(`Auto-cleaned zombie file from DB: ${(await params).id}`);
            } catch (dbErr) {
                console.error("Failed to auto-clean zombie file:", dbErr);
            }
            return NextResponse.json({ error: "ファイルはGoogle Drive上で既に削除されています。リストから整理しました。" }, { status: 404 });
        }

        return NextResponse.json({ error: error.message || "Failed to fetch file link from Drive" }, { status: 500 });
    }
}
