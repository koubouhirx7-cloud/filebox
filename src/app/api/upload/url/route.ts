import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/lib/auth";
import { google } from "googleapis";
import { prisma } from "@/app/lib/prisma";

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const account = await prisma.account.findFirst({
            where: { userId: session.user.id, provider: "google" },
            include: { user: true }
        });

        if (!account || !account.access_token) {
            return NextResponse.json({ error: "Google Drive permission not granted" }, { status: 401 });
        }

        const data = await request.json();
        const { filename, mimeType, folderId } = data;

        if (!filename) {
            return NextResponse.json({ error: "Filename is required" }, { status: 400 });
        }

        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );
        oauth2Client.setCredentials({
            access_token: account.access_token,
            refresh_token: account.refresh_token,
            expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
        });

        // 1. Determine Target Folder ID (Cache or Query)
        let targetDriveFolderId = "";
        if (folderId) {
            const dbFolder = await prisma.folder.findUnique({ where: { id: folderId } });
            if (dbFolder) targetDriveFolderId = dbFolder.driveFolderId;
        }

        if (!targetDriveFolderId) {
            const drive = google.drive({ version: "v3", auth: oauth2Client });
            targetDriveFolderId = account.user.rootDriveFolderId || "";
            if (!targetDriveFolderId) {
                const folderName = "ファイルボックス";
                const folderQuery = await drive.files.list({
                    q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`,
                    fields: "files(id, name)",
                    spaces: "drive",
                });
                if (folderQuery.data.files && folderQuery.data.files.length > 0) {
                    targetDriveFolderId = folderQuery.data.files[0].id!;
                } else {
                    const newFolder = await drive.files.create({
                        requestBody: { name: folderName, mimeType: "application/vnd.google-apps.folder" },
                        fields: "id",
                    });
                    targetDriveFolderId = newFolder.data.id!;
                }
                await prisma.user.update({
                    where: { id: session.user.id },
                    data: { rootDriveFolderId: targetDriveFolderId }
                });
            }
        }

        // 2. Request Resumable Upload Session URL from Google Drive API
        const uploadMetadata = {
            name: filename,
            parents: [targetDriveFolderId],
        };

        const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${account.access_token}`,
                "Content-Type": "application/json",
                ...(mimeType && { "X-Upload-Content-Type": mimeType })
            },
            body: JSON.stringify(uploadMetadata)
        });

        if (!response.ok) {
            const err = await response.text();
            console.error("Failed to start resumable upload:", err);
            return NextResponse.json({ error: "Failed to initialize upload session" }, { status: 500 });
        }

        const resumableUrl = response.headers.get("Location");
        if (!resumableUrl) {
            return NextResponse.json({ error: "Missing resumable location URL from Google" }, { status: 500 });
        }

        return NextResponse.json({
            uploadUrl: resumableUrl
        });

    } catch (error: any) {
        console.error("Upload URL Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
