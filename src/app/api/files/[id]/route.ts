import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { google } from "googleapis";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const document = await prisma.document.findUnique({
            where: { id }
        });

        if (!document) {
            return NextResponse.json({ error: "Document not found" }, { status: 404 });
        }

        // Ensure user owns document
        if (document.userId !== session.user.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const account = await prisma.account.findFirst({
            where: { userId: session.user.id, provider: "google" }
        });

        if (account && account.access_token) {
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
            try {
                // Delete from Google Drive
                await drive.files.delete({ fileId: document.driveFileId });
            } catch (driveError: any) {
                console.error("Failed to delete from Drive. It might already be deleted or permission denied.", driveError);
            }
        }

        // Delete from Database
        await prisma.document.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("File deletion error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
