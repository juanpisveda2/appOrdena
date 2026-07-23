import { builtinModules } from 'node:module';
import { defineConfig, mergeConfig, type UserConfig } from 'vite';
import packageJson from './package.json';

const packageDependencies = Object.keys(packageJson.dependencies ?? {});
const nodeBuiltins = [...builtinModules, ...builtinModules.map((moduleName) => `node:${moduleName}`)];

export function createNodeBuildConfig(overrides: UserConfig = {}): UserConfig {
  return mergeConfig(
    defineConfig({
      build: {
        emptyOutDir: false,
        sourcemap: true,
        rollupOptions: {
          external: [...new Set([...packageDependencies, ...nodeBuiltins])]
        }
      }
    }),
    overrides
  );
}
