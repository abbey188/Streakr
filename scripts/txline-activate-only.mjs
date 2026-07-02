// Activate the TxLINE API token using an EXISTING subscribe txSig (no new tx).
// Run: node --env-file=.env.local scripts/txline-activate-only.mjs <txSig>
import { Connection, Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";

const apiOrigin = "https://txline.txodds.com";
const apiBaseUrl = `${apiOrigin}/api`;
const RPC = process.env.TXLINE_RPC_URL || "https://api.mainnet-beta.solana.com";
const SELECTED_LEAGUES = [];

const txSig = process.argv[2] || process.env.TXLINE_SUBSCRIBE_TXSIG;
if (!txSig) { console.error("Pass the subscribe txSig as an argument."); process.exit(1); }

const kp = Keypair.fromSecretKey(bs58.decode(process.env.TXLINE_DEVELOPER_WALLET_PRIVATE_KEY.trim()));
const connection = new Connection(RPC, "confirmed");

// Wait for the subscribe tx to finalize (the activation API verifies it on-chain).
console.log("Waiting for tx to finalize:", txSig);
for (let i = 0; i < 30; i++) {
  const st = await connection.getSignatureStatus(txSig, { searchTransactionHistory: true });
  const conf = st?.value?.confirmationStatus;
  console.log(`  [${i}] status:`, conf ?? "pending", st?.value?.err ? "ERR:" + JSON.stringify(st.value.err) : "");
  if (conf === "finalized") break;
  await new Promise((r) => setTimeout(r, 3000));
}

// Guest JWT
const authRes = await fetch(`${apiOrigin}/auth/guest/start`, { method: "POST" });
const authJson = await authRes.json().catch(() => null);
const jwt = authJson?.token;
console.log("guest JWT:", jwt ? "ok" : "FAILED " + JSON.stringify(authJson));
if (!jwt) process.exit(1);

// Sign activation message: `${txSig}:${leagues}:${jwt}`
const messageString = `${txSig}:${SELECTED_LEAGUES.join(",")}:${jwt}`;
const message = new TextEncoder().encode(messageString);
const walletSignature = Buffer.from(nacl.sign.detached(message, kp.secretKey)).toString("base64");

// Activate
const actRes = await fetch(`${apiBaseUrl}/token/activate`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
  body: JSON.stringify({ txSig, walletSignature, leagues: SELECTED_LEAGUES }),
});
const raw = await actRes.text();
console.log("activate status:", actRes.status);
console.log("activate body:", raw.slice(0, 800));

if (actRes.ok) {
  let apiToken;
  try { apiToken = JSON.parse(raw).token; } catch { apiToken = raw; }
  console.log("\n════════════════ SAVE TO .env.local ════════════════");
  console.log("TXLINE_SUBSCRIBE_TXSIG=" + txSig);
  console.log("TXLINE_API_TOKEN=" + apiToken);
  console.log("═════════════════════════════════════════════════════");
}
