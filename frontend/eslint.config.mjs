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
      // Disallow dynamic imports inside functions/blocks or inline import types to enforce no-inline-imports rule
      "no-restricted-syntax": [
        "error",
        {
          selector: ":function ImportExpression",
          message:
            "Inline dynamic imports inside functions/blocks are forbidden. Place imports at top of file unless documented for circular dependencies.",
        },
        {
          selector: "BlockStatement > ImportDeclaration",
          message:
            "Inline imports inside blocks are forbidden. Move imports to the top of the file.",
        },
        {
          selector: "TSImportType",
          message:
            "Inline import(...) types in type annotations or interface fields are forbidden. Place imports at top of file.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
