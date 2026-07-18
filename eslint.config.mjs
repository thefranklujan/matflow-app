import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Never lint build output or the Capacitor/native asset copies. Besides being
  // generated, these trees are large and (on iCloud-synced checkouts) full of
  // evicted "dataless" placeholder files, which made a bare `eslint .` abort
  // with `ETIMEDOUT` before it ever reached src. Scoping ignores here keeps
  // `npm run lint` pointed at real source.
  { ignores: [".next/**", "out/**", "build/**", "www/**", "android/**", "ios/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@next/next/no-img-element": "warn",
    },
  },
];

export default eslintConfig;
