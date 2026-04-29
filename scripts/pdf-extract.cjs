"use strict";
// Runs in a subprocess so OOM here never kills the Next.js process.
const pdfParse = require("pdf-parse");
const fs = require("fs");

const inputPath = process.argv[2];
if (!inputPath) {
  process.stderr.write("Usage: pdf-extract.cjs <path>\n");
  process.exit(1);
}

const buffer = fs.readFileSync(inputPath);
pdfParse(buffer)
  .then((data) => {
    process.stdout.write(data.text ?? "");
  })
  .catch((err) => {
    process.stderr.write(String(err?.message ?? err) + "\n");
    process.exit(1);
  });
