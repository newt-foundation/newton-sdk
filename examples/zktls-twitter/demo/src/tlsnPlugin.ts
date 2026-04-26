import type { AttesterSession, NewtonSDK } from "@newton-protocol/zktls-sdk";
import {
  extractCid,
  extractConnectionTime,
  extractFollowerCount,
  extractProofPayload,
  extractTwitterUsername,
  normalizeExtensionResult,
} from "./newtonFlow";
import type { ProofArtifact } from "./types";

export function hasTlsnExtension(): boolean {
  return typeof window !== "undefined" && typeof window.tlsn?.execCode === "function";
}

export function buildTwitterProofPlugin(username: string, session: AttesterSession): string {
  const screenName = username.replace(/^@/, "").trim();
  const url = `https://api.x.com/1.1/users/show.json?screen_name=${encodeURIComponent(screenName)}`;

  return `
/// <reference types="@tlsn/plugin-sdk/src/globals" />
const VERIFIER_URL = ${JSON.stringify(session.verifierUrl)};
const PROXY_URL = ${JSON.stringify(session.proxyUrl("api.x.com"))};
const TARGET_URL = ${JSON.stringify(url)};
const TARGET_USERNAME = ${JSON.stringify(screenName)};

async function onClick() {
  const cachedCookie = useState('cookie', null);
  const cachedCsrfToken = useState('x-csrf-token', null);
  const cachedTransactionId = useState('x-client-transaction-id', null);
  const cachedAuthorization = useState('authorization', null);

  if (!cachedCookie || !cachedCsrfToken || !cachedAuthorization) {
    throw new Error('Open x.com while signed in, then load a profile so the extension can observe api.x.com auth headers.');
  }

  const response = await prove(
    {
      url: TARGET_URL,
      method: 'GET',
      headers: {
        cookie: cachedCookie,
        'x-csrf-token': cachedCsrfToken,
        ...(cachedTransactionId ? { 'x-client-transaction-id': cachedTransactionId } : {}),
        authorization: cachedAuthorization,
        Host: 'api.x.com',
        'Accept-Encoding': 'identity',
        Connection: 'close',
      },
    },
    {
      verifierUrl: VERIFIER_URL,
      proxyUrl: PROXY_URL,
      maxRecvData: 16384,
      maxSentData: 4096,
      handlers: [
        { type: 'SENT', part: 'START_LINE', action: 'REVEAL' },
        { type: 'RECV', part: 'START_LINE', action: 'REVEAL' },
        { type: 'RECV', part: 'HEADERS', action: 'REVEAL', params: { key: 'date' } },
        { type: 'RECV', part: 'BODY', action: 'REVEAL', params: { type: 'json', path: 'screen_name' } },
        { type: 'RECV', part: 'BODY', action: 'REVEAL', params: { type: 'json', path: 'followers_count' } },
      ],
    }
  );

  done(JSON.stringify({
    target: TARGET_URL,
    server: 'api.x.com',
    twitter_username: TARGET_USERNAME,
    tlsn_connection_time: Math.floor(Date.now() / 1000),
    response,
  }));
}

function main() {
  const cachedCookie = useState('cookie', null);
  const cachedCsrfToken = useState('x-csrf-token', null);
  const cachedAuthorization = useState('authorization', null);

  if (!cachedCookie || !cachedCsrfToken || !cachedAuthorization) {
    const [header] = useHeaders((headers) =>
      headers.filter((h) => String(h.url || '').includes('https://api.x.com/'))
    );

    if (header) {
      const cookie = header.requestHeaders.find((h) => h.name === 'Cookie')?.value;
      const csrfToken = header.requestHeaders.find((h) => h.name === 'x-csrf-token')?.value;
      const transactionId = header.requestHeaders.find((h) => h.name === 'x-client-transaction-id')?.value;
      const authorization = header.requestHeaders.find((h) => h.name === 'authorization')?.value;
      if (cookie) setState('cookie', cookie);
      if (csrfToken) setState('x-csrf-token', csrfToken);
      if (transactionId) setState('x-client-transaction-id', transactionId);
      if (authorization) setState('authorization', authorization);
    }
  }

  useEffect(() => {
    openWindow('https://x.com/' + TARGET_USERNAME);
  }, []);

  return div({ style: { padding: '16px', fontFamily: 'system-ui', background: 'white', border: '1px solid #ddd', borderRadius: '8px' } }, [
    h3({}, ['Newton zkTLS X follower proof']),
    p({}, ['Target: @' + TARGET_USERNAME]),
    p({}, [cachedCookie && cachedCsrfToken && cachedAuthorization ? 'Auth headers detected. Ready to prove.' : 'Open the X profile and wait for api.x.com headers.']),
    button({ onclick: 'onClick', disabled: !(cachedCookie && cachedCsrfToken && cachedAuthorization) }, ['Generate TLSNotary proof'])
  ]);
}
`;
}

export async function generateTwitterProof(
  sdk: NewtonSDK,
  twitterUsername: string,
  onStep: (message: string) => void,
): Promise<ProofArtifact> {
  if (!hasTlsnExtension()) {
    throw new Error("TLSNotary extension bridge not found: window.tlsn.execCode is unavailable.");
  }

  onStep("Creating attester session over WebSocket /session…");
  const session = await sdk.attester.createSession({ maxRecvData: 16384, maxSentData: 4096 });

  onStep(`Session ${session.sessionId} registered; proxy bound to api.x.com.`);
  const pluginCode = buildTwitterProofPlugin(twitterUsername, session);

  onStep("Launching browser plugin proof flow…");
  const raw = await window.tlsn!.execCode(pluginCode);
  const result = normalizeExtensionResult(raw);

  const existingCid = extractCid(result);
  const proof = extractProofPayload(result);
  let cid = existingCid;
  let url: string | undefined;

  if (!cid) {
    if (!proof) {
      throw new Error("Proof completed but no proof bytes or CID were found in the extension result.");
    }
    onStep("Storing TLSNotary proof via /v1/proof/store…");
    const stored = await sdk.proof.store(proof);
    cid = stored.cid;
    url = stored.url;
  }

  onStep(`Proof stored: ${cid}`);
  return {
    cid,
    url,
    proof,
    source: "extension",
    server: "api.x.com",
    twitterUsername: extractTwitterUsername(result) ?? twitterUsername.replace(/^@/, ""),
    followerCount: extractFollowerCount(result),
    connectionTime: extractConnectionTime(result) ?? Math.floor(Date.now() / 1000),
    generatedAt: new Date().toISOString(),
    session,
    rawResult: result,
  };
}
