/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BUILD_ID: string;
  readonly VITE_TEST_HANDLE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
