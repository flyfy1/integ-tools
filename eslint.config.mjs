import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
export default [
  { ignores:["dist/**","node_modules/**","app/**","build/**","worker/**"] },
  { files:["scripts/**/*.mjs"], ...js.configs.recommended, languageOptions:{globals:globals.node}, rules:{...js.configs.recommended.rules,"no-empty":"off"} },
  ...tseslint.configs.recommended.map(c=>({...c,files:["src/**/*.{ts,tsx}"]})),
  { files:["src/**/*.{ts,tsx}"], languageOptions:{parserOptions:{ecmaVersion:"latest",sourceType:"module",ecmaFeatures:{jsx:true}},globals:{...globals.browser,...globals.node}}, plugins:{"react-hooks":reactHooks}, rules:{...reactHooks.configs.recommended.rules,"react-hooks/exhaustive-deps":"off","@typescript-eslint/no-unused-vars":"off","no-undef":"off"} }
];
