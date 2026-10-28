import next from "eslint-config-next";

const config = [
  { ignores: [".next/**", "node_modules/**", "lib/generated/**", "design-reference/**", "next-env.d.ts"] },
  ...next,
  {
    rules: {
      // Girls ship as pre-sized webp variants (-sm, -md, full) with fixed dimensions, so plain <img> is deliberate.
      "@next/next/no-img-element": "off",
    },
  },
];

export default config;
