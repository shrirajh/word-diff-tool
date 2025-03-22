import stylistic from "@stylistic/eslint-plugin";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import stylisticTs from "@stylistic/eslint-plugin-ts";

const customized = stylistic.configs.customize({
    indent: 4,
    quotes: "double",
    semi: true,
    braceStyle: "stroustrup",
    commaDangle: "always-multiline",
    quoteProps: "consistent-as-needed",
});

export default [
    // Default JavaScript config
    {
        files: ["**/*.js", "**/*.cjs", "**/*.mjs"],
        ignores: ["**/dist/**", "**/build/**"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
        },
        plugins: {
            "@stylistic": stylistic,
        },
        rules: {
            ...customized.rules,
        },
    },

    // TypeScript config
    {
        files: ["**/*.ts", "**/*.tsx"],
        ignores: ["**/dist/**", "**/build/**"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            parser: tsParser,
            parserOptions: {
                project: "./tsconfig.json",
            },
        },
        plugins: {
            "@stylistic": stylistic,
            "@typescript-eslint": tsPlugin,
            "@stylistic/ts": stylisticTs,
        },
        rules: {
            // Spread customized stylistic rules
            ...customized.rules,

            // TypeScript rules
            "@typescript-eslint/no-unused-vars": "warn",
            "@typescript-eslint/no-explicit-any": "off",
            "@stylistic/ts/no-var-requires": "off",

            // Stylistic rules
            "@stylistic/object-property-newline": ["error", {
                allowAllPropertiesOnSameLine: false,
            }],
            "@stylistic/member-delimiter-style": ["error", {
                multiline: {
                    delimiter: "semi",
                    requireLast: true,
                },
                singleline: {
                    delimiter: "comma",
                    requireLast: false,
                },
                multilineDetection: "last-member",
            }],
            "@stylistic/object-curly-newline": ["error", {
                multiline: true,
                consistent: true,
            }],
        },
    },

    // Config files override
    {
        files: [".eslintrc.{js,cjs}", "eslint.config.{js,cjs}"],
        languageOptions: {
            sourceType: "script",
        },
    },

    // Config files override
    {
        files: [".eslintrc.mjs", "eslint.config.mjs"],
        languageOptions: {
            sourceType: "module",
        },
    },
];
