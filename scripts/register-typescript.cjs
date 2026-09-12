/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS hooks load TypeScript tests. */
// Test-only loader using the existing TypeScript compiler; no runtime dependency.
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  return originalResolve.call(this, request.startsWith("@/") ? path.join(__dirname, "../src", request.slice(2)) : request, ...args);
};
for (const extension of [".ts", ".tsx"]) {
  require.extensions[extension] = (module, filename) => {
    const result = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    });
    module._compile(result.outputText, filename);
  };
}
