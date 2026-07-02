// One-shot TxLINE free-tier setup (mainnet, SL12 real-time).
// Subscribe on-chain (free, gas only) → activate → print API token.
// Run: node --env-file=.env.local scripts/txline-activate.mjs
import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// ─── Config (mainnet) ──────────────────────────────────────────────────────
const RPC = process.env.TXLINE_RPC_URL || "https://api.mainnet-beta.solana.com";
const apiOrigin = "https://txline.txodds.com";
const apiBaseUrl = `${apiOrigin}/api`;
const programId = new PublicKey("9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA");
const txlTokenMint = new PublicKey("Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL");
const SERVICE_LEVEL_ID = 12; // real-time World Cup & Int Friendlies
const DURATION_WEEKS = 4;
const SELECTED_LEAGUES = [];

const secret = process.env.TXLINE_DEVELOPER_WALLET_PRIVATE_KEY;
if (!secret) { console.error("TXLINE_DEVELOPER_WALLET_PRIVATE_KEY not set"); process.exit(1); }

const kp = Keypair.fromSecretKey(bs58.decode(secret.trim()));
const connection = new Connection(RPC, "confirmed");
const wallet = new anchor.Wallet(kp);
const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
anchor.setProvider(provider);

console.log("Wallet:", kp.publicKey.toBase58());
console.log("RPC:", RPC);

// ─── Load program (IDL from file — TxLINE ships it; not published on-chain) ──
const __dirname = dirname(fileURLToPath(import.meta.url));
const idl = JSON.parse(readFileSync(join(__dirname, "idl", "txoracle.json"), "utf8"));
const program = new anchor.Program(idl, provider);
console.log("IDL loaded, program:", program.programId.toBase58());

// ─── Derive PDAs / ATAs ──────────────────────────────────────────────────────
const [tokenTreasuryPda] = PublicKey.findProgramAddressSync([Buffer.from("token_treasury_v2")], programId);
const tokenTreasuryVault = getAssociatedTokenAddressSync(txlTokenMint, tokenTreasuryPda, true, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
const [pricingMatrixPda] = PublicKey.findProgramAddressSync([Buffer.from("pricing_matrix")], programId);
const userTokenAccount = getAssociatedTokenAddressSync(txlTokenMint, kp.publicKey, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

// ─── Create the TxL token account if missing ────────────────────────────────
const ataInfo = await connection.getAccountInfo(userTokenAccount);
if (!ataInfo) {
  console.log("Creating TxL token account…");
  const ix = createAssociatedTokenAccountInstruction(
    kp.publicKey, userTokenAccount, kp.publicKey, txlTokenMint,
    TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const sig = await provider.sendAndConfirm(new Transaction().add(ix), []);
  console.log("  token account created:", sig);
} else {
  console.log("TxL token account already exists.");
}

// ─── Subscribe on-chain (free tier) ─────────────────────────────────────────
console.log("Subscribing (SL12, 4 weeks)…");
const txSig = await program.methods
  .subscribe(SERVICE_LEVEL_ID, DURATION_WEEKS)
  .accounts({
    user: kp.publicKey,
    pricingMatrix: pricingMatrixPda,
    tokenMint: txlTokenMint,
    userTokenAccount,
    tokenTreasuryVault,
    tokenTreasuryPda,
    tokenProgram: TOKEN_2022_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  })
  .rpc();
console.log("  subscribed, txSig:", txSig);

// Wait for finalization (activation API verifies the tx on-chain).
console.log("Waiting for finalization…");
for (let i = 0; i < 30; i++) {
  const st = await connection.getSignatureStatus(txSig, { searchTransactionHistory: true });
  if (st?.value?.confirmationStatus === "finalized") break;
  await new Promise((r) => setTimeout(r, 3000));
}

// ─── Activate API token ─────────────────────────────────────────────────────
console.log("Activating API token…");
const authRes = await fetch(`${apiOrigin}/auth/guest/start`, { method: "POST" });
const authJson = await authRes.json();
const jwt = authJson.token;
if (!jwt) { console.error("No guest JWT returned:", authJson); process.exit(1); }

const messageString = `${txSig}:${SELECTED_LEAGUES.join(",")}:${jwt}`;
const message = new TextEncoder().encode(messageString);
const walletSignature = Buffer.from(nacl.sign.detached(message, kp.secretKey)).toString("base64");

const actRes = await fetch(`${apiBaseUrl}/token/activate`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
  body: JSON.stringify({ txSig, walletSignature, leagues: SELECTED_LEAGUES }),
});
const raw = await actRes.text();
console.log("activate status:", actRes.status);
console.log("activate body:", raw.slice(0, 800));
if (!actRes.ok) process.exit(1);
let apiToken;
try { const j = JSON.parse(raw); apiToken = j.token || j.apiToken || j; } catch { apiToken = raw.trim(); }
if (typeof apiToken !== "string") apiToken = JSON.stringify(apiToken);

console.log("\n════════════════ SAVE TO .env.local ════════════════");
console.log("TXLINE_SUBSCRIBE_TXSIG=" + txSig);
console.log("TXLINE_API_TOKEN=" + apiToken);
console.log("═════════════════════════════════════════════════════");
