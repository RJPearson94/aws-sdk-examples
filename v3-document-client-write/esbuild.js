const { build } = require("esbuild");
const { pnpPlugin } = require("@yarnpkg/esbuild-plugin-pnp");
const { ZipFile } = require("yazl");
const fs = require("fs");

const outputPath = "dist";

build({
  entryPoints: ["./src/index.ts"],
  tsconfig: "./tsconfig.json",
  plugins: [pnpPlugin()],
  bundle: true,
  minify: true,
  outfile: `${outputPath}/main.js`,
  platform: "node",
  target: "node14",
  logLevel: "error",
})
  .then(() => {
    const zipfile = new ZipFile();
    zipfile.addFile(`${outputPath}/main.js`, "main.js");
    zipfile.outputStream
      .pipe(fs.createWriteStream(`${outputPath}/lambda.zip`))
      .on("close", () => {
        console.log("Lambda artefact zipped successfully");
      });
    zipfile.end();
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
