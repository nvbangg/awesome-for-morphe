import path from "path";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

const cacheBustPlugin = () => ({
  name: "cache-bust",
  enforce: "post" as const,
  transformIndexHtml(html: string) {
    const cleanHtml =
      html
        .replace(/\r\n/g, "\n")
        .replace(/(\n[ \t]*){2,}\n/g, "\n\n")
        .trim() + "\n";
    return cleanHtml.replace(/(assets\/index\.(?:js|css))/g, `$1?v=${Date.now()}`);
  },
});

export default defineConfig(({ command }) => {
  return {
    plugins: [react(), tailwindcss(), cacheBustPlugin()],
    publicDir: command === "serve" ? "../docs" : false,
    base: "./",
    build: {
      outDir: "../docs",
      emptyOutDir: false,
      rollupOptions: {
        output: {
          entryFileNames: "assets/[name].js",
          chunkFileNames: "assets/[name].js",
          assetFileNames: "assets/[name].[ext]",
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
