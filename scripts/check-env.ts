#!/usr/bin/env tsx
// Run: npx tsx scripts/check-env.ts
// Validates all required environment variables before deployment.

const REQUIRED_VARS: Array<{ key: string; description: string; isPublic: boolean }> = [
  { key: "NEXT_PUBLIC_SUPABASE_URL", description: "Supabase project URL", isPublic: true },
  { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", description: "Supabase anonymous key", isPublic: true },
];

const PLACEHOLDER_VALUES = [
  "placeholder",
  "your-project-id",
  "your-anon-key",
  "https://placeholder.supabase.co",
];

let hasErrors = false;

console.log("\n🔍 ResaleIQ — Environment Variable Check\n");

for (const { key, description, isPublic } of REQUIRED_VARS) {
  const value = process.env[key];

  if (!value) {
    console.error(`  ✗ MISSING  ${key}`);
    console.error(`             ${description}`);
    if (isPublic) {
      console.error(`             Add to .env.local: ${key}=<value>`);
    }
    hasErrors = true;
    continue;
  }

  if (PLACEHOLDER_VALUES.some((p) => value.toLowerCase().includes(p.toLowerCase()))) {
    console.error(`  ✗ PLACEHOLDER  ${key} = "${value.slice(0, 30)}..."`);
    console.error(`                 Replace with your actual ${description}`);
    hasErrors = true;
    continue;
  }

  if (key === "NEXT_PUBLIC_SUPABASE_URL" && !value.startsWith("https://")) {
    console.error(`  ✗ INVALID  ${key} must start with https://`);
    hasErrors = true;
    continue;
  }

  console.log(`  ✓ OK  ${key}`);
}

console.log();

if (hasErrors) {
  console.error("  ❌ Environment check FAILED — fix the above before deploying.\n");
  process.exit(1);
} else {
  console.log("  ✅ All environment variables configured.\n");
  process.exit(0);
}
