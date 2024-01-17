import vercelConfig, { plugins as vercelPlugins } from '@vercel/style-guide/prettier';

export default {
  ...vercelConfig,
  plugins: [...vercelPlugins, 'prettier-plugin-tailwindcss'],
};
