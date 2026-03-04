import { getServerSession } from "next-auth/next";
import { authOptions } from "./lib/auth";
import { prisma } from "./lib/prisma";
import LoginButton from "./components/LoginButton";
import LogoutButton from "./components/LogoutButton";
import DisconnectFreeeButton from "./components/DisconnectFreeeButton";
import Dashboard from "./components/Dashboard";

export default async function Home() {
    const session = await getServerSession(authOptions);

    let hasFreeeLinked = false;
    if (session?.user?.id) {
        const freeeAccount = await prisma.freeeAccount.findUnique({
            where: { userId: session.user.id }
        });
        hasFreeeLinked = !!freeeAccount;
    }

    return (
        <main className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="w-full max-w-[95rem] flex justify-between items-center bg-white p-4 rounded-xl shadow-sm mb-8 flex-wrap gap-4">
                <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                    <a href="/" className="hover:opacity-80 transition-opacity cursor-pointer">File Box (ファイルボックス)</a>
                </h1>
                <div>
                    {session ? (
                        <div className="flex items-center flex-wrap gap-3">
                            <span className="text-sm text-gray-600 hidden md:inline mr-2">
                                ログイン中: <span className="font-semibold">{session.user?.name}</span>
                            </span>
                            {hasFreeeLinked ? (
                                <div className="flex items-center">
                                    <div className="text-xs font-bold text-white bg-blue-500 px-3 py-1.5 rounded-full shadow-sm flex items-center">
                                        <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        freee連携済み
                                    </div>
                                    <DisconnectFreeeButton />
                                </div>
                            ) : (
                                <a href="/api/freee/auth" className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-full shadow-sm transition-colors flex items-center">
                                    freee連携する
                                </a>
                            )}
                            <LogoutButton />
                        </div>
                    ) : (
                        <div className="text-sm text-gray-500">ログインしていません</div>
                    )}
                </div>
            </div>

            <div className="w-full max-w-[95rem] text-center flex flex-col items-center">
                {!session ? (
                    <div className="bg-white p-10 rounded-2xl shadow-xl w-full max-w-md mt-10 space-y-6">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">File Box へようこそ</h2>
                        <p className="text-gray-500 text-sm">
                            ドキュメント解析AIを利用するには、Googleアカウントでログインしてください。
                        </p>
                        <div className="pt-4">
                            <LoginButton />
                        </div>
                    </div>
                ) : (
                    <div className="w-full text-left">
                        <div className="mb-6 bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg shadow-sm">
                            <p className="text-sm text-blue-700">
                                こんにちは <span className="font-semibold">{session.user?.name}</span> さん！安全にファイルをアップロードしてGeminiで解析できます。
                            </p>
                        </div>
                        <Dashboard />
                    </div>
                )}
            </div>
        </main>
    );
}
