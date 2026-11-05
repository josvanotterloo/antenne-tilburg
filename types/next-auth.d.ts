import type { DefaultSession } from "next-auth";
import type { AdminLocale } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      locale: AdminLocale;
    } & DefaultSession["user"];
  }
  interface User {
    locale?: AdminLocale;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    locale?: AdminLocale;
  }
}
