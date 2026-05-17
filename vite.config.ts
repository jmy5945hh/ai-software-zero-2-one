import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/agent": {
        target: "ws://localhost:3100",
        ws: true,
      },
    },
  },
});
