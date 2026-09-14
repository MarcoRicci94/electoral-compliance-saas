import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: { name: "unit", include: ["src/**/*.unit.test.ts"] }
      },
      {
        resolve: { alias },
        test: { name: "rules", include: ["src/**/*.rules.test.ts"] }
      },
      {
        resolve: { alias },
        // Richiedono un PostgreSQL migrato: non fanno parte del gate predefinito.
        test: { name: "integration", include: ["src/**/*.integration.test.ts"] }
      }
    ]
  }
});
