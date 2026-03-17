import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID || "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
            allowDangerousEmailAccountLinking: true,
            authorization: {
                params: {
                    scope: "openid email profile https://www.googleapis.com/auth/drive.file",
                    prompt: "consent",
                    access_type: "offline",
                    response_type: "code"
                }
            }
        }),
    ],
    adapter: PrismaAdapter(prisma),
    secret: process.env.NEXTAUTH_SECRET,
    session: { strategy: "jwt" },
    callbacks: {
        async jwt({ token, account }) {
            // Persist the OAuth access_token to the token right after signin
            if (account) {
                token.accessToken = account.access_token;
                
                // Update the Account in the database with the new tokens on re-login
                try {
                    await prisma.account.update({
                        where: {
                            provider_providerAccountId: {
                                provider: account.provider,
                                providerAccountId: account.providerAccountId,
                            },
                        },
                        data: {
                            access_token: account.access_token,
                            expires_at: account.expires_at,
                            ...(account.refresh_token && { refresh_token: account.refresh_token }),
                        },
                    });
                } catch (error) {
                    console.error("Failed to update account tokens:", error);
                }
            }
            return token;
        },
        async session({ session, token, user }: any) {
            // Send properties to the client, like an access_token from a provider.
            if (token) {
                session.accessToken = token.accessToken;
            }
            if (user) {
                session.user.id = user.id;
            } else if (token && token.sub) {
                session.user.id = token.sub;
            }
            return session;
        }
    }
};
