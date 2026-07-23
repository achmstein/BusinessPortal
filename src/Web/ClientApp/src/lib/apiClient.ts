import { client } from '../api/generated/client.gen'

// Configure the generated Hey API client once at startup: same-origin
// (baseUrl '/'), send the auth cookie, and throw on non-2xx so callers try/catch.
client.setConfig({ baseUrl: '/', credentials: 'include', throwOnError: true })
