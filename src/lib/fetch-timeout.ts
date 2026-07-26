// Third-party scraper backends sometimes accept the connection but never
// respond — without a timeout a hung upstream blocks the request forever.
export async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 10000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
