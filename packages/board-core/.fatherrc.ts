import { defineConfig } from "father";

export default defineConfig({
  esm: {
    input: "src",
    output: "dist/esm",
    platform: "browser",
    transformer: "babel",
    sourcemap: true
  },
  cjs: {
    input: "src",
    output: "dist/cjs",
    platform: "node",
    transformer: "babel",
    sourcemap: true
  },
  prebundle: {
    deps: {}
  }
});
