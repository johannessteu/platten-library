import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// Relative base so the build works both on platten.steu.de and on
// johannessteu.github.io/platten-library/ before the custom domain is set up.
export default defineConfig({
  base: './',
  plugins: [preact()],
});
