import { defineConfig } from '@hey-api/openapi-ts'

// Generates a typed TS client + types from the API's OpenAPI document.
// Refresh openapi.json by running the API and fetching /openapi/v1.json, then
// `npm run gen:api`.
export default defineConfig({
  input: './openapi.json',
  output: 'src/api/generated',
  plugins: ['@hey-api/client-fetch', '@hey-api/sdk', '@hey-api/typescript'],
})
