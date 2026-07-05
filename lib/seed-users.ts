// Resolve the two admin seed accounts from the environment. Passwords are never
// hardcoded: seeding fails loudly unless strong passwords are provided, so a weak
// placeholder can't ship by accident. See docs/instructions/admin-credentials.md.

export interface SeedUser {
  email: string;
  password: string;
}

const MIN_PASSWORD = 8;

const ADMINS = [
  {
    role: "shop owner",
    emailVar: "SEED_ADMIN_SHOP_EMAIL",
    emailDefault: "shop@antenne-tilburg.nl",
    passwordVar: "SEED_ADMIN_SHOP_PASSWORD",
  },
  {
    role: "website builder",
    emailVar: "SEED_ADMIN_DEV_EMAIL",
    emailDefault: "dev@antenne-tilburg.nl",
    passwordVar: "SEED_ADMIN_DEV_PASSWORD",
  },
] as const;

export function resolveAdminSeedUsers(
  env: Record<string, string | undefined>,
): SeedUser[] {
  const errors: string[] = [];
  const users: SeedUser[] = [];

  for (const admin of ADMINS) {
    const email = env[admin.emailVar]?.trim() || admin.emailDefault;
    const password = env[admin.passwordVar]?.trim() ?? "";

    if (!password) {
      errors.push(`${admin.passwordVar} is required (${admin.role})`);
    } else if (password.length < MIN_PASSWORD) {
      errors.push(
        `${admin.passwordVar} must be at least ${MIN_PASSWORD} characters (${admin.role})`,
      );
    }

    users.push({ email, password });
  }

  if (errors.length > 0) {
    throw new Error(
      "Cannot seed admin users — set strong admin passwords in your environment:\n  - " +
        errors.join("\n  - "),
    );
  }

  return users;
}
