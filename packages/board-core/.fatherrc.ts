import { defineConfig } from "father";

export default defineConfig({
  esm: {
    input: "src",
    output: "dist/esm",
    platform: "browser",
    transformer: "swc",
    sourcemap: true
  },
  cjs: {
    input: "src",
    output: "dist/cjs",
    platform: "node",
    transformer: "swc",
    sourcemap: true
  },
  prebundle: {
    deps: {}
  }
});
