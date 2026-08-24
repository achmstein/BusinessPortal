// Pulls the live OpenAPI document from a running API into openapi.json.
//
// This exists because the spec was previously refreshed by hand, which meant a
// new endpoint could reach the client only if someone remembered to edit
// generated output correctly. Run the API, then:
//
//   npm run sync:api && npm run gen:api
//
// Override the host with API_URL when the API isn't on its default dev port.
import { writeFile } from 'node:fs/promises'

const base = (process.env.API_URL ?? 'http://localhost:5257').replace(/\/$/, '')
const url = `${base}/openapi/v1.json`

const response = await fetch(url).catch((cause) => {
  throw new Error(`Could not reach ${url}. Start the API first (dotnet run --project src/Web).`, { cause })
})

if (!response.ok) {
  throw new Error(`${url} returned ${response.status} ${response.statusText}.`)
}

const spec = await response.json()
const paths = Object.keys(spec.paths ?? {}).length
if (paths === 0) {
  throw new Error(`${url} returned a document with no paths — refusing to overwrite openapi.json.`)
}

await writeFile('openapi.json', `${JSON.stringify(spec, null, 2)}\n`)
console.log(`Wrote openapi.json — ${paths} paths from ${url}`)
