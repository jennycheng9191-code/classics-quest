import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // 部署在 GitHub Pages 的子路徑 /classics-quest/ 下，資源路徑要跟著加前綴
  base: "/classics-quest/",
  plugins: [react()],
});
