await Bun.build({
  entrypoints: ['./src/extension.ts'],
  outdir: './dist',
  target: 'node',
  format: 'esm',
  splitting: false,
  external: ['vscode'], // ← no incluimos la API VSCode
})
