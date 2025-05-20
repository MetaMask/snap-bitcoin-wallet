import type { GatsbyConfig } from 'gatsby';

const config: GatsbyConfig = {
  // This is required to make use of the React 17+ JSX transform.
  jsxRuntime: 'automatic',
  plugins: ['gatsby-plugin-svgr', 'gatsby-plugin-styled-components'],
};

export default config;
