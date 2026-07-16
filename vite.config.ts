import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/cloud/",
  plugins: [react()],
  preview: {
    allowedHosts: true,
  },
  server: {
    port: 5180,
    strictPort: true,
    proxy: {
      "/server/agent": {
        target: "ws://localhost:3100",
        ws: true,
      },
      "/server": {
        target: "http://localhost:3100",
      },
    },
  },
});
