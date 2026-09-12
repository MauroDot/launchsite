import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { isBootstrapAdmin } from "@/lib/admin-bootstrap";
import { configureAuthUrl } from "@/lib/app-url";

// Auth.js otherwise derives OAuth callback URLs from the incoming request host.
// Pin its server-side origin to the same canonical URL used by Stripe so a
// transient Vercel deployment hostname can never reach Google OAuth.
configureAuthUrl();

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [Google({ authorization: { params: { prompt: "select_account" } } })],
  session: { strategy: "database" },
  pages: { signIn: "/login" },
  callbacks: {
    async signIn({ user }) {
      if (isBootstrapAdmin(user.email) && user.id) {
        await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
      }
      return true;
    },
  },
});
