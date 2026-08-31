import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Bridge for Next's legacy-format configs into ESLint 9 flat config.
const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  {
    rules: {
      // The codebase deliberately uses `any` in a few typed-boundary spots
      // (Prisma JSON casts, test fakes). Keep the rule on but allow explicit
      // escapes so refactors stay visible instead of hidden.
      "@typescript-eslint/no-explicit-any": "warn",

      // Next's App Router dynamic segments use Promise-wrapped params in 15.
      // The `await params` pattern is intentional and type-safe.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // React 19 + Next 15: we prefer function components; allow the explicit
      // React import where files rely on `React.ReactNode` types.
      "react/react-in-jsx-scope": "off",

      // Hyphenated/underscore file names (page.tsx, route.ts) are standard.
      "import/no-anonymous-default-export": "off",

      // The app's terminal/pixel design language renders `// LABEL` comment
      // text and quoted copy as visible UI. These are intentional text nodes,
      // not stray comments.
      "react/jsx-no-comment-textnodes": "off",
      "react/no-unescaped-entities": "off",

      // Prisma JSON columns are cast through `{}`/object at repo boundaries
      // (the generated types don't expose a JSON literal type). Intentional.
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
  {
    files: ["tests/**", "scripts/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];

export default eslintConfig;
