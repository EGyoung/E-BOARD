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
        sourcemap: true,
        transformer: "babel"
    },
    umd: {
        output: "dist/umd",
        name: "FpsPlugin",
        platform: "browser",
        sourcemap: true
    },
    prebundle: {
        deps: {}
    }
});
