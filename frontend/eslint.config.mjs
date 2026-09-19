import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    rules: {
      // Disallow imports within block statements to prevent inline imports (AGENTS.md / rules)
      "no-restricted-syntax": [
        "error",
        {
          selector: "BlockStatement > ImportDeclaration",
          message:
            "Inline imports inside blocks are forbidden. Move imports to the top of the file.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
