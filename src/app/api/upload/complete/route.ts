import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const data = await request.json();
        const { driveFileId, filename, mimeType, folderId } = data;

        if (!driveFileId || !filename) {
            return NextResponse.json({ error: "Missing required file metadata" }, { status: 400 });
        }

        // Save to Database
        const document = await prisma.document.create({
            data: {
                filename,
                driveFileId,
                mimeType: mimeType || "application/octet-stream",
                userId: session.user.id,
                folderId: folderId || null
            }
        });

        return NextResponse.json({ document });
    } catch (error: any) {
        console.error("Upload Complete Error:", error);
        if (error.message === "invalid_grant") {
            return NextResponse.json({ error: "Google Driveの認証期限が切れました。一度ログアウトし、再度ログインしてください。" }, { status: 401 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
