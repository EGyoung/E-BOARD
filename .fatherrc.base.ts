import { defineConfig } from "father";

export default defineConfig({
  esm: {
    input: "src",
    output: "dist/esm",
    platform: "browser",
    transformer: "babel",
    extraBabelPlugins: [["babel-plugin-import", { style: true }]]
  },
  cjs: {
    input: "src",
    output: "dist/cjs",
    platform: "node",
    transformer: "babel"
  },
  prebundle: {
    deps: {}
  }
});
