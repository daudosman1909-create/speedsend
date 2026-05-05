import convexPlugin from "@convex-dev/eslint-plugin";
import tseslint from "typescript-eslint";

export default [
    { ignores: ["node_modules/", "convex/_generated/"] },
    ...tseslint.configs.recommended,
    ...convexPlugin.configs.recommended,
    {
        files: ["metro.config.js"],
        rules: {
            "@typescript-eslint/no-require-imports": "off",
        },
    },
];
