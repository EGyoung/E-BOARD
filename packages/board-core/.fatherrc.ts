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
  extraBabelPlugins: [
    ["@babel/plugin-proposal-decorators", { legacy: true }],
    ["@babel/plugin-transform-class-properties", { loose: true }]
  ],
  prebundle: {
    deps: {}
  }
});
