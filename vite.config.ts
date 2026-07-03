import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    strictPort: true,
    proxy: {
      "/agent": {
        target: "ws://localhost:3100",
        ws: true,
      },
      "/specs-tree": {
        target: "http://localhost:3100",
      },
      "/specs-file": {
        target: "http://localhost:3100",
      },
      "/specs-save": {
        target: "http://localhost:3100",
      },
      "/repo-tree": {
        target: "http://localhost:3100",
      },
      "/repo-file": {
        target: "http://localhost:3100",
      },
      "/repo-diff": {
        target: "http://localhost:3100",
      },
      "/project-build": {
        target: "http://localhost:3100",
      },
      "/qa-review": {
        target: "http://localhost:3100",
      },
      "/session-file": {
        target: "http://localhost:3100",
      },
    },
  },
});
