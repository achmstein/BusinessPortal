import { defineConfig } from '@hey-api/openapi-ts'

// Generates a typed TS client, types, and TanStack Query options from the API's
// OpenAPI document. Pages consume the generated *Options() helpers rather than
// calling the SDK directly, so caching, loading and error state come for free
// and page-level DTOs never need hand-declaring.
//
// Refresh the spec with `npm run sync:api` while the API is running, then
// `npm run gen:api`. Never hand-edit openapi.json — it is generated output.
export default defineConfig({
  input: './openapi.json',
  output: 'src/api/generated',
  plugins: [
    '@hey-api/client-fetch',
    '@hey-api/sdk',
    '@hey-api/typescript',
    '@tanstack/react-query',
  ],
})
