// Render flag SVGs to 320x240 PNGs: node render_flags.mjs <svgDir> <outDir> <ID...>
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [svgDir, outDir, ...ids] = process.argv.slice(2);
let n = 0;
for (const id of ids) {
  const key = id.toLowerCase();
  const svg = readFileSync(join(svgDir, `${key}.svg`), 'utf8');
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 320 } }).render().asPng();
  writeFileSync(join(outDir, `${key}.png`), png);
  n++;
}
console.log(`flags rendered: ${n}`);
