import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import dts from "vite-plugin-dts";
import path from "path";

function resolve(__dirname: string, arg1: string) {
  return path.resolve(__dirname, arg1);
}

export default defineConfig(({ command, mode }) => {
  const isLibrary = mode === "library";
  const isExample = mode === "example";

  // Common config
  const config = {
    plugins: [solidPlugin()],
    resolve: {
      alias: {
        "sync-store": resolve(__dirname, "src"),
      },
      conditions: ["development", "browser"],
    },
  };

  // Library build mode
  if (isLibrary) {
    return {
      ...config,
      build: {
        target: "esnext",
        polyfillDynamicImport: false,
        lib: {
          entry: resolve(__dirname, "src/index.ts"),
          name: "SyncStore",
          formats: ["es", "cjs", "umd"], // Keep multiple formats
          fileName: (format) => (format === "es" ? "index.js" : `index.${format}.js`), // Rename ES format to index.js
        },
        rollupOptions: {
          external: ["solid-js", "solid-js/store"],
          output: {
            globals: {
              "solid-js": "Solid",
              "solid-js/store": "SolidStore",
            },
            exports: "named", // Ensure named exports are preserved
          },
        },
      },
      plugins: [
        solidPlugin(),
        dts({ insertTypesEntry: true }), // Generate declaration files
      ],
    };
  }

  // Example app mode
  if (isExample) {
    return {
      ...config,
      root: "examples",
      server: {
        port: 3000,
      },
      build: {
        outDir: "../dist-example",
      },
    };
  }

  // Default to example mode if not specified
  return {
    ...config,
    root: "examples",
    server: {
      port: 3000,
    },
  };
});

