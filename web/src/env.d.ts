/// <reference types="vite/client" />

interface ImportMetaEnv extends Readonly<Record<string, string>> {
  readonly VITE_BASE_API: string
  readonly VITE_SPARK_KEY: string
  readonly VITE_SANIC_PROXY_TARGET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare const __AIX_PAGE_AGENT_BUILD_FLAG__: string

interface Window {
  __AIX_RUNTIME_CONFIG__?: {
    VITE_ENABLE_PAGE_AGENT?: string
  }
}

declare module '~icons/*' {
  import { FunctionalComponent, SVGAttributes } from 'vue'
  const component: FunctionalComponent<SVGAttributes>
  export default component
}
