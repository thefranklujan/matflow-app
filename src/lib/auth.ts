import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: "admin-login",
      name: "Admin Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const decode = (b64?: string) => b64 ? Buffer.from(b64, "base64").toString("utf-8") : undefined;
        const admins = [
          { email: process.env.ADMIN_EMAIL, passwordHash: decode(process.env.ADMIN_PASSWORD_B64) },
          { email: process.env.ADMIN2_EMAIL, passwordHash: decode(process.env.ADMIN2_PASSWORD_B64) },
        ].filter((a) => a.email && a.passwordHash);
        const admin = admins.find((a) => a.email === credentials.email);
        if (!admin) return null;
        const valid = await bcrypt.compare(credentials.password, admin.passwordHash!);
        if (!valid) return null;
        return { id: "admin", email: admin.email!, name: "Admin", role: "admin" };
      },
    }),
    CredentialsProvider({
      id: "member-login",
      name: "Member Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const member = await prisma.member.findUnique({
          where: { email: credentials.email },
        });
        if (!member) return null;
        const valid = await bcrypt.compare(credentials.password, member.passwordHash);
        if (!valid) return null;
        if (!member.approved) return null;
        if (!member.active) return null;
        return {
          id: member.id,
          email: member.email,
          name: `${member.firstName} ${member.lastName}`,
          role: "member",
          memberId: member.id,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.memberId = user.role === "member" ? user.id : undefined;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role;
        session.user.memberId = token.memberId;
      }
      return session;
    },
  },
  session: { strategy: "jwt" },
  pages: { signIn: "/admin/login" },
  secret: process.env.NEXTAUTH_SECRET,
};
