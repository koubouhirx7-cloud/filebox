import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { google } from "googleapis";

export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = params;
        const body = await request.json();
        const { folderName, memo, paymentDeadline } = body;

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
                    const oauth2Client = new google.auth.OAuth2();
                    oauth2Client.setCredentials({ access_token: account.access_token });
                    const drive = google.drive({ version: "v3", auth: oauth2Client });
                    await drive.files.update({
                        fileId: existingFolder.driveFolderId,
                        requestBody: { name: dataToUpdate.name }
                    });
                }
            }
        }

        if (memo !== undefined) dataToUpdate.memo = memo;
        if (paymentDeadline !== undefined) dataToUpdate.paymentDeadline = paymentDeadline ? new Date(paymentDeadline) : null;

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
