import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/*
 * Modüler monolit kuralları (bkz. ARCHITECTURE.md):
 * - Bir modülün internal/ klasörünü yalnızca o modül import edebilir.
 * - Veritabanına (@/shared/db) yalnızca modüllerin içi erişir; app/ ve shared/ erişemez.
 * - Modüller arası bağımlılık tek yönlüdür; izin verilmeyen yöne import yasaktır.
 */
const MODULES = {
  identity: [],
  enrollment: ["identity"],
  "question-bank": ["identity"],
  exams: ["identity", "enrollment", "question-bank"],
  homework: ["identity", "enrollment"],
  schedule: ["identity", "enrollment"],
  "online-test": ["identity"],
  planning: ["identity", "enrollment", "exams", "homework", "schedule"],
  reporting: ["identity", "enrollment", "exams", "homework", "schedule", "planning"],
};
const DB_IN_APP = "error";

const internalOf = (m) => ({
  group: [`@/modules/${m}/internal`, `@/modules/${m}/internal/*`],
  message: `${m} modülünün internal/ klasörü dışarıya kapalı; @/modules/${m} veya @/modules/${m}/server kullanın.`,
});
const moduleImport = (m) => ({
  group: [`@/modules/${m}`, `@/modules/${m}/*`],
  message: `Bu modülün ${m} modülüne bağımlılığı tanımlı değil (eslint.config.mjs > MODULES).`,
});
const dbImport = {
  group: ["@/shared/db"],
  message: "Veritabanına yalnızca modüller erişir; ilgili modülün server.ts fonksiyonunu kullanın.",
};

const boundaryRules = [
  {
    files: ["src/app/**", "src/shared/**", "src/middleware.ts"],
    ignores: ["src/shared/db.ts"],
    rules: {
      "no-restricted-imports": [DB_IN_APP, { patterns: [dbImport, ...Object.keys(MODULES).map(internalOf)] }],
    },
  },
  ...Object.entries(MODULES).map(([m, deps]) => {
    const others = Object.keys(MODULES).filter((x) => x !== m);
    return {
      files: [`src/modules/${m}/**`],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              ...others.map(internalOf),
              ...others.filter((x) => !deps.includes(x)).map(moduleImport),
            ],
          },
        ],
      },
    };
  }),
];

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  ...boundaryRules,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
