import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, css, js] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('styles.css', root), 'utf8'),
  readFile(new URL('app.js', root), 'utf8'),
]);

const bundled = html
  .replace(/<link[^>]+href=["']styles\.css["'][^>]*>\s*/i, `<style>\n${css}\n</style>\n`)
  .replace(/<script[^>]+src=["']app\.js["'][^>]*><\/script>/i, `<script>\n${js}\n</script>`);

await writeFile(new URL('Index.html', import.meta.url), bundled);
console.log('Index.html preparado para Google Apps Script');
