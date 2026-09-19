import fsd from "@feature-sliced/steiger-plugin";

const steigerConfig = [
  ...fsd.configs.recommended,
  {
    rules: {
      // Allow Next.js App Router naming convention (_app, _pages) to avoid collision with app/
      "fsd/typo-in-layer-name": "off",
      // Foundation setup contains initial slices with fewer references than full product
      "fsd/insignificant-slice": "off",
    },
  },
];

export default steigerConfig;
