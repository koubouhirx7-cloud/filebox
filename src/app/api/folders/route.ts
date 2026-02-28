import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { google } from "googleapis";

// GET: Retrieve user's folders
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const folders = await prisma.folder.findMany({
            where: {
                userId: session.user.id,
            },
            orderBy: {
                createdAt: "desc",
            },
            include: {
                _count: {
                    select: { documents: true }
                }
            }
        });

        return NextResponse.json({ folders });
    } catch (error: any) {
        console.error("Error fetching folders:", error);
        return NextResponse.json({ error: "Failed to fetch folders" }, { status: 500 });
    }
}

// POST: Create a new folder
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.id) {
            return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
        }

        const account = await prisma.account.findFirst({
            where: { userId: session.user.id, provider: "google" }
        });

        if (!account || !account.access_token) {
            return NextResponse.json({ error: "Google Drive permission not granted." }, { status: 401 });
        }

        const body = await request.json();
        const { folderName } = body;

        if (!folderName || folderName.trim() === "") {
            return NextResponse.json({ error: "Folder name is required" }, { status: 400 });
        }

        // 1. Create Folder in Google Drive (Inside "File Box" root)
        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials({ access_token: account.access_token });
        const drive = google.drive({ version: "v3", auth: oauth2Client });

        // Find root "File Box" folder first
        const rootFolderName = "File Box";
        let rootFolderId = "";

        const folderQuery = await drive.files.list({
            q: `mimeType='application/vnd.google-apps.folder' and name='${rootFolderName}' and trashed=false`,
            fields: "files(id, name)",
            spaces: "drive",
        });

        if (folderQuery.data.files && folderQuery.data.files.length > 0) {
            rootFolderId = folderQuery.data.files[0].id!;
        } else {
            // Create root folder if it doesn't exist yet
            const folderResponse = await drive.files.create({
                requestBody: {
                    name: rootFolderName,
                    mimeType: "application/vnd.google-apps.folder",
                },
                fields: "id",
            });
            rootFolderId = folderResponse.data.id!;
        }

        // Create the new sub-folder in Drive
        const newFolderResponse = await drive.files.create({
            requestBody: {
                name: folderName.trim(),
                mimeType: "application/vnd.google-apps.folder",
                parents: [rootFolderId], // Put inside File Box
            },
            fields: "id",
        });

        const newDriveFolderId = newFolderResponse.data.id;
        if (!newDriveFolderId) {
            throw new Error("Failed to get new Google Drive folder ID.");
        }

        // 2. Save to local DB via Prisma
        const folder = await prisma.folder.create({
            data: {
                name: folderName.trim(),
                userId: session.user.id,
                driveFolderId: newDriveFolderId,
            }
        });

        return NextResponse.json({ folder });
    } catch (error: any) {
        console.error("Error creating folder:", error);
        return NextResponse.json({ error: error.message || "Failed to create folder" }, { status: 500 });
    }
}
