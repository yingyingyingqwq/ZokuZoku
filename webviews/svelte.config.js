import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

const IGNORE_WARNINGS = new Set([
  "a11y-no-static-element-interactions",
  "a11y-click-events-have-key-events",
  "a11y-missing-attribute",
  "a11y-missing-content",
]);

export default {
  preprocess: vitePreprocess(),
  onwarn: (warning, handler) => {
    if (IGNORE_WARNINGS.has(warning.code)) return;
    handler(warning);
  }
}
