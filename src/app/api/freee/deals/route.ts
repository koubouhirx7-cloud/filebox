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
        const { partnerName, issueDate, amount, description, taxRate, dealType = "expense", settlementStatus = "unsettled", accountItemId: providedAccountItemId } = data;

        if (!issueDate || !amount) {
            return NextResponse.json({ error: "Missing required fields (date, amount)" }, { status: 400 });
        }

        // 1. Get Freee token
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

        // 2. Get Company ID reliably
        const companiesRes = await fetch("https://api.freee.co.jp/api/1/companies", { headers });
        if (!companiesRes.ok) {
            const err = await companiesRes.text();
            console.error("Failed to fetch companies:", err);
            return NextResponse.json({ error: "Failed to fetch freee company info" }, { status: 500 });
        }
        const companiesData = await companiesRes.json();
        const companyId = companiesData.companies?.[0]?.id;

        if (!companyId) {
            return NextResponse.json({ error: "No company found for this freee account" }, { status: 400 });
        }

        // 3. Fetch Account Items to find a default account
        const accountItemsRes = await fetch(`https://api.freee.co.jp/api/1/account_items?company_id=${companyId}`, { headers });
        if (!accountItemsRes.ok) throw new Error("Failed to fetch account items");
        const accountItemsData = await accountItemsRes.json();

        let accountItemId = providedAccountItemId || null;
        const allItems = accountItemsData.account_items || [];

        if (!accountItemId) {
            console.log(`[Freee] Found ${allItems.length} account items for company ${companyId}`);

            // IMPORTANT: Deal endpoints cannot accept account items that are walletables (like bank accounts or cash).
            // They must be expense/income/assets etc. Filter out walletables explicitly.
            const nonWalletableItems = allItems.filter((item: any) => !item.walletable_id);

            if (dealType === "income") {
                const incomeItems = nonWalletableItems.filter((item: any) => item.account_category && item.account_category.includes("income"));
                const salesItem = incomeItems.find((i: any) => i.name.includes("売上高") || i.name.includes("売上"));
                accountItemId = salesItem ? salesItem.id : (incomeItems.length > 0 ? incomeItems[0].id : null);
            } else {
                const expenseItems = nonWalletableItems.filter((item: any) => item.account_category && (item.account_category.includes("expense") || item.account_category.includes("cost")));
                const consItem = expenseItems.find((i: any) => i.name.includes("消耗品費") || i.name.includes("外注工賃") || i.name.includes("仕入") || i.name.includes("雑費"));
                accountItemId = consItem ? consItem.id : (expenseItems.length > 0 ? expenseItems[0].id : null);
            }

            // Ultimate Fallback: Just take ANY valid non-walletable account item ID from the list so the request doesn't fail
            if (!accountItemId && nonWalletableItems.length > 0) {
                console.warn("[Freee] Could not find specific category match, falling back to first available non-walletable account item.");
                // Try to find any expense-sounding thing manually first
                const manualFallback = nonWalletableItems.find((i: any) => i.name.includes("費") || i.name.includes("料") || i.name.includes("代"));
                accountItemId = manualFallback ? manualFallback.id : nonWalletableItems[0].id;
            }
        }

        if (!accountItemId) {
            console.error("[Freee] Account Items Data returned empty array:", JSON.stringify(accountItemsData));
            return NextResponse.json({ error: "No default account item found in freee: " + JSON.stringify(accountItemsData) }, { status: 400 });
        }

        // 4. Determine tax code and format data safely
        const parsedAmount = parseInt(String(amount).replace(/[^0-9]/g, ""), 10) || 0;
        const parsedDate = String(issueDate).replace(/\//g, "-");

        let targetTaxCode = null;
        const selectedAccountItem = allItems.find((i: any) => i.id === accountItemId);
        if (selectedAccountItem && selectedAccountItem.default_tax_code) {
            targetTaxCode = selectedAccountItem.default_tax_code;
        } else {
            // Fallback to fetching taxes if somehow default_tax_code is missing
            const taxesRes = await fetch(`https://api.freee.co.jp/api/1/taxes/companies/${companyId}`, { headers });
            if (taxesRes.ok) {
                const taxesData = await taxesRes.json();
                const targetRate = parseInt(String(taxRate).replace(/[^0-9]/g, "")) || 10;
                const expenseTaxes = taxesData.taxes.filter((t: any) => dealType === "income" ? (t.name.includes("課税売上") || t.name.includes("対象外")) : (t.name.includes("課税仕入") || t.name.includes("対象外")));
                for (const t of expenseTaxes) {
                    if (targetRate === 10 && t.name.includes("10%")) targetTaxCode = t.code;
                    if (targetRate === 8 && t.name.includes("8%")) targetTaxCode = t.code;
                    if (targetRate === 0 && t.name.includes("対象外")) targetTaxCode = t.code;
                }
                if (!targetTaxCode && expenseTaxes.length > 0) targetTaxCode = expenseTaxes[0].code;
            }
        }

        // 5. Create Deal (未決済 or 決済済)
        const dealPayload: any = {
            issue_date: parsedDate,
            type: dealType,
            company_id: companyId,
            details: [
                {
                    tax_code: targetTaxCode,
                    account_item_id: accountItemId,
                    amount: parsedAmount,
                    description: `${partnerName ? partnerName + " - " : ""}${description || "自動登録"}`
                }
            ]
        };

        let isPaymentAdded = false;

        if (settlementStatus === "settled") {
            const walletsRes = await fetch(`https://api.freee.co.jp/api/1/walletables?company_id=${companyId}`, { headers });
            let paymentWalletableId = null;
            let paymentWalletableType = "bank_account";

            if (walletsRes.ok) {
                const walletsData = await walletsRes.json();
                const wallets = walletsData.walletables || [];
                const cashWallet = wallets.find((w: any) => w.type === "cash");
                const bankWallet = wallets.find((w: any) => w.type === "bank_account");

                if (cashWallet) {
                    paymentWalletableId = cashWallet.id;
                    paymentWalletableType = cashWallet.type;
                } else if (bankWallet) {
                    paymentWalletableId = bankWallet.id;
                    paymentWalletableType = bankWallet.type;
                } else if (wallets.length > 0) {
                    paymentWalletableId = wallets[0].id;
                    paymentWalletableType = wallets[0].type;
                }
            }

            if (paymentWalletableId) {
                dealPayload.payments = [
                    {
                        amount: parsedAmount,
                        date: parsedDate,
                        from_walletable_type: paymentWalletableType,
                        from_walletable_id: paymentWalletableId
                    }
                ];
                isPaymentAdded = true;
            } else {
                console.warn("No walletable found for settled payment, registering as unsettled");
            }
        }

        // Only add due_amount if NO payments are attached (i.e. unsettled)
        // Freee API will throw 400 error if both due_amount and payments are present
        if (!isPaymentAdded) {
            dealPayload.due_amount = parsedAmount;
        }

        const dealsRes = await fetch("https://api.freee.co.jp/api/1/deals", {
            method: "POST",
            headers,
            body: JSON.stringify(dealPayload)
        });

        if (!dealsRes.ok) {
            const errData = await dealsRes.json();
            console.error("Failed to create freee deal:", errData);
            return NextResponse.json({ error: "freeeへの登録に失敗しました。APIエラー。", details: errData }, { status: 500 });
        }

        const createdDeal = await dealsRes.json();

        return NextResponse.json({ success: true, deal: createdDeal });

    } catch (error: any) {
        console.error("Freee deals API Error:", error);
        return NextResponse.json({ error: error.message || "Failed to process freee deal" }, { status: 500 });
    }
}
