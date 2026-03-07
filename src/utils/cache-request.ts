interface CacheDataParams {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  headers?: {
    [key: string]: string
  }
  body?: {
    [key: string]: any
  }
  staleTimeMs?: number
}

export function fetchWithCache({
  url,
  method = 'POST',
  headers = {
    'Content-Type': 'application/json',
  },
  body,
  staleTimeMs = 1000 * 30, // 30 seconds
}: CacheDataParams): Promise<unknown> {
  const cacheKey = `cache_${url}_${JSON.stringify(headers)}_${JSON.stringify(body)}`
  const cachedData = localStorage.getItem(cacheKey)
  if (cachedData) {
    const { data, retrievedAt } = JSON.parse(cachedData)
    const isStale = Date.now() - retrievedAt > staleTimeMs
    if (!isStale) {
      return Promise.resolve(data)
    }
  }

  const requestOptions: RequestInit = {
    method,
    headers,
  }

  // Only add body for non-GET requests
  if (method !== 'GET' && body) {
    requestOptions.body = JSON.stringify(body)
  }

  // Fetch fresh data if no valid cache or cache is stale
  return fetch(url, requestOptions)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`)
      }
      return response.json()
    })
    .then(response => {
      const data = response.data

      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          data,
          retrievedAt: Date.now(),
        }),
      )

      return data
    })
}
