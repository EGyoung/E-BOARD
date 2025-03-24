import { defineConfig } from 'father';

export default defineConfig({
  esm: {
    input: 'src',
    output: 'dist/esm',
    platform: 'browser',
    transformer: 'babel'
  },
  cjs: {
    input: 'src',
    output: 'dist/cjs',
    platform: 'node',
    transformer: 'babel'
  },
  prebundle: {
    deps: {}
  }
}); 