import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const freeeAccount = await prisma.freeeAccount.findUnique({
            where: { userId: session.user.id }
        });

        if (!freeeAccount || !freeeAccount.accessToken) {
            return NextResponse.json({ error: "Freee account not linked" }, { status: 400 });
        }

        const headers = {
            "Authorization": `Bearer ${freeeAccount.accessToken}`,
            "Content-Type": "application/json"
        };

        const companiesRes = await fetch("https://api.freee.co.jp/api/1/companies", { headers });
        if (!companiesRes.ok) {
            const errText = await companiesRes.text();
            console.error("Freee companies fetch error:", companiesRes.status, errText);
            if (companiesRes.status === 401) {
                return NextResponse.json({ error: "freeeの連携有効期限が切れました。画面右上の「freee連携済み」ボタンから一度解除し、再度連携を行ってください。" }, { status: 401 });
            }
            return NextResponse.json({ error: "Failed to fetch company", details: errText }, { status: 500 });
        }

        const companiesData = await companiesRes.json();
        const companyId = companiesData.companies?.[0]?.id;

        if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

        let allPartners: any[] = [];
        let offset = 0;
        const limit = 3000;

        try {
            console.log(`Fetching from Freee API: limit=${limit}, offset=${offset}`);
            const partnersRes = await fetch(`https://api.freee.co.jp/api/1/partners?company_id=${companyId}&limit=${limit}&offset=${offset}`, { headers });

            if (!partnersRes.ok) {
                const errText = await partnersRes.text();
                console.error("Freee API Error:", partnersRes.status, errText);
                return NextResponse.json({ error: "Failed to fetch partners", details: errText }, { status: 500 });
            }

            const data = await partnersRes.json();
            allPartners = data.partners || [];

        } catch (fetchErr: any) {
            console.error("Fetch Exception:", fetchErr);
            return NextResponse.json({ error: "Fetch exception", details: fetchErr.message }, { status: 500 });
        }

        return NextResponse.json({ partners: allPartners });

    } catch (error: any) {
        console.error("Unhandled error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
