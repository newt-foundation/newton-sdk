export function decodeJWT(token: string) {
  const [header, payload] = token.split('.').slice(0, 2);
  const decodedHeader = JSON.parse(atob(header));
  const decodedPayload = JSON.parse(atob(payload));

  return { header: decodedHeader, payload: decodedPayload };
}
