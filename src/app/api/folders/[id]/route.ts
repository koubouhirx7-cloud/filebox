import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { google } from "googleapis";

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();
        const { folderName, category } = body;

        // Verify folder exists and belongs to user
        const existingFolder = await prisma.folder.findUnique({
            where: { id }
        });

        if (!existingFolder || existingFolder.userId !== session.user.id) {
            return NextResponse.json({ error: "Folder not found or unauthorized" }, { status: 404 });
        }

        const dataToUpdate: any = {};

        // Use PUT for complete rename (legacy support) or partial update
        if (folderName !== undefined) {
            if (folderName.trim() === "") {
                return NextResponse.json({ error: "Folder name cannot be empty" }, { status: 400 });
            }
            dataToUpdate.name = folderName.trim();

            // Also update in Google Drive if name changed
            if (dataToUpdate.name !== existingFolder.name) {
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
                        expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
                    });
                    const drive = google.drive({ version: "v3", auth: oauth2Client });
                    await drive.files.update({
                        fileId: existingFolder.driveFolderId,
                        requestBody: { name: dataToUpdate.name }
                    });
                }
            }
        }

        if (category !== undefined) {
            dataToUpdate.category = category === "" ? null : category.trim();
        }

        const updatedFolder = await prisma.folder.update({
            where: { id },
            data: dataToUpdate
        });

        return NextResponse.json({ folder: updatedFolder });

    } catch (error: any) {
        console.error("Error updating folder:", error);
        return NextResponse.json({ error: error.message || "Failed to update folder" }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;

        // Verify folder exists and belongs to user
        const existingFolder = await prisma.folder.findUnique({
            where: { id }
        });

        if (!existingFolder || existingFolder.userId !== session.user.id) {
            return NextResponse.json({ error: "Folder not found or unauthorized" }, { status: 404 });
        }

        // Move Google Drive folder to trash
        const account = await prisma.account.findFirst({
            where: { userId: session.user.id, provider: "google" }
        });

        if (account && account.access_token && existingFolder.driveFolderId) {
            try {
                const oauth2Client = new google.auth.OAuth2(
                    process.env.GOOGLE_CLIENT_ID,
                    process.env.GOOGLE_CLIENT_SECRET
                );
                oauth2Client.setCredentials({
                    access_token: account.access_token,
                    refresh_token: account.refresh_token,
                    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
                });
                const drive = google.drive({ version: "v3", auth: oauth2Client });

                await drive.files.update({
                    fileId: existingFolder.driveFolderId,
                    requestBody: { trashed: true }
                });
                console.log(`Trashed Google Drive folder: ${existingFolder.name}`);
            } catch (driveError) {
                console.error("Failed to trash Google Drive folder. Continuing with DB deletion.", driveError);
            }
        }

        // Delete from database (Cascade will delete associated Documents, Memos, Deadlines)
        await prisma.folder.delete({
            where: { id }
        });

        // Delete any local temporary files related to documents in this folder if needed? Not tracked currently.

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Error deleting folder:", error);
        return NextResponse.json({ error: error.message || "Failed to delete folder" }, { status: 500 });
    }
}
