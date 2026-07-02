> ## Documentation Index
> Fetch the complete documentation index at: https://txline-docs.txodds.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Quickstart

> Get started with the TxLINE API in minutes

## Overview

TxLINE provides cryptographically verifiable sports data through a hybrid Solana on-chain and TxODDS off-chain system. Access fixtures, odds, and scores with time-limited API tokens secured by on-chain subscriptions.

***

## Getting Started

<Info>
  **Want to try for free?** Check out our [World Cup Free Tier](/documentation/worldcup) for instant access to World Cup and International Friendlies data with no payment required.
</Info>

Choose the path that matches your use case:

* **Free World Cup path**: Follow the [World Cup Free Tier](/documentation/worldcup) guide for service levels 1 or 12. No TxL purchase is required.
* **Paid subscription path**: Continue below to purchase TxL if needed, subscribe on-chain, and activate an API token.

## Select Your Network

Pick one network and use it consistently for every step. The Solana RPC, program ID, TxL mint, guest JWT, and activation endpoint must all be on the same network.

```typescript theme={null}
import * as anchor from "@coral-xyz/anchor";
import type { Txoracle } from "./types/txoracle"; // Use the matching mainnet/devnet type
import txoracleIdl from "./idl/txoracle.json"; // Use the matching mainnet/devnet IDL
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import axios from "axios";
import nacl from "tweetnacl";

const NETWORK: "mainnet" | "devnet" = "mainnet";

const CONFIG = {
  mainnet: {
    rpcUrl: "https://api.mainnet-beta.solana.com",
    apiOrigin: "https://txline.txodds.com",
    programId: new PublicKey("9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA"),
    txlTokenMint: new PublicKey("Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL"),
  },
  devnet: {
    rpcUrl: "https://api.devnet.solana.com",
    apiOrigin: "https://txline-dev.txodds.com",
    programId: new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J"),
    txlTokenMint: new PublicKey("4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG"),
  },
} as const;

const { rpcUrl, apiOrigin, programId, txlTokenMint } = CONFIG[NETWORK];
const apiBaseUrl = `${apiOrigin}/api`;

const connection = new Connection(rpcUrl, "confirmed");
const provider = new anchor.AnchorProvider(connection, wallet, {
  commitment: "confirmed",
});
anchor.setProvider(provider);

const program = new anchor.Program<Txoracle>(
  txoracleIdl as Txoracle,
  provider
);

if (!program.programId.equals(programId)) {
  throw new Error(
    `Loaded IDL program ${program.programId.toBase58()} does not match ${NETWORK} program ${programId.toBase58()}`
  );
}
```

<Warning>
  Do not activate a devnet transaction on `https://txline.txodds.com`, and do not activate a mainnet transaction on `https://txline-dev.txodds.com`. Use the matching `apiOrigin` from the selected network.
</Warning>

## Purchase TxL (Optional)

<Info>
  **Note**: Purchasing TxL tokens is optional. We offer [free tiers for World Cup and International Friendlies](/documentation/worldcup) data with no payment required. View all [subscription tiers](/documentation/subscription-tiers) to see free and premium options.
</Info>

In order to purchase TxL, your wallet will need to be funded with USDT. If you don't have USDT on Solana, you can swap for it using [Jupiter](https://jup.ag/) or another exchange.

TxL purchases use a 2-step process: request a quote from the backend, then verify and sign the transaction locally.

### Step 1: Request Purchase Quote

```typescript theme={null}
// Get guest JWT
const authResponse = await axios.post(`${apiOrigin}/auth/guest/start`);
const jwt = authResponse.data.token;

// Request purchase quote
const txlineAmount = 50; // Amount of TxL tokens to purchase

const quoteResponse = await fetch(`${apiBaseUrl}/guest/purchase/quote`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${jwt}`
  },
  body: JSON.stringify({
    buyerPubkey: wallet.publicKey.toBase58(),
    txlineAmount: txlineAmount
  })
});

const quoteData = await quoteResponse.json();
console.log(`Base Cost: ${quoteData.baseUsdtCost} USDT`);
console.log(`Premium Fee: ${quoteData.feeUsdtAmount} USDT`);
console.log(`Total: ${quoteData.totalUsdtCharged} USDT`);
```

### Step 2: Verify and Sign Transaction

```typescript theme={null}
// Deserialize the transaction from the quote
const txBuffer = Buffer.from(quoteData.transactionBase64, "base64");
const transaction = anchor.web3.Transaction.from(txBuffer);

// Verify transaction safety locally (recommended)
// This ensures the transaction matches what you requested

// Sign the transaction with either a local Keypair or a wallet adapter
const signedTransaction =
  "secretKey" in wallet
    ? (transaction.partialSign(wallet), transaction)
    : await wallet.signTransaction(transaction);

// Broadcast to Solana
const txSignature = await connection.sendRawTransaction(signedTransaction.serialize(), {
  skipPreflight: false,
  preflightCommitment: "confirmed"
});

// Confirm transaction
await connection.confirmTransaction(txSignature, "confirmed");
console.log("Purchase successful:", txSignature);
```

<Note>
  TxODDS may refuse purchase requests and ask for KYC (Know Your Customer) verification in accordance with compliance requirements.
</Note>

## Subscribe On-Chain

Subscribe to TxLINE on-chain after choosing a service level. Paid tiers require TxL; the free World Cup tiers do not require a TxL purchase. Choose between a standard subscription or a custom league selection.

Derive the shared accounts once before using either subscription tab:

```typescript theme={null}
const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("token_treasury_v2")],
  program.programId
);

const tokenTreasuryVault = getAssociatedTokenAddressSync(
  txlTokenMint,
  tokenTreasuryPda,
  true,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
);

const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("pricing_matrix")],
  program.programId
);

const userTokenAccount = getAssociatedTokenAddressSync(
  txlTokenMint,
  provider.wallet.publicKey,
  false,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
);
```

<Tabs>
  <Tab title="Standard Subscription">
    ```typescript theme={null}
    const SERVICE_LEVEL_ID = 1;
    const DURATION_WEEKS = 4;
    const SELECTED_LEAGUES: number[] = []; // Standard bundle

    const txSig = await program.methods
      .subscribe(SERVICE_LEVEL_ID, DURATION_WEEKS)
      .accounts({
        user: provider.wallet.publicKey,
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
    ```
  </Tab>

  <Tab title="Custom Leagues">
    ```typescript theme={null}
    const SERVICE_LEVEL_ID = 3;
    const DURATION_WEEKS = 4;
    const SELECTED_LEAGUES = [500001]; // Your league IDs

    const txSig = await program.methods
      .subscribe(SERVICE_LEVEL_ID, DURATION_WEEKS)
      .accounts({
        user: provider.wallet.publicKey,
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
    ```
  </Tab>
</Tabs>

## Activate Your API Token

After subscribing on-chain, activate your API access by signing the transaction and calling the activation endpoint.

```typescript theme={null}
// Get guest JWT
const authResponse = await axios.post(`${apiOrigin}/auth/guest/start`);
const jwt = authResponse.data.token;

// Sign the subscription transaction
const messageString = `${txSig}:${SELECTED_LEAGUES.join(",")}:${jwt}`;
const message = new TextEncoder().encode(messageString);

// For SELECTED_LEAGUES = [], this signs `${txSig}::${jwt}`.
async function signActivationMessage(message: Uint8Array): Promise<Uint8Array> {
  if ("signMessage" in wallet && wallet.signMessage) {
    return wallet.signMessage(message);
  }

  const localPayer = (provider.wallet as anchor.Wallet & {
    payer?: anchor.web3.Keypair;
  }).payer;

  if (localPayer) {
    return nacl.sign.detached(message, localPayer.secretKey);
  }

  throw new Error("Wallet must support signMessage, or run with a local Anchor payer.");
}

const signatureBytes = await signActivationMessage(message);
const walletSignature = Buffer.from(signatureBytes).toString("base64");

// Activate API access
const activationResponse = await axios.post(
  `${apiBaseUrl}/token/activate`,
  {
    txSig,
    walletSignature,
    leagues: SELECTED_LEAGUES,
  },
  { headers: { Authorization: `Bearer ${jwt}` } }
);

const apiToken = activationResponse.data.token || activationResponse.data;
```

You're now ready to use the API. Send both activated credentials with data API requests:

| Header          | Value                                        |
| --------------- | -------------------------------------------- |
| `Authorization` | `Bearer ${jwt}` from `/auth/guest/start`     |
| `X-Api-Token`   | `apiToken` returned by `/api/token/activate` |

## Next Steps

* View the complete [API Reference](/api-reference/authentication/start-a-new-guest-session) to explore all available endpoints
* Check out [Subscription Tiers](/documentation/subscription-tiers) for pricing and plan options
* Try the [World Cup Free Tier](/documentation/worldcup) for instant free access


> ## Documentation Index
> Fetch the complete documentation index at: https://txline-docs.txodds.com/llms.txt
> Use this file to discover all available pages before exploring further.

# World Cup Free Tier

> Access World Cup and International Friendlies data for free with TxLINE's complimentary tiers

## Start Building with Free World Cup Data

Experience the power of TxLINE's sports data API with our complimentary free tiers. Get instant access to World Cup and International Friendlies data with no payment required, no credit card needed, and no commitment. Choose between 60-second delayed data or real-time data - both completely free!

## What's Included

<CardGroup cols={2}>
  <Card title="Two Free Tiers Available" icon="trophy">
    **Service Level 1**: World Cup & Int Friendlies with 60-second delay
    **Service Level 12**: World Cup & Int Friendlies in real-time
  </Card>

  <Card title="Historical Replay" icon="clock-rotate-left">
    Full access to historical data for past matches and events analysis.
  </Card>

  <Card title="On-Chain Verification" icon="shield-check">
    Cryptographically verifiable data with Solana blockchain anchoring.
  </Card>

  <Card title="Production Ready" icon="rocket">
    Same reliable infrastructure as our premium tiers with comprehensive documentation.
  </Card>
</CardGroup>

<Info>
  **Perfect For**: Developers building proof-of-concepts, hobbyist projects, learning platforms, or testing TxLINE before upgrading to real-time data.
</Info>

## Getting Started

### Step 1: Choose a Network and Set Up Your Wallet

Use the same network for every step: the Solana RPC, TxLINE program ID, guest JWT, and activation endpoint must all match. A devnet subscription transaction cannot be activated on the mainnet API host.

```bash theme={null}
npm install @coral-xyz/anchor @solana/web3.js @solana/spl-token axios tweetnacl
```

```typescript theme={null}
import * as anchor from "@coral-xyz/anchor";
import type { Txoracle } from "./types/txoracle"; // Use the matching mainnet/devnet type
import txoracleIdl from "./idl/txoracle.json"; // Use the matching mainnet/devnet IDL
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import axios from "axios";
import nacl from "tweetnacl";

const NETWORK: "mainnet" | "devnet" = "devnet";

const CONFIG = {
  mainnet: {
    rpcUrl: "https://api.mainnet-beta.solana.com",
    apiOrigin: "https://txline.txodds.com",
    programId: new PublicKey("9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA"),
    txlTokenMint: new PublicKey("Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL"),
  },
  devnet: {
    rpcUrl: "https://api.devnet.solana.com",
    apiOrigin: "https://txline-dev.txodds.com",
    programId: new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J"),
    txlTokenMint: new PublicKey("4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG"),
  },
} as const;

const { rpcUrl, apiOrigin, programId, txlTokenMint } = CONFIG[NETWORK];
const apiBaseUrl = `${apiOrigin}/api`;

const connection = new Connection(rpcUrl, "confirmed");
const provider = new anchor.AnchorProvider(connection, wallet, {
  commitment: "confirmed",
});
anchor.setProvider(provider);

const program = new anchor.Program<Txoracle>(
  txoracleIdl as Txoracle,
  provider
);

if (!program.programId.equals(programId)) {
  throw new Error(
    `Loaded IDL program ${program.programId.toBase58()} does not match ${NETWORK} program ${programId.toBase58()}`
  );
}
```

### Step 2: Subscribe to Free Tier

Choose between the free service levels that are enabled on your network. Mainnet offers service level `1` for 60-second delayed World Cup and International Friendlies data and service level `12` for real-time data. Devnet currently documents service level `1`; check the on-chain pricing matrix before using any other devnet row.

```typescript theme={null}
// Free tier configuration - choose one:
const SERVICE_LEVEL_ID = 1;  // World Cup & Int Friendlies (60-second delay)
// const SERVICE_LEVEL_ID = 12; // Mainnet real-time World Cup & Int Friendlies
const DURATION_WEEKS = 4; // Subscribe for 4 weeks at a time
const SELECTED_LEAGUES: number[] = []; // Empty for standard bundle

const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("token_treasury_v2")],
  program.programId
);

const tokenTreasuryVault = getAssociatedTokenAddressSync(
  txlTokenMint,
  tokenTreasuryPda,
  true,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
);

const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("pricing_matrix")],
  program.programId
);

const userTokenAccount = getAssociatedTokenAddressSync(
  txlTokenMint,
  provider.wallet.publicKey,
  false,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
);

// Subscribe on-chain
const txSig = await program.methods
  .subscribe(SERVICE_LEVEL_ID, DURATION_WEEKS)
  .accounts({
    user: provider.wallet.publicKey,
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

console.log("Subscription transaction:", txSig);
```

<Note>
  **No Payment Required**: Free tiers require no TxL payment. The transaction still registers your wallet subscription on-chain and must be activated with the matching TxLINE API host.
</Note>

### Step 3: Activate Your API Access

After subscribing on-chain, activate your API token by signing and calling our activation endpoint.

```typescript theme={null}
// Get guest authentication token
const authResponse = await axios.post(`${apiOrigin}/auth/guest/start`);
const jwt = authResponse.data.token;

// Create message to sign
const messageString = `${txSig}:${SELECTED_LEAGUES.join(",")}:${jwt}`;
const message = new TextEncoder().encode(messageString);

// For SELECTED_LEAGUES = [], this signs `${txSig}::${jwt}`.
async function signActivationMessage(message: Uint8Array): Promise<Uint8Array> {
  if ("signMessage" in wallet && wallet.signMessage) {
    return wallet.signMessage(message);
  }

  const localPayer = (provider.wallet as anchor.Wallet & {
    payer?: anchor.web3.Keypair;
  }).payer;

  if (localPayer) {
    return nacl.sign.detached(message, localPayer.secretKey);
  }

  throw new Error("Wallet must support signMessage, or run with a local Anchor payer.");
}

const signatureBytes = await signActivationMessage(message);
const walletSignature = Buffer.from(signatureBytes).toString("base64");

// Activate your API access
const activationResponse = await axios.post(
  `${apiBaseUrl}/token/activate`,
  {
    txSig,
    walletSignature,
    leagues: SELECTED_LEAGUES,
  },
  {
    headers: { Authorization: `Bearer ${jwt}` }
  }
);

// Save your API token
const apiToken = activationResponse.data.token || activationResponse.data;
console.log("API Token activated successfully!");
```

### Step 4: Make Your First API Call

You're all set! Start fetching World Cup and International Friendlies data using your activated API credentials.

Check out the complete [API Reference](/api-reference/authentication/start-a-new-guest-session) for available endpoints including:

* **Fixtures** - Get upcoming and current fixture metadata
* **Odds** - Fetch snapshots, historical updates, and stream StablePrice odds
* **Scores** - Fetch snapshots, historical updates, and stream score events
* **Validation Proofs** - Retrieve fixture, odds, and score proofs for on-chain validation

Data API endpoints use `Authorization: Bearer ${jwt}` for the guest JWT and `X-Api-Token: ${apiToken}` for the activated API token.

## Ready for More?

Love the free tier? Upgrade to unlock:

<CardGroup cols={3}>
  <Card title="Real-Time Data" icon="bolt">
    Zero delay live data for time-sensitive applications
  </Card>

  <Card title="1000+ Leagues" icon="trophy">
    Access to all major leagues worldwide
  </Card>

  <Card title="Custom Leagues" icon="sliders">
    Choose exactly which leagues you need
  </Card>
</CardGroup>

View our [Subscription Tiers](/documentation/subscription-tiers) to see all available options. Paid tiers start from just **500,000 TxL (\$500) per 28 days**.

## Frequently Asked Questions

<AccordionGroup>
  <Accordion title="Do I need to renew my free subscription?">
    All subscriptions can be purchased for any duration in multiples of 4 weeks (28 days), up to 12 months. Simply re-subscribe when your access expires. There's no cost to renew free tiers.
  </Accordion>

  <Accordion title="Can I upgrade from free tier to paid?">
    Absolutely! You can upgrade at any time by subscribing to a paid tier. Your new subscription will take effect immediately.
  </Accordion>

  <Accordion title="Is there a rate limit on free tier?">
    No rate limits on API calls. However, data has a 60-second delay compared to premium real-time tiers.
  </Accordion>

  <Accordion title="What happens if I don't renew?">
    Your API access will expire after the subscription period ends. You can re-subscribe at any time to regain access.
  </Accordion>

  <Accordion title="Can I use this for commercial projects?">
    Yes! The free tier can be used for commercial projects. However, for production applications, we recommend upgrading to real-time data for the best user experience.
  </Accordion>
</AccordionGroup>

***

<Info>
  **Ready to start?** Follow the steps above to get your free API access in under 5 minutes. No credit card required.
</Info>


> ## Documentation Index
> Fetch the complete documentation index at: https://txline-docs.txodds.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Schedule

> Confirmed fixtures currently listed for TxLINE match data coverage

## World Cup - Group Stage

### June 14, 2026

| fixtureId | Sport  | Country       | Fixture Group           | Time (UTC) | Home Team   | Away Team |
| --------- | ------ | ------------- | ----------------------- | ---------- | ----------- | --------- |
| 17588316  | Soccer | International | World Cup > Group Stage | 01:00      | Haiti       | Scotland  |
| 17926689  | Soccer | International | World Cup > Group Stage | 04:00      | Australia   | Turkey    |
| 17588318  | Soccer | International | World Cup > Group Stage | 17:00      | Germany     | Curacao   |
| 17588305  | Soccer | International | World Cup > Group Stage | 20:00      | Netherlands | Japan     |
| 17588239  | Soccer | International | World Cup > Group Stage | 23:00      | Ivory Coast | Ecuador   |

### June 15, 2026

| fixtureId | Sport  | Country       | Fixture Group           | Time (UTC) | Home Team    | Away Team  |
| --------- | ------ | ------------- | ----------------------- | ---------- | ------------ | ---------- |
| 17926553  | Soccer | International | World Cup > Group Stage | 02:00      | Sweden       | Tunisia    |
| 17588403  | Soccer | International | World Cup > Group Stage | 16:00      | Spain        | Cape Verde |
| 17588230  | Soccer | International | World Cup > Group Stage | 19:00      | Belgium      | Egypt      |
| 17588311  | Soccer | International | World Cup > Group Stage | 22:00      | Saudi Arabia | Uruguay    |

### June 16, 2026

| fixtureId | Sport  | Country       | Fixture Group           | Time (UTC) | Home Team | Away Team   |
| --------- | ------ | ------------- | ----------------------- | ---------- | --------- | ----------- |
| 17588241  | Soccer | International | World Cup > Group Stage | 01:00      | Iran      | New Zealand |
| 17588306  | Soccer | International | World Cup > Group Stage | 19:00      | France    | Senegal     |
| 17926828  | Soccer | International | World Cup > Group Stage | 22:00      | Iraq      | Norway      |

### June 17, 2026

| fixtureId | Sport  | Country       | Fixture Group           | Time (UTC) | Home Team | Away Team |
| --------- | ------ | ------------- | ----------------------- | ---------- | --------- | --------- |
| 17588322  | Soccer | International | World Cup > Group Stage | 01:00      | Argentina | Algeria   |
| 17588405  | Soccer | International | World Cup > Group Stage | 04:00      | Austria   | Jordan    |
| 17926703  | Soccer | International | World Cup > Group Stage | 17:00      | Portugal  | Congo DR  |
| 17588228  | Soccer | International | World Cup > Group Stage | 20:00      | England   | Croatia   |
| 17588406  | Soccer | International | World Cup > Group Stage | 23:00      | Ghana     | Panama    |

### June 18, 2026

| fixtureId | Sport  | Country       | Fixture Group           | Time (UTC) | Home Team      | Away Team            |
| --------- | ------ | ------------- | ----------------------- | ---------- | -------------- | -------------------- |
| 17588399  | Soccer | International | World Cup > Group Stage | 02:00      | Uzbekistan     | Colombia             |
| 17926765  | Soccer | International | World Cup > Group Stage | 16:00      | Czech Republic | South Africa         |
| 17926603  | Soccer | International | World Cup > Group Stage | 19:00      | Switzerland    | Bosnia & Herzegovina |
| 17588238  | Soccer | International | World Cup > Group Stage | 22:00      | Canada         | Qatar                |

### June 19, 2026

| fixtureId | Sport  | Country       | Fixture Group           | Time (UTC) | Home Team | Away Team   |
| --------- | ------ | ------------- | ----------------------- | ---------- | --------- | ----------- |
| 17588223  | Soccer | International | World Cup > Group Stage | 01:00      | Mexico    | South Korea |
| 17588388  | Soccer | International | World Cup > Group Stage | 19:00      | USA       | Australia   |
| 17588397  | Soccer | International | World Cup > Group Stage | 22:00      | Scotland  | Morocco     |

### June 20, 2026

| fixtureId | Sport  | Country       | Fixture Group           | Time (UTC) | Home Team   | Away Team   |
| --------- | ------ | ------------- | ----------------------- | ---------- | ----------- | ----------- |
| 17588317  | Soccer | International | World Cup > Group Stage | 00:30      | Brazil      | Haiti       |
| 17588229  | Soccer | International | World Cup > Group Stage | 03:00      | Turkey      | Paraguay    |
| 17926687  | Soccer | International | World Cup > Group Stage | 17:00      | Netherlands | Sweden      |
| 17588240  | Soccer | International | World Cup > Group Stage | 20:00      | Germany     | Ivory Coast |
| 17588320  | Soccer | International | World Cup > Group Stage | 23:00      | Ecuador     | Curacao     |

### June 21, 2026

| fixtureId | Sport  | Country       | Fixture Group           | Time (UTC) | Home Team | Away Team    |
| --------- | ------ | ------------- | ----------------------- | ---------- | --------- | ------------ |
| 17588310  | Soccer | International | World Cup > Group Stage | 04:00      | Tunisia   | Japan        |
| 17588232  | Soccer | International | World Cup > Group Stage | 16:00      | Spain     | Saudi Arabia |
| 17588390  | Soccer | International | World Cup > Group Stage | 19:00      | Belgium   | Iran         |
| 17588235  | Soccer | International | World Cup > Group Stage | 22:00      | Uruguay   | Cape Verde   |

### June 22, 2026

| fixtureId | Sport  | Country       | Fixture Group           | Time (UTC) | Home Team   | Away Team |
| --------- | ------ | ------------- | ----------------------- | ---------- | ----------- | --------- |
| 17588242  | Soccer | International | World Cup > Group Stage | 01:00      | New Zealand | Egypt     |
| 17588389  | Soccer | International | World Cup > Group Stage | 17:00      | Argentina   | Austria   |
| 17926647  | Soccer | International | World Cup > Group Stage | 21:00      | France      | Iraq      |

### June 23, 2026

| fixtureId | Sport  | Country       | Fixture Group           | Time (UTC) | Home Team | Away Team  |
| --------- | ------ | ------------- | ----------------------- | ---------- | --------- | ---------- |
| 17588313  | Soccer | International | World Cup > Group Stage | 00:00      | Norway    | Senegal    |
| 17588244  | Soccer | International | World Cup > Group Stage | 03:00      | Jordan    | Algeria    |
| 17588231  | Soccer | International | World Cup > Group Stage | 17:00      | Portugal  | Uzbekistan |
| 17588324  | Soccer | International | World Cup > Group Stage | 20:00      | England   | Ghana      |
| 17588401  | Soccer | International | World Cup > Group Stage | 23:00      | Panama    | Croatia    |

### June 24, 2026

| fixtureId | Sport  | Country       | Fixture Group           | Time (UTC) | Home Team            | Away Team |
| --------- | ------ | ------------- | ----------------------- | ---------- | -------------------- | --------- |
| 17926615  | Soccer | International | World Cup > Group Stage | 02:00      | Colombia             | Congo DR  |
| 17588303  | Soccer | International | World Cup > Group Stage | 19:00      | Switzerland          | Canada    |
| 17926766  | Soccer | International | World Cup > Group Stage | 19:00      | Bosnia & Herzegovina | Qatar     |
| 17588319  | Soccer | International | World Cup > Group Stage | 22:00      | Morocco              | Haiti     |
| 17588398  | Soccer | International | World Cup > Group Stage | 22:00      | Scotland             | Brazil    |

### June 25, 2026

| fixtureId | Sport  | Country       | Fixture Group           | Time (UTC) | Home Team      | Away Team   |
| --------- | ------ | ------------- | ----------------------- | ---------- | -------------- | ----------- |
| 17588395  | Soccer | International | World Cup > Group Stage | 01:00      | South Africa   | South Korea |
| 17926764  | Soccer | International | World Cup > Group Stage | 01:00      | Czech Republic | Mexico      |
| 17588302  | Soccer | International | World Cup > Group Stage | 20:00      | Ecuador        | Germany     |
| 17588321  | Soccer | International | World Cup > Group Stage | 20:00      | Curacao        | Ivory Coast |
| 17588236  | Soccer | International | World Cup > Group Stage | 23:00      | Tunisia        | Netherlands |
| 17926686  | Soccer | International | World Cup > Group Stage | 23:00      | Japan          | Sweden      |

### June 26, 2026

| fixtureId | Sport  | Country       | Fixture Group           | Time (UTC) | Home Team | Away Team |
| --------- | ------ | ------------- | ----------------------- | ---------- | --------- | --------- |
| 17588229  | Soccer | International | World Cup > Group Stage | 02:00      | Paraguay  | Australia |
| 17926593  | Soccer | International | World Cup > Group Stage | 02:00      | Turkey    | USA       |
| 17588234  | Soccer | International | World Cup > Group Stage | 19:00      | Norway    | France    |
| 17926740  | Soccer | International | World Cup > Group Stage | 19:00      | Senegal   | Iraq      |

### June 27, 2026

| fixtureId | Sport  | Country       | Fixture Group           | Time (UTC) | Home Team   | Away Team    |
| --------- | ------ | ------------- | ----------------------- | ---------- | ----------- | ------------ |
| 17588314  | Soccer | International | World Cup > Group Stage | 00:00      | Cape Verde  | Saudi Arabia |
| 17588404  | Soccer | International | World Cup > Group Stage | 00:00      | Uruguay     | Spain        |
| 17588309  | Soccer | International | World Cup > Group Stage | 03:00      | Egypt       | Iran         |
| 17588323  | Soccer | International | World Cup > Group Stage | 03:00      | New Zealand | Belgium      |
| 17588245  | Soccer | International | World Cup > Group Stage | 21:00      | Croatia     | Ghana        |
| 17588402  | Soccer | International | World Cup > Group Stage | 21:00      | Panama      | England      |
| 17588391  | Soccer | International | World Cup > Group Stage | 23:30      | Colombia    | Portugal     |
| 17926704  | Soccer | International | World Cup > Group Stage | 23:30      | Congo DR    | Uzbekistan   |

### June 28, 2026

| fixtureId | Sport  | Country       | Fixture Group           | Time (UTC) | Home Team | Away Team |
| --------- | ------ | ------------- | ----------------------- | ---------- | --------- | --------- |
| 17588325  | Soccer | International | World Cup > Group Stage | 02:00      | Jordan    | Argentina |
| 17588326  | Soccer | International | World Cup > Group Stage | 02:00      | Algeria   | Austria   |

## World Cup - Round of 32

### June 28, 2026

| fixtureId | Sport  | Country       | Fixture Group           | Time (UTC) | Home Team    | Away Team |
| --------- | ------ | ------------- | ----------------------- | ---------- | ------------ | --------- |
| 18167317  | Soccer | International | World Cup > Round of 32 | 19:00      | South Africa | Canada    |

### June 29, 2026

| fixtureId | Sport  | Country       | Fixture Group           | Time (UTC) | Home Team | Away Team |
| --------- | ------ | ------------- | ----------------------- | ---------- | --------- | --------- |
| 18172489  | Soccer | International | World Cup > Round of 32 | 17:00      | Brazil    | Japan     |
| 18175983  | Soccer | International | World Cup > Round of 32 | 20:30      | Germany   | Paraguay  |

### June 30, 2026

| fixtureId | Sport  | Country       | Fixture Group           | Time (UTC) | Home Team   | Away Team |
| --------- | ------ | ------------- | ----------------------- | ---------- | ----------- | --------- |
| 18172260  | Soccer | International | World Cup > Round of 32 | 01:00      | Netherlands | Morocco   |
| 18175397  | Soccer | International | World Cup > Round of 32 | 17:00      | Ivory Coast | Norway    |
| 18175981  | Soccer | International | World Cup > Round of 32 | 21:00      | France      | Sweden    |

### July 1, 2026

| fixtureId | Sport  | Country       | Fixture Group           | Time (UTC) | Home Team | Away Team |
| --------- | ------ | ------------- | ----------------------- | ---------- | --------- | --------- |
| 18179759  | Soccer | International | World Cup > Round of 32 | 01:00      | Mexico    | Ecuador   |
| 18179764  | Soccer | International | World Cup > Round of 32 | 16:00      | England   | Congo DR  |
| 18179550  | Soccer | International | World Cup > Round of 32 | 20:00      | Belgium   | Senegal   |

### July 2, 2026

| fixtureId | Sport  | Country       | Fixture Group           | Time (UTC) | Home Team | Away Team            |
| --------- | ------ | ------------- | ----------------------- | ---------- | --------- | -------------------- |
| 18172379  | Soccer | International | World Cup > Round of 32 | 00:00      | USA       | Bosnia & Herzegovina |
| 18179551  | Soccer | International | World Cup > Round of 32 | 19:00      | Spain     | Austria              |
| 18179763  | Soccer | International | World Cup > Round of 32 | 23:00      | Portugal  | Croatia              |

### July 3, 2026

| fixtureId | Sport  | Country       | Fixture Group           | Time (UTC) | Home Team   | Away Team  |
| --------- | ------ | ------------- | ----------------------- | ---------- | ----------- | ---------- |
| 18179552  | Soccer | International | World Cup > Round of 32 | 03:00      | Switzerland | Algeria    |
| 18176123  | Soccer | International | World Cup > Round of 32 | 18:00      | Australia   | Egypt      |
| 18175918  | Soccer | International | World Cup > Round of 32 | 22:00      | Argentina   | Cape Verde |

### July 4, 2026

| fixtureId | Sport  | Country       | Fixture Group           | Time (UTC) | Home Team | Away Team |
| --------- | ------ | ------------- | ----------------------- | ---------- | --------- | --------- |
| 18179549  | Soccer | International | World Cup > Round of 32 | 01:30      | Colombia  | Ghana     |

***

<Note>
  All times are displayed in UTC. Fixtures are subject to change. All matches include Scores and StablePrice Odds coverage.
</Note>

<Info>
  **Coverage Details**: The schedule above lists fixtures confirmed for TxLINE match data coverage. Use the fixtures snapshot API for current fixture availability.
</Info>


> ## Documentation Index
> Fetch the complete documentation index at: https://txline-docs.txodds.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Program Addresses

> TxLINE Solana program addresses and key accounts

## Mainnet Addresses

| Type           | Address                                        |
| -------------- | ---------------------------------------------- |
| Program ID     | `9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA` |
| TxL Token Mint | `Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL`  |
| USDT Mint      | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` |
| API Endpoint   | `https://txline.txodds.com/api/`               |

## Devnet Addresses

| Type           | Address                                        |
| -------------- | ---------------------------------------------- |
| Program ID     | `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J` |
| TxL Token Mint | `4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG` |
| USDT Mint      | `ELWTKspHKCnCfCiCiqYw1EDH77k8VCP74dK9qytG2Ujh` |
| API Endpoint   | `https://txline-dev.txodds.com/api/`           |

<Warning>
  Use all values from one network only. A devnet subscribe transaction from `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J` must be activated with `https://txline-dev.txodds.com`, and a mainnet subscribe transaction from `9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA` must be activated with `https://txline.txodds.com`.
</Warning>

## API Hosts

| Network | Guest Auth                                       | API Base                             |
| ------- | ------------------------------------------------ | ------------------------------------ |
| Mainnet | `https://txline.txodds.com/auth/guest/start`     | `https://txline.txodds.com/api/`     |
| Devnet  | `https://txline-dev.txodds.com/auth/guest/start` | `https://txline-dev.txodds.com/api/` |

Use the host root for `/auth/guest/start`, then use the matching `/api/token/activate` endpoint after the on-chain `subscribe` transaction confirms.

## Deriving Program Derived Addresses (PDAs)

The program uses several PDAs that you'll need to derive when interacting with it:

```typescript theme={null}
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";

const programId = new PublicKey("9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA");
const txlTokenMint = new PublicKey("Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL");

// For devnet, replace both constants with the devnet values above.

// Token Treasury PDA - owns the vault that collects subscription fees
const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("token_treasury_v2")],
  programId
);

// Token Treasury Vault - the ATA that holds collected TxL tokens
const tokenTreasuryVault = getAssociatedTokenAddressSync(
  txlTokenMint,
  tokenTreasuryPda,
  true, // Allow PDA owner
  TOKEN_2022_PROGRAM_ID
);

// Pricing Matrix PDA - contains service tier pricing information
const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("pricing_matrix")],
  programId
);

// USDT Treasury PDA - owns the vault that collects USDT for token purchases
const [usdtTreasuryPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("usdt_treasury")],
  programId
);

const usdtMint = new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB");

// USDT Treasury Vault - the ATA that holds collected USDT
const usdtTreasuryVault = getAssociatedTokenAddressSync(
  usdtMint,
  usdtTreasuryPda,
  true,
  TOKEN_2022_PROGRAM_ID
);

// Daily Scores Merkle Roots PDA - for validating scores data
const epochDay = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
const [dailyScoresPda] = PublicKey.findProgramAddressSync(
  [
    Buffer.from("daily_scores_roots"),
    new BN(epochDay).toArrayLike(Buffer, "le", 2)
  ],
  programId
);

// Daily Batch Roots PDA - for validating odds data
const [dailyBatchRootsPda] = PublicKey.findProgramAddressSync(
  [
    Buffer.from("daily_batch_roots"),
    new BN(epochDay).toArrayLike(Buffer, "le", 2)
  ],
  programId
);

// Ten Daily Fixtures Roots PDA - for validating fixtures data
const alignedEpochDay = Math.floor(epochDay / 10) * 10;
const [tenDailyFixturesRootsPda] = PublicKey.findProgramAddressSync(
  [
    Buffer.from("ten_daily_fixtures_roots"),
    new BN(alignedEpochDay).toArrayLike(Buffer, "le", 2)
  ],
  programId
);

console.log("Token Treasury PDA:", tokenTreasuryPda.toBase58());
console.log("Token Treasury Vault:", tokenTreasuryVault.toBase58());
console.log("USDT Treasury PDA:", usdtTreasuryPda.toBase58());
console.log("USDT Treasury Vault:", usdtTreasuryVault.toBase58());
console.log("Pricing Matrix PDA:", pricingMatrixPda.toBase58());
console.log("Daily Scores PDA:", dailyScoresPda.toBase58());
console.log("Daily Batch Roots PDA:", dailyBatchRootsPda.toBase58());
console.log("Ten Daily Fixtures Roots PDA:", tenDailyFixturesRootsPda.toBase58());
```


> ## Documentation Index
> Fetch the complete documentation index at: https://txline-docs.txodds.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Program Addresses

> TxLINE Solana program addresses and key accounts

## Mainnet Addresses

| Type           | Address                                        |
| -------------- | ---------------------------------------------- |
| Program ID     | `9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA` |
| TxL Token Mint | `Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL`  |
| USDT Mint      | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` |
| API Endpoint   | `https://txline.txodds.com/api/`               |

## Devnet Addresses

| Type           | Address                                        |
| -------------- | ---------------------------------------------- |
| Program ID     | `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J` |
| TxL Token Mint | `4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG` |
| USDT Mint      | `ELWTKspHKCnCfCiCiqYw1EDH77k8VCP74dK9qytG2Ujh` |
| API Endpoint   | `https://txline-dev.txodds.com/api/`           |

<Warning>
  Use all values from one network only. A devnet subscribe transaction from `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J` must be activated with `https://txline-dev.txodds.com`, and a mainnet subscribe transaction from `9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA` must be activated with `https://txline.txodds.com`.
</Warning>

## API Hosts

| Network | Guest Auth                                       | API Base                             |
| ------- | ------------------------------------------------ | ------------------------------------ |
| Mainnet | `https://txline.txodds.com/auth/guest/start`     | `https://txline.txodds.com/api/`     |
| Devnet  | `https://txline-dev.txodds.com/auth/guest/start` | `https://txline-dev.txodds.com/api/` |

Use the host root for `/auth/guest/start`, then use the matching `/api/token/activate` endpoint after the on-chain `subscribe` transaction confirms.

## Deriving Program Derived Addresses (PDAs)

The program uses several PDAs that you'll need to derive when interacting with it:

```typescript theme={null}
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";

const programId = new PublicKey("9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA");
const txlTokenMint = new PublicKey("Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL");

// For devnet, replace both constants with the devnet values above.

// Token Treasury PDA - owns the vault that collects subscription fees
const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("token_treasury_v2")],
  programId
);

// Token Treasury Vault - the ATA that holds collected TxL tokens
const tokenTreasuryVault = getAssociatedTokenAddressSync(
  txlTokenMint,
  tokenTreasuryPda,
  true, // Allow PDA owner
  TOKEN_2022_PROGRAM_ID
);

// Pricing Matrix PDA - contains service tier pricing information
const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("pricing_matrix")],
  programId
);

// USDT Treasury PDA - owns the vault that collects USDT for token purchases
const [usdtTreasuryPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("usdt_treasury")],
  programId
);

const usdtMint = new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB");

// USDT Treasury Vault - the ATA that holds collected USDT
const usdtTreasuryVault = getAssociatedTokenAddressSync(
  usdtMint,
  usdtTreasuryPda,
  true,
  TOKEN_2022_PROGRAM_ID
);

// Daily Scores Merkle Roots PDA - for validating scores data
const epochDay = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
const [dailyScoresPda] = PublicKey.findProgramAddressSync(
  [
    Buffer.from("daily_scores_roots"),
    new BN(epochDay).toArrayLike(Buffer, "le", 2)
  ],
  programId
);

// Daily Batch Roots PDA - for validating odds data
const [dailyBatchRootsPda] = PublicKey.findProgramAddressSync(
  [
    Buffer.from("daily_batch_roots"),
    new BN(epochDay).toArrayLike(Buffer, "le", 2)
  ],
  programId
);

// Ten Daily Fixtures Roots PDA - for validating fixtures data
const alignedEpochDay = Math.floor(epochDay / 10) * 10;
const [tenDailyFixturesRootsPda] = PublicKey.findProgramAddressSync(
  [
    Buffer.from("ten_daily_fixtures_roots"),
    new BN(alignedEpochDay).toArrayLike(Buffer, "le", 2)
  ],
  programId
);

console.log("Token Treasury PDA:", tokenTreasuryPda.toBase58());
console.log("Token Treasury Vault:", tokenTreasuryVault.toBase58());
console.log("USDT Treasury PDA:", usdtTreasuryPda.toBase58());
console.log("USDT Treasury Vault:", usdtTreasuryVault.toBase58());
console.log("Pricing Matrix PDA:", pricingMatrixPda.toBase58());
console.log("Daily Scores PDA:", dailyScoresPda.toBase58());
console.log("Daily Batch Roots PDA:", dailyBatchRootsPda.toBase58());
console.log("Ten Daily Fixtures Roots PDA:", tenDailyFixturesRootsPda.toBase58());
```


> ## Documentation Index
> Fetch the complete documentation index at: https://txline-docs.txodds.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Fetching Snapshots

> Retrieve fixtures, odds, and scores data

<Info>
  **API Endpoints**: Use `https://txline.txodds.com/api/` for mainnet or `https://txline-dev.txodds.com/api/` for devnet
</Info>

<Info>
  **Prerequisites**: Complete [Quickstart activation](/documentation/quickstart) or [World Cup Free Tier activation](/documentation/worldcup) first. The snippets assume `jwt` is the guest JWT from `/auth/guest/start` and `apiToken` is the value returned by `/api/token/activate`.
</Info>

## Fetch Fixtures Snapshot

Get all fixtures for a specific competition or all competitions.

<Note>
  `Participant1IsHome` is the feed's home/away designation for mapping `Participant1` and `Participant2`; it is not a venue guarantee. For neutral competitions such as the World Cup, `Participant1IsHome: true` means `Participant1` is listed as the home side for feed purposes, even if the match is not played in that team's country.
</Note>

```typescript theme={null}
import axios from "axios";

const httpClient = axios.create({
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${jwt}`,
    "X-Api-Token": apiToken
  },
  baseURL: "https://txline.txodds.com",
});

// Get fixtures for specific competition
const fixturesResponse = await httpClient.get("/api/fixtures/snapshot", {
  params: {
    competitionId: 500005, // NCAA Division I FBS
  },
});
const fixtures = fixturesResponse.data;

console.log(`Retrieved ${fixtures.length} fixtures`);
fixtures.slice(0, 3).forEach((fixture, index) => {
  const homeTeam = fixture.Participant1IsHome
    ? fixture.Participant1
    : fixture.Participant2;
  const awayTeam = fixture.Participant1IsHome
    ? fixture.Participant2
    : fixture.Participant1;

  console.log(`${index + 1}. ${homeTeam} vs ${awayTeam}`);
  console.log(`   ID: ${fixture.FixtureId}, Start: ${new Date(fixture.StartTime).toISOString()}`);
});

// Get all fixtures
const allFixturesResponse = await httpClient.get("/api/fixtures/snapshot");
const allFixtures = allFixturesResponse.data;

console.log(`Retrieved ${allFixtures.length} total fixtures`);
```

## Fetch Odds Snapshot

Get odds data for a specific fixture or time period.

```typescript theme={null}
const fixtureId = 17271370;

// Get odds for specific fixture
const fixtureOddsResponse = await httpClient.get(
  `/api/odds/snapshot/${fixtureId}`
);
const fixtureOdds = fixtureOddsResponse.data;

console.log(`Retrieved ${fixtureOdds.length} odds entries`);

// Get odds for time period
const epochDay = 20085;
const hourOfDay = 15;
const interval = 0;

const updatesResponse = await httpClient.get(
  `/api/odds/updates/${epochDay}/${hourOfDay}/${interval}`
);
const updates = updatesResponse.data;

console.log(`Retrieved ${updates.length} odds updates`);
```

## Fetch Scores Snapshot

Get scores data for a specific fixture or time period.

```typescript theme={null}
const fixtureId = 17271370;

// Get scores snapshot for fixture
const snapshotScoresResponse = await httpClient.get(
  `/api/scores/snapshot/${fixtureId}`
);
const snapshotScores = snapshotScoresResponse.data;

console.log(`Retrieved ${snapshotScores.length} snapshot scores entries`);

// Get live scores updates
const liveScoresResponse = await httpClient.get(
  `/api/scores/updates/${fixtureId}`
);
const liveScores = liveScoresResponse.data;

console.log(`Retrieved ${liveScores.length} live scores updates`);

// Get scores for time period
const epochDay = 20085;
const hourOfDay = 15;
const interval = 0;

const historicalUpdatesResponse = await httpClient.get(
  `/api/scores/updates/${epochDay}/${hourOfDay}/${interval}`
);
const historicalUpdates = historicalUpdatesResponse.data;

console.log(`Retrieved ${historicalUpdates.length} historical scores updates`);
```


> ## Documentation Index
> Fetch the complete documentation index at: https://txline-docs.txodds.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Streaming Data

> Real-time odds and scores updates via Server-Sent Events

<Info>
  **API Endpoints**: Use `https://txline.txodds.com/api/` for mainnet or `https://txline-dev.txodds.com/api/` for devnet
</Info>

<Info>
  **Prerequisites**: Complete [Quickstart activation](/documentation/quickstart) or [World Cup Free Tier activation](/documentation/worldcup) first. The snippets assume `jwt` is the guest JWT from `/auth/guest/start` and `apiToken` is the value returned by `/api/token/activate`.
</Info>

## SSE Parsing Helper

```typescript theme={null}
type SseMessage = {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
};

function parseSseBlock(block: string): SseMessage | null {
  const message: SseMessage = { data: "" };

  for (const rawLine of block.split(/\r?\n/)) {
    if (!rawLine || rawLine.startsWith(":")) continue;

    const separatorIndex = rawLine.indexOf(":");
    const field = separatorIndex === -1 ? rawLine : rawLine.slice(0, separatorIndex);
    const value =
      separatorIndex === -1
        ? ""
        : rawLine.slice(separatorIndex + 1).replace(/^ /, "");

    if (field === "data") message.data += `${value}\n`;
    if (field === "event") message.event = value;
    if (field === "id") message.id = value;
    if (field === "retry") message.retry = Number(value);
  }

  message.data = message.data.replace(/\n$/, "");
  return message.data || message.event || message.id ? message : null;
}

async function* readSseMessages(response: Response): AsyncGenerator<SseMessage> {
  if (!response.body) throw new Error("Stream response has no body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let separator = buffer.match(/\r?\n\r?\n/);
      while (separator?.index !== undefined) {
        const block = buffer.slice(0, separator.index);
        buffer = buffer.slice(separator.index + separator[0].length);

        const message = parseSseBlock(block);
        if (message) yield message;

        separator = buffer.match(/\r?\n\r?\n/);
      }
    }

    buffer += decoder.decode();
    const message = parseSseBlock(buffer);
    if (message) yield message;
  } finally {
    reader.releaseLock();
  }
}

function parseSseData(data: string) {
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}
```

## Stream Odds Updates

Connect to the odds stream for real-time updates.

```typescript theme={null}
const streamUrl = "https://txline.txodds.com/api/odds/stream";
const streamResponse = await fetch(streamUrl, {
  headers: {
    Authorization: `Bearer ${jwt}`,
    "X-Api-Token": apiToken,
    Accept: "text/event-stream",
    "Cache-Control": "no-cache",
  },
});

if (!streamResponse.ok) {
  throw new Error(`Stream failed: ${streamResponse.status}`);
}

for await (const message of readSseMessages(streamResponse)) {
  console.log(message.event ?? "message", parseSseData(message.data));
}
```

## Stream Scores Updates

Connect to the scores stream for real-time updates.

```typescript theme={null}
const streamUrl = "https://txline.txodds.com/api/scores/stream";
const streamResponse = await fetch(streamUrl, {
  headers: {
    Authorization: `Bearer ${jwt}`,
    "X-Api-Token": apiToken,
    Accept: "text/event-stream",
    "Cache-Control": "no-cache",
  },
});

if (!streamResponse.ok) {
  throw new Error(`Stream failed: ${streamResponse.status}`);
}

for await (const message of readSseMessages(streamResponse)) {
  console.log(message.event ?? "message", parseSseData(message.data));
}
```

## Historical Scores

Fetch the complete sequence of score updates for a fixture that started between two weeks and six hours ago.

```typescript theme={null}
import axios from "axios";

const httpClient = axios.create({
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${jwt}`,
    "X-Api-Token": apiToken
  },
  baseURL: "https://txline.txodds.com",
});

const fixtureId = 17952170;
const historicalScores = await httpClient.get(`/api/scores/historical/${fixtureId}`);

console.log(`Retrieved ${historicalScores.data.length} score updates for fixture ${fixtureId}`);
historicalScores.data.forEach((update, index) => {
  console.log(`${index + 1}. Seq: ${update.seq}, TS: ${update.ts}, State: ${update.gameState}`);
});
```

<Info>
  **Historical Availability**: This endpoint only returns data for fixtures with start times between two weeks and six hours in the past from the current time.
</Info>

<Info>
  **Stream Compression**: To reduce bandwidth usage by up to 70-80%, add `"Accept-Encoding": "gzip"` to your headers. You'll need to decompress the response chunks using `gunzipSync()` from Node's `zlib` module before decoding.
</Info>


> ## Documentation Index
> Fetch the complete documentation index at: https://txline-docs.txodds.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Start a new guest session

> Initiates a new, anonymous guest session and returns a JSON Web Token (JWT).
This token must be provided as a Bearer token in the Authorization header for subsequent calls,
such as the token activation endpoint. This JWT token expires after 30 days.




## OpenAPI

````yaml https://txline.txodds.com/docs/docs.yaml post /auth/guest/start
openapi: 3.1.0
info:
  title: TxLINE off-chain API for the Hybrid on-chain/off-chain TxODDS Data system
  version: 1.5.2
  description: >

    ## Overview


    This API provides access to real-time and historical sports data from the
    **TxLINE on-chain/off-chain Data system**.


    It makes proprietary TxODDS available for any funded blockchain users by
    linking the on-chain `subscribe` transaction by issuing time-limited API
    tokens.

    - The data is canonicalised so that all fixtures, odds, or scores are
    provably identifiable and ordered--confirmed by on-chain cryptographic
    proofs.

    - The data is delivered in a request-response or Server-Sent Events (SSE)
    streaming form.


    Examples of accessing the accompanying on-chain program are available
    publicly at: https://txline.txodds.com/documentation.

    All data returned by the off-chain API is canonicalised such that every
    single record can be cryptographically proven on-chain to be

    part of the unique and consistent dataset generated by the TxODDS Data
    system.


    ## Key features


    * The odds data includes the `Stable Price` demargined prices and
    percentages, currently for key markets in European football (soccer).

    * **Free subscription option that offers World Cup 2026 odds and
    off-the-board signals in real-time sampled every 60 seconds**.

    * **Data access paid for by the TxLINE token tethered to USDT ata rate 1
    USDT = 1_000 TxLINE tokens** The TxLINE utility token can purchased using
    the associated Solana program.

    * **Fine-grained service level selection** The user can list the
    pre-configured **service levels** that either map to pre-defined league
    bundles or allow custom selecting the leagues explicitly.
     The price also depends on the sampling period for the data.
    * **Maximum subscription option that offers all leagues in real-time**.

    * **Historical Snapshots:** Query the latest state of any market at a
    specific point in time.

    * **Historical Updates:** Query the updates for any given key such as
    fixture or market for a given time period.

    * **Live Data Streams:** Real-time, low-latency data feeds using Server-Sent
    Events (SSE).

    * **On-chain Validation:** Retrieve Merkle proofs to cryptographically
    verify data against the on-chain held Merkle roots by calling appropriate
    validate on-chain instructions.


    ## How do the users gain access to off-chain data (see more details and
    examples at: https://github.com/txodds/tx-on-chain)


    1. For paid service tiers, the user purchases TxODDS TxLINE utility tokens
    for USDT at a fixed rate using either a script (e.g., calling
    `purchase_subscription_token_usdt`) or an affiliate website. The tokens are
    deposited into the user's associated token account. (Note: This step is
    skipped for the free World Cup tier).

    2. As a guest, with no prior authentication, the user calls the off-chain
    API at "https://oracle.txodds.com/auth/guest/start" (or `oracle-dev` for
    DevNet) to obtain an anonymous JWT with Guest claims. **Please note that the
    JWT token has 30 days  expiration so if you are issuing calls to the data
    endpoints beyond 30 days, you should either pre-acquire a new JWT token in
    time before 30 days expire or respond to the returned HTTP 401 code by
    reacquiring a fresh JWT token.**

    3. The user creates, signs, and confirms a Solana transaction to the
    `subscribe` instruction, indicating the duration in weeks (must be a
    multiple of 4 weeks, e.g. 4, 8, 12) and the chosen service level. The user
    explicitly acts as the transaction fee payer. For the free tier, the smart
    contract registers the subscription but charges 0 TxLINE tokens.

    4. The user records the confirmed transaction signature (`txSig`).

    5. The user constructs a strict message binding consisting of the `txSig`, a
    comma-separated list of selected leagues, and the JWT.

    6. The user cryptographically signs this message using their wallet's secret
    key to generate a detached signature, which is then Base64-encoded.

    7. The user activates the subscription with the off-chain server at
    "https://oracle.txodds.com/api/token/activate" (or `oracle-dev` for DevNet)
    by posting the `txSig`, the Base64 wallet signature, and the selected
    leagues array, using the JWT for authorization.

    8. The off-chain server validates the cryptographic proof and entitlements,
    issuing an appropriate API Token or rejecting the activation with a reason.

    9. The user calls the documented APIs while the subscription is valid,
    supplying both the JWT and the API Token.

    10. Before the subscription expires, the user may call the `subscribe`
    instruction again to extend the validity period (by a multiple of 4 weeks,
    e.g. 4, 8, 12) via the same off-chain activation call. The selected leagues
    can also be amended.

    11. If the previous subscription has expired, the user can activate a new
    API Token by repeating the process.
servers:
  - url: https://txline.txodds.com
    description: Production TxLINE server
  - url: http://txline-dev.txodds.com
    description: Test TxLINE server
security: []
paths:
  /auth/guest/start:
    post:
      tags:
        - Authentication
      summary: Start a new guest session
      description: >
        Initiates a new, anonymous guest session and returns a JSON Web Token
        (JWT).

        This token must be provided as a Bearer token in the Authorization
        header for subsequent calls,

        such as the token activation endpoint. This JWT token expires after 30
        days.
      operationId: postAuthGuestStart
      responses:
        '200':
          description: A JWT for the guest session.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TokenResponse'
        '500':
          description: Returned if an unexpected error occurs during token issuance.
          content:
            text/plain:
              schema:
                type: string
components:
  schemas:
    TokenResponse:
      title: TokenResponse
      type: object
      required:
        - token
      properties:
        token:
          type: string

````

> ## Documentation Index
> Fetch the complete documentation index at: https://txline-docs.txodds.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Activate subscription and retrieve API token

> Activate a user subscription and issue a long-lived API token.
Supports three modes based on the on-chain transaction:
1. Legacy subscriptions (pass empty leagues array).
2. Standard matrix subscriptions (pass empty leagues array).
3. Custom matrix subscriptions (pass requested league IDs up to the purchased limit).
The entire request intent must be cryptographically signed by the user's wallet.




## OpenAPI

````yaml https://txline.txodds.com/docs/docs.yaml post /api/token/activate
openapi: 3.1.0
info:
  title: TxLINE off-chain API for the Hybrid on-chain/off-chain TxODDS Data system
  version: 1.5.2
  description: >

    ## Overview


    This API provides access to real-time and historical sports data from the
    **TxLINE on-chain/off-chain Data system**.


    It makes proprietary TxODDS available for any funded blockchain users by
    linking the on-chain `subscribe` transaction by issuing time-limited API
    tokens.

    - The data is canonicalised so that all fixtures, odds, or scores are
    provably identifiable and ordered--confirmed by on-chain cryptographic
    proofs.

    - The data is delivered in a request-response or Server-Sent Events (SSE)
    streaming form.


    Examples of accessing the accompanying on-chain program are available
    publicly at: https://txline.txodds.com/documentation.

    All data returned by the off-chain API is canonicalised such that every
    single record can be cryptographically proven on-chain to be

    part of the unique and consistent dataset generated by the TxODDS Data
    system.


    ## Key features


    * The odds data includes the `Stable Price` demargined prices and
    percentages, currently for key markets in European football (soccer).

    * **Free subscription option that offers World Cup 2026 odds and
    off-the-board signals in real-time sampled every 60 seconds**.

    * **Data access paid for by the TxLINE token tethered to USDT ata rate 1
    USDT = 1_000 TxLINE tokens** The TxLINE utility token can purchased using
    the associated Solana program.

    * **Fine-grained service level selection** The user can list the
    pre-configured **service levels** that either map to pre-defined league
    bundles or allow custom selecting the leagues explicitly.
     The price also depends on the sampling period for the data.
    * **Maximum subscription option that offers all leagues in real-time**.

    * **Historical Snapshots:** Query the latest state of any market at a
    specific point in time.

    * **Historical Updates:** Query the updates for any given key such as
    fixture or market for a given time period.

    * **Live Data Streams:** Real-time, low-latency data feeds using Server-Sent
    Events (SSE).

    * **On-chain Validation:** Retrieve Merkle proofs to cryptographically
    verify data against the on-chain held Merkle roots by calling appropriate
    validate on-chain instructions.


    ## How do the users gain access to off-chain data (see more details and
    examples at: https://github.com/txodds/tx-on-chain)


    1. For paid service tiers, the user purchases TxODDS TxLINE utility tokens
    for USDT at a fixed rate using either a script (e.g., calling
    `purchase_subscription_token_usdt`) or an affiliate website. The tokens are
    deposited into the user's associated token account. (Note: This step is
    skipped for the free World Cup tier).

    2. As a guest, with no prior authentication, the user calls the off-chain
    API at "https://oracle.txodds.com/auth/guest/start" (or `oracle-dev` for
    DevNet) to obtain an anonymous JWT with Guest claims. **Please note that the
    JWT token has 30 days  expiration so if you are issuing calls to the data
    endpoints beyond 30 days, you should either pre-acquire a new JWT token in
    time before 30 days expire or respond to the returned HTTP 401 code by
    reacquiring a fresh JWT token.**

    3. The user creates, signs, and confirms a Solana transaction to the
    `subscribe` instruction, indicating the duration in weeks (must be a
    multiple of 4 weeks, e.g. 4, 8, 12) and the chosen service level. The user
    explicitly acts as the transaction fee payer. For the free tier, the smart
    contract registers the subscription but charges 0 TxLINE tokens.

    4. The user records the confirmed transaction signature (`txSig`).

    5. The user constructs a strict message binding consisting of the `txSig`, a
    comma-separated list of selected leagues, and the JWT.

    6. The user cryptographically signs this message using their wallet's secret
    key to generate a detached signature, which is then Base64-encoded.

    7. The user activates the subscription with the off-chain server at
    "https://oracle.txodds.com/api/token/activate" (or `oracle-dev` for DevNet)
    by posting the `txSig`, the Base64 wallet signature, and the selected
    leagues array, using the JWT for authorization.

    8. The off-chain server validates the cryptographic proof and entitlements,
    issuing an appropriate API Token or rejecting the activation with a reason.

    9. The user calls the documented APIs while the subscription is valid,
    supplying both the JWT and the API Token.

    10. Before the subscription expires, the user may call the `subscribe`
    instruction again to extend the validity period (by a multiple of 4 weeks,
    e.g. 4, 8, 12) via the same off-chain activation call. The selected leagues
    can also be amended.

    11. If the previous subscription has expired, the user can activate a new
    API Token by repeating the process.
servers:
  - url: https://txline.txodds.com
    description: Production TxLINE server
  - url: http://txline-dev.txodds.com
    description: Test TxLINE server
security: []
paths:
  /api/token/activate:
    post:
      tags:
        - Authentication
      summary: Activate subscription and retrieve API token
      description: >
        Activate a user subscription and issue a long-lived API token.

        Supports three modes based on the on-chain transaction:

        1. Legacy subscriptions (pass empty leagues array).

        2. Standard matrix subscriptions (pass empty leagues array).

        3. Custom matrix subscriptions (pass requested league IDs up to the
        purchased limit).

        The entire request intent must be cryptographically signed by the user's
        wallet.
      operationId: postApiTokenActivate
      parameters:
        - name: Authorization
          in: header
          description: Bearer token for the user session JWT.
          required: true
          schema:
            type: string
      requestBody:
        description: >-
          The cryptographic payload containing the transaction signature, wallet
          signature, and requested leagues.
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ActivationPayload'
            example:
              txSig: >-
                5kb6gnsSu1inDF9nCVV3WcgKryyBFGFkrYS28Sp1avS8mq6Xcw6iq3yzkBTjmq8bGptgqYTXPmjyWECzKzUxYG3C
              walletSignature: 2BvM...
              leagues:
                - 501
                - 804
                - 202
        required: true
      responses:
        '200':
          description: The newly generated API token.
          content:
            text/plain:
              schema:
                type: string
              example: txoracle_api_123abc456def
        '400':
          description: 'Invalid value for: header Authorization, Invalid value for: body'
          content:
            text/plain:
              schema:
                type: string
        '401':
          description: 'Authorization failed: Invalid or expired guest JWT.'
          content:
            text/plain:
              schema:
                type: string
        '403':
          description: ''
          content:
            text/plain:
              schema:
                type: string
        '500':
          description: ''
          content:
            text/plain:
              schema:
                type: string
      security:
        - httpAuth: []
components:
  schemas:
    ActivationPayload:
      title: ActivationPayload
      type: object
      required:
        - txSig
        - walletSignature
      properties:
        txSig:
          type: string
        walletSignature:
          type: string
        leagues:
          type: array
          items:
            type: integer
            format: int32
  securitySchemes:
    httpAuth:
      type: http
      description: User's session JWT.
      scheme: bearer

````

> ## Documentation Index
> Fetch the complete documentation index at: https://txline-docs.txodds.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Get the latest snapshot of fixtures, optionally starting at or within 30 days after a given epoch day



## OpenAPI

````yaml https://txline.txodds.com/docs/docs.yaml get /api/fixtures/snapshot
openapi: 3.1.0
info:
  title: TxLINE off-chain API for the Hybrid on-chain/off-chain TxODDS Data system
  version: 1.5.2
  description: >

    ## Overview


    This API provides access to real-time and historical sports data from the
    **TxLINE on-chain/off-chain Data system**.


    It makes proprietary TxODDS available for any funded blockchain users by
    linking the on-chain `subscribe` transaction by issuing time-limited API
    tokens.

    - The data is canonicalised so that all fixtures, odds, or scores are
    provably identifiable and ordered--confirmed by on-chain cryptographic
    proofs.

    - The data is delivered in a request-response or Server-Sent Events (SSE)
    streaming form.


    Examples of accessing the accompanying on-chain program are available
    publicly at: https://txline.txodds.com/documentation.

    All data returned by the off-chain API is canonicalised such that every
    single record can be cryptographically proven on-chain to be

    part of the unique and consistent dataset generated by the TxODDS Data
    system.


    ## Key features


    * The odds data includes the `Stable Price` demargined prices and
    percentages, currently for key markets in European football (soccer).

    * **Free subscription option that offers World Cup 2026 odds and
    off-the-board signals in real-time sampled every 60 seconds**.

    * **Data access paid for by the TxLINE token tethered to USDT ata rate 1
    USDT = 1_000 TxLINE tokens** The TxLINE utility token can purchased using
    the associated Solana program.

    * **Fine-grained service level selection** The user can list the
    pre-configured **service levels** that either map to pre-defined league
    bundles or allow custom selecting the leagues explicitly.
     The price also depends on the sampling period for the data.
    * **Maximum subscription option that offers all leagues in real-time**.

    * **Historical Snapshots:** Query the latest state of any market at a
    specific point in time.

    * **Historical Updates:** Query the updates for any given key such as
    fixture or market for a given time period.

    * **Live Data Streams:** Real-time, low-latency data feeds using Server-Sent
    Events (SSE).

    * **On-chain Validation:** Retrieve Merkle proofs to cryptographically
    verify data against the on-chain held Merkle roots by calling appropriate
    validate on-chain instructions.


    ## How do the users gain access to off-chain data (see more details and
    examples at: https://github.com/txodds/tx-on-chain)


    1. For paid service tiers, the user purchases TxODDS TxLINE utility tokens
    for USDT at a fixed rate using either a script (e.g., calling
    `purchase_subscription_token_usdt`) or an affiliate website. The tokens are
    deposited into the user's associated token account. (Note: This step is
    skipped for the free World Cup tier).

    2. As a guest, with no prior authentication, the user calls the off-chain
    API at "https://oracle.txodds.com/auth/guest/start" (or `oracle-dev` for
    DevNet) to obtain an anonymous JWT with Guest claims. **Please note that the
    JWT token has 30 days  expiration so if you are issuing calls to the data
    endpoints beyond 30 days, you should either pre-acquire a new JWT token in
    time before 30 days expire or respond to the returned HTTP 401 code by
    reacquiring a fresh JWT token.**

    3. The user creates, signs, and confirms a Solana transaction to the
    `subscribe` instruction, indicating the duration in weeks (must be a
    multiple of 4 weeks, e.g. 4, 8, 12) and the chosen service level. The user
    explicitly acts as the transaction fee payer. For the free tier, the smart
    contract registers the subscription but charges 0 TxLINE tokens.

    4. The user records the confirmed transaction signature (`txSig`).

    5. The user constructs a strict message binding consisting of the `txSig`, a
    comma-separated list of selected leagues, and the JWT.

    6. The user cryptographically signs this message using their wallet's secret
    key to generate a detached signature, which is then Base64-encoded.

    7. The user activates the subscription with the off-chain server at
    "https://oracle.txodds.com/api/token/activate" (or `oracle-dev` for DevNet)
    by posting the `txSig`, the Base64 wallet signature, and the selected
    leagues array, using the JWT for authorization.

    8. The off-chain server validates the cryptographic proof and entitlements,
    issuing an appropriate API Token or rejecting the activation with a reason.

    9. The user calls the documented APIs while the subscription is valid,
    supplying both the JWT and the API Token.

    10. Before the subscription expires, the user may call the `subscribe`
    instruction again to extend the validity period (by a multiple of 4 weeks,
    e.g. 4, 8, 12) via the same off-chain activation call. The selected leagues
    can also be amended.

    11. If the previous subscription has expired, the user can activate a new
    API Token by repeating the process.
servers:
  - url: https://txline.txodds.com
    description: Production TxLINE server
  - url: http://txline-dev.txodds.com
    description: Test TxLINE server
security: []
paths:
  /api/fixtures/snapshot:
    get:
      tags:
        - Fixtures
      summary: >-
        Get the latest snapshot of fixtures, optionally starting at or within 30
        days after a given epoch day
      operationId: getApiFixturesSnapshot
      parameters:
        - name: Authorization
          in: header
          description: Bearer token for the user's session JWT.
          required: true
          schema:
            type: string
        - name: X-Api-Token
          in: header
          description: The user's long-lived API token.
          required: true
          schema:
            type: string
        - name: startEpochDay
          in: query
          description: >-
            Optional. The day at or within 30 days after which the fixtures
            start. Defaults to the current day in UTC.
          required: false
          schema:
            type: integer
        - name: competitionId
          in: query
          description: Optional. Filter by a specific competition ID.
          required: false
          schema:
            type: integer
            format: int32
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Fixture'
        '400':
          description: >-
            Invalid value for: header Authorization, Invalid value for: header
            X-Api-Token, Invalid value for: query parameter startEpochDay,
            Invalid value for: query parameter competitionId
          content:
            text/plain:
              schema:
                type: string
        '401':
          description: 'Authorization failed: Invalid or expired guest JWT'
          content:
            text/plain:
              schema:
                type: string
        '403':
          description: 'Access denied: Invalid API token or insufficient permissions'
          content:
            text/plain:
              schema:
                type: string
        '500':
          description: Internal server error
          content:
            text/plain:
              schema:
                type: string
      security:
        - httpAuth: []
          apiKeyAuth: []
components:
  schemas:
    Fixture:
      title: Fixture
      type: object
      required:
        - Ts
        - StartTime
        - Competition
        - CompetitionId
        - FixtureGroupId
        - Participant1Id
        - Participant1
        - Participant2Id
        - Participant2
        - FixtureId
        - Participant1IsHome
      properties:
        Ts:
          type: integer
          format: int64
        StartTime:
          type: integer
          format: int64
        Competition:
          type: string
        CompetitionId:
          type: integer
          format: int32
        FixtureGroupId:
          type: integer
          format: int32
        Participant1Id:
          type: integer
          format: int32
        Participant1:
          type: string
        Participant2Id:
          type: integer
          format: int32
        Participant2:
          type: string
        FixtureId:
          type: integer
          format: int64
        Participant1IsHome:
          type: boolean
  securitySchemes:
    httpAuth:
      type: http
      description: User's session JWT.
      scheme: bearer
    apiKeyAuth:
      type: apiKey
      description: The user's long-lived API token, obtained from the activation endpoint.
      name: X-Api-Token
      in: header

````

> ## Documentation Index
> Fetch the complete documentation index at: https://txline-docs.txodds.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Get all fixture updates for a single fixture on a given day



## OpenAPI

````yaml https://txline.txodds.com/docs/docs.yaml get /api/fixtures/updates/{epochDay}/{hourOfDay}
openapi: 3.1.0
info:
  title: TxLINE off-chain API for the Hybrid on-chain/off-chain TxODDS Data system
  version: 1.5.2
  description: >

    ## Overview


    This API provides access to real-time and historical sports data from the
    **TxLINE on-chain/off-chain Data system**.


    It makes proprietary TxODDS available for any funded blockchain users by
    linking the on-chain `subscribe` transaction by issuing time-limited API
    tokens.

    - The data is canonicalised so that all fixtures, odds, or scores are
    provably identifiable and ordered--confirmed by on-chain cryptographic
    proofs.

    - The data is delivered in a request-response or Server-Sent Events (SSE)
    streaming form.


    Examples of accessing the accompanying on-chain program are available
    publicly at: https://txline.txodds.com/documentation.

    All data returned by the off-chain API is canonicalised such that every
    single record can be cryptographically proven on-chain to be

    part of the unique and consistent dataset generated by the TxODDS Data
    system.


    ## Key features


    * The odds data includes the `Stable Price` demargined prices and
    percentages, currently for key markets in European football (soccer).

    * **Free subscription option that offers World Cup 2026 odds and
    off-the-board signals in real-time sampled every 60 seconds**.

    * **Data access paid for by the TxLINE token tethered to USDT ata rate 1
    USDT = 1_000 TxLINE tokens** The TxLINE utility token can purchased using
    the associated Solana program.

    * **Fine-grained service level selection** The user can list the
    pre-configured **service levels** that either map to pre-defined league
    bundles or allow custom selecting the leagues explicitly.
     The price also depends on the sampling period for the data.
    * **Maximum subscription option that offers all leagues in real-time**.

    * **Historical Snapshots:** Query the latest state of any market at a
    specific point in time.

    * **Historical Updates:** Query the updates for any given key such as
    fixture or market for a given time period.

    * **Live Data Streams:** Real-time, low-latency data feeds using Server-Sent
    Events (SSE).

    * **On-chain Validation:** Retrieve Merkle proofs to cryptographically
    verify data against the on-chain held Merkle roots by calling appropriate
    validate on-chain instructions.


    ## How do the users gain access to off-chain data (see more details and
    examples at: https://github.com/txodds/tx-on-chain)


    1. For paid service tiers, the user purchases TxODDS TxLINE utility tokens
    for USDT at a fixed rate using either a script (e.g., calling
    `purchase_subscription_token_usdt`) or an affiliate website. The tokens are
    deposited into the user's associated token account. (Note: This step is
    skipped for the free World Cup tier).

    2. As a guest, with no prior authentication, the user calls the off-chain
    API at "https://oracle.txodds.com/auth/guest/start" (or `oracle-dev` for
    DevNet) to obtain an anonymous JWT with Guest claims. **Please note that the
    JWT token has 30 days  expiration so if you are issuing calls to the data
    endpoints beyond 30 days, you should either pre-acquire a new JWT token in
    time before 30 days expire or respond to the returned HTTP 401 code by
    reacquiring a fresh JWT token.**

    3. The user creates, signs, and confirms a Solana transaction to the
    `subscribe` instruction, indicating the duration in weeks (must be a
    multiple of 4 weeks, e.g. 4, 8, 12) and the chosen service level. The user
    explicitly acts as the transaction fee payer. For the free tier, the smart
    contract registers the subscription but charges 0 TxLINE tokens.

    4. The user records the confirmed transaction signature (`txSig`).

    5. The user constructs a strict message binding consisting of the `txSig`, a
    comma-separated list of selected leagues, and the JWT.

    6. The user cryptographically signs this message using their wallet's secret
    key to generate a detached signature, which is then Base64-encoded.

    7. The user activates the subscription with the off-chain server at
    "https://oracle.txodds.com/api/token/activate" (or `oracle-dev` for DevNet)
    by posting the `txSig`, the Base64 wallet signature, and the selected
    leagues array, using the JWT for authorization.

    8. The off-chain server validates the cryptographic proof and entitlements,
    issuing an appropriate API Token or rejecting the activation with a reason.

    9. The user calls the documented APIs while the subscription is valid,
    supplying both the JWT and the API Token.

    10. Before the subscription expires, the user may call the `subscribe`
    instruction again to extend the validity period (by a multiple of 4 weeks,
    e.g. 4, 8, 12) via the same off-chain activation call. The selected leagues
    can also be amended.

    11. If the previous subscription has expired, the user can activate a new
    API Token by repeating the process.
servers:
  - url: https://txline.txodds.com
    description: Production TxLINE server
  - url: http://txline-dev.txodds.com
    description: Test TxLINE server
security: []
paths:
  /api/fixtures/updates/{epochDay}/{hourOfDay}:
    get:
      tags:
        - Fixtures
      summary: Get all fixture updates for a single fixture on a given day
      operationId: getApiFixturesUpdatesEpochdayHourofday
      parameters:
        - name: Authorization
          in: header
          description: Bearer token for the user's session JWT.
          required: true
          schema:
            type: string
        - name: X-Api-Token
          in: header
          description: The user's long-lived API token.
          required: true
          schema:
            type: string
        - name: epochDay
          in: path
          description: The day since the Unix epoch
          required: true
          schema:
            type: integer
        - name: hourOfDay
          in: path
          description: The hour of the day (0-23)
          required: true
          schema:
            type: integer
      responses:
        '200':
          description: >-
            A list of fixture updates. If no updates are found for the given
            parameters, an empty list is returned.
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Fixture'
        '400':
          description: >-
            Invalid value for: header Authorization, Invalid value for: header
            X-Api-Token, Invalid value for: path parameter epochDay, Invalid
            value for: path parameter hourOfDay
          content:
            text/plain:
              schema:
                type: string
        '401':
          description: 'Authorization failed: Invalid or expired guest JWT'
          content:
            text/plain:
              schema:
                type: string
        '403':
          description: 'Access denied: Invalid API token or insufficient permissions'
          content:
            text/plain:
              schema:
                type: string
        '500':
          description: Internal server error
          content:
            text/plain:
              schema:
                type: string
      security:
        - httpAuth: []
          apiKeyAuth: []
components:
  schemas:
    Fixture:
      title: Fixture
      type: object
      required:
        - Ts
        - StartTime
        - Competition
        - CompetitionId
        - FixtureGroupId
        - Participant1Id
        - Participant1
        - Participant2Id
        - Participant2
        - FixtureId
        - Participant1IsHome
      properties:
        Ts:
          type: integer
          format: int64
        StartTime:
          type: integer
          format: int64
        Competition:
          type: string
        CompetitionId:
          type: integer
          format: int32
        FixtureGroupId:
          type: integer
          format: int32
        Participant1Id:
          type: integer
          format: int32
        Participant1:
          type: string
        Participant2Id:
          type: integer
          format: int32
        Participant2:
          type: string
        FixtureId:
          type: integer
          format: int64
        Participant1IsHome:
          type: boolean
  securitySchemes:
    httpAuth:
      type: http
      description: User's session JWT.
      scheme: bearer
    apiKeyAuth:
      type: apiKey
      description: The user's long-lived API token, obtained from the activation endpoint.
      name: X-Api-Token
      in: header

````

> ## Documentation Index
> Fetch the complete documentation index at: https://txline-docs.txodds.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Get snapshots for each action in the latest score events for a fixture



## OpenAPI

````yaml https://txline.txodds.com/docs/docs.yaml get /api/scores/snapshot/{fixtureId}
openapi: 3.1.0
info:
  title: TxLINE off-chain API for the Hybrid on-chain/off-chain TxODDS Data system
  version: 1.5.2
  description: >

    ## Overview


    This API provides access to real-time and historical sports data from the
    **TxLINE on-chain/off-chain Data system**.


    It makes proprietary TxODDS available for any funded blockchain users by
    linking the on-chain `subscribe` transaction by issuing time-limited API
    tokens.

    - The data is canonicalised so that all fixtures, odds, or scores are
    provably identifiable and ordered--confirmed by on-chain cryptographic
    proofs.

    - The data is delivered in a request-response or Server-Sent Events (SSE)
    streaming form.


    Examples of accessing the accompanying on-chain program are available
    publicly at: https://txline.txodds.com/documentation.

    All data returned by the off-chain API is canonicalised such that every
    single record can be cryptographically proven on-chain to be

    part of the unique and consistent dataset generated by the TxODDS Data
    system.


    ## Key features


    * The odds data includes the `Stable Price` demargined prices and
    percentages, currently for key markets in European football (soccer).

    * **Free subscription option that offers World Cup 2026 odds and
    off-the-board signals in real-time sampled every 60 seconds**.

    * **Data access paid for by the TxLINE token tethered to USDT ata rate 1
    USDT = 1_000 TxLINE tokens** The TxLINE utility token can purchased using
    the associated Solana program.

    * **Fine-grained service level selection** The user can list the
    pre-configured **service levels** that either map to pre-defined league
    bundles or allow custom selecting the leagues explicitly.
     The price also depends on the sampling period for the data.
    * **Maximum subscription option that offers all leagues in real-time**.

    * **Historical Snapshots:** Query the latest state of any market at a
    specific point in time.

    * **Historical Updates:** Query the updates for any given key such as
    fixture or market for a given time period.

    * **Live Data Streams:** Real-time, low-latency data feeds using Server-Sent
    Events (SSE).

    * **On-chain Validation:** Retrieve Merkle proofs to cryptographically
    verify data against the on-chain held Merkle roots by calling appropriate
    validate on-chain instructions.


    ## How do the users gain access to off-chain data (see more details and
    examples at: https://github.com/txodds/tx-on-chain)


    1. For paid service tiers, the user purchases TxODDS TxLINE utility tokens
    for USDT at a fixed rate using either a script (e.g., calling
    `purchase_subscription_token_usdt`) or an affiliate website. The tokens are
    deposited into the user's associated token account. (Note: This step is
    skipped for the free World Cup tier).

    2. As a guest, with no prior authentication, the user calls the off-chain
    API at "https://oracle.txodds.com/auth/guest/start" (or `oracle-dev` for
    DevNet) to obtain an anonymous JWT with Guest claims. **Please note that the
    JWT token has 30 days  expiration so if you are issuing calls to the data
    endpoints beyond 30 days, you should either pre-acquire a new JWT token in
    time before 30 days expire or respond to the returned HTTP 401 code by
    reacquiring a fresh JWT token.**

    3. The user creates, signs, and confirms a Solana transaction to the
    `subscribe` instruction, indicating the duration in weeks (must be a
    multiple of 4 weeks, e.g. 4, 8, 12) and the chosen service level. The user
    explicitly acts as the transaction fee payer. For the free tier, the smart
    contract registers the subscription but charges 0 TxLINE tokens.

    4. The user records the confirmed transaction signature (`txSig`).

    5. The user constructs a strict message binding consisting of the `txSig`, a
    comma-separated list of selected leagues, and the JWT.

    6. The user cryptographically signs this message using their wallet's secret
    key to generate a detached signature, which is then Base64-encoded.

    7. The user activates the subscription with the off-chain server at
    "https://oracle.txodds.com/api/token/activate" (or `oracle-dev` for DevNet)
    by posting the `txSig`, the Base64 wallet signature, and the selected
    leagues array, using the JWT for authorization.

    8. The off-chain server validates the cryptographic proof and entitlements,
    issuing an appropriate API Token or rejecting the activation with a reason.

    9. The user calls the documented APIs while the subscription is valid,
    supplying both the JWT and the API Token.

    10. Before the subscription expires, the user may call the `subscribe`
    instruction again to extend the validity period (by a multiple of 4 weeks,
    e.g. 4, 8, 12) via the same off-chain activation call. The selected leagues
    can also be amended.

    11. If the previous subscription has expired, the user can activate a new
    API Token by repeating the process.
servers:
  - url: https://txline.txodds.com
    description: Production TxLINE server
  - url: http://txline-dev.txodds.com
    description: Test TxLINE server
security: []
paths:
  /api/scores/snapshot/{fixtureId}:
    get:
      tags:
        - Scores
      summary: Get snapshots for each action in the latest score events for a fixture
      operationId: getApiScoresSnapshotFixtureid
      parameters:
        - name: Authorization
          in: header
          description: Bearer token for the user's session JWT.
          required: true
          schema:
            type: string
        - name: X-Api-Token
          in: header
          description: The user's long-lived API token.
          required: true
          schema:
            type: string
        - name: fixtureId
          in: path
          description: The ID of the fixture
          required: true
          schema:
            type: integer
            format: int64
        - name: asOf
          in: query
          description: >-
            Optional Unix timestamp (ms) for the latest time the historical
            snapshots are returned for. If omitted, returns the live snapshot.
          required: false
          schema:
            type: integer
            format: int64
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Scores'
        '400':
          description: >-
            Invalid value for: header Authorization, Invalid value for: header
            X-Api-Token, Invalid value for: path parameter fixtureId, Invalid
            value for: query parameter asOf
          content:
            text/plain:
              schema:
                type: string
        '401':
          description: 'Authorization failed: Invalid or expired guest JWT'
          content:
            text/plain:
              schema:
                type: string
        '403':
          description: 'Access denied: Invalid API token or insufficient permissions'
          content:
            text/plain:
              schema:
                type: string
        '500':
          description: Internal server error
          content:
            text/plain:
              schema:
                type: string
      security:
        - httpAuth: []
          apiKeyAuth: []
components:
  schemas:
    Scores:
      title: Scores
      type: object
      required:
        - fixtureId
        - gameState
        - startTime
        - isTeam
        - fixtureGroupId
        - competitionId
        - countryId
        - sportId
        - participant1IsHome
        - participant2Id
        - participant1Id
        - action
        - id
        - ts
        - connectionId
        - seq
      properties:
        fixtureId:
          type: integer
          format: int32
        gameState:
          type: string
        startTime:
          type: integer
          format: int64
        isTeam:
          type: boolean
        fixtureGroupId:
          type: integer
          format: int32
        competitionId:
          type: integer
          format: int32
        countryId:
          type: integer
          format: int32
        sportId:
          type: integer
          format: int32
        participant1IsHome:
          type: boolean
        participant2Id:
          type: integer
          format: int32
        participant1Id:
          type: integer
          format: int32
        coverageSecondaryData:
          type: boolean
        coverageType:
          type: string
        action:
          type: string
        id:
          type: integer
          format: int32
        ts:
          type: integer
          format: int64
        connectionId:
          type: integer
          format: int64
        seq:
          type: integer
          format: int32
        statusId:
          $ref: '#/components/schemas/UsFootballFixtureStatus'
        statusBasketballId:
          $ref: '#/components/schemas/BasketballFixtureStatus'
        statusSoccerId:
          $ref: '#/components/schemas/SoccerFixtureStatus'
        type:
          $ref: '#/components/schemas/FixtureType'
        confirmed:
          type: boolean
        clock:
          $ref: '#/components/schemas/UsFootballFixtureClock'
        down:
          $ref: '#/components/schemas/UsFootballFixtureDown'
        inPlayInfo:
          $ref: '#/components/schemas/InPlayInfo'
        kickoffInfo:
          $ref: '#/components/schemas/KickoffInfo'
        score:
          $ref: '#/components/schemas/UsFootballFixtureScore'
        data:
          $ref: '#/components/schemas/UsFootballData'
        scoreBasketball:
          $ref: '#/components/schemas/BasketballFixtureScore'
        dataBasketball:
          $ref: '#/components/schemas/BasketballData'
        scoreSoccer:
          $ref: '#/components/schemas/SoccerFixtureScore'
        dataSoccer:
          $ref: '#/components/schemas/SoccerData'
        stats:
          $ref: '#/components/schemas/Map_ScoreStatKey'
        participant:
          type: integer
          format: int32
        kickoff:
          $ref: '#/components/schemas/KickoffDetails'
        lineups:
          type: array
          items:
            $ref: '#/components/schemas/LineupData'
        possession:
          type: integer
          format: int32
        possessionType:
          $ref: '#/components/schemas/SoccerPossessionType'
        parti1StateSoccer:
          $ref: '#/components/schemas/SoccerPartiState'
        parti1StateUsFootball:
          $ref: '#/components/schemas/UsFootballPartiState'
        parti1StateBasketball:
          $ref: '#/components/schemas/BasketballPartiState'
        parti2StateSoccer:
          $ref: '#/components/schemas/SoccerPartiState'
        parti2StateUsFootball:
          $ref: '#/components/schemas/UsFootballPartiState'
        parti2StateBasketball:
          $ref: '#/components/schemas/BasketballPartiState'
        possibleEventSoccer:
          $ref: '#/components/schemas/SoccerPossibleNeutralEvent'
        possibleEventUsFootball:
          $ref: '#/components/schemas/UsFootballPossibleEvent'
    UsFootballFixtureStatus:
      title: UsFootballFixtureStatus
      oneOf:
        - $ref: '#/components/schemas/A'
        - $ref: '#/components/schemas/C'
        - $ref: '#/components/schemas/F'
        - $ref: '#/components/schemas/FO'
        - $ref: '#/components/schemas/HT'
        - $ref: '#/components/schemas/I'
        - $ref: '#/components/schemas/NS'
        - $ref: '#/components/schemas/OB'
        - $ref: '#/components/schemas/OB1'
        - $ref: '#/components/schemas/OB10'
        - $ref: '#/components/schemas/OB11'
        - $ref: '#/components/schemas/OB2'
        - $ref: '#/components/schemas/OB3'
        - $ref: '#/components/schemas/OB4'
        - $ref: '#/components/schemas/OB5'
        - $ref: '#/components/schemas/OB6'
        - $ref: '#/components/schemas/OB7'
        - $ref: '#/components/schemas/OB8'
        - $ref: '#/components/schemas/OB9'
        - $ref: '#/components/schemas/OT'
        - $ref: '#/components/schemas/OT1'
        - $ref: '#/components/schemas/OT10'
        - $ref: '#/components/schemas/OT11'
        - $ref: '#/components/schemas/OT12'
        - $ref: '#/components/schemas/OT2'
        - $ref: '#/components/schemas/OT3'
        - $ref: '#/components/schemas/OT4'
        - $ref: '#/components/schemas/OT5'
        - $ref: '#/components/schemas/OT6'
        - $ref: '#/components/schemas/OT7'
        - $ref: '#/components/schemas/OT8'
        - $ref: '#/components/schemas/OT9'
        - $ref: '#/components/schemas/Q1'
        - $ref: '#/components/schemas/Q1B'
        - $ref: '#/components/schemas/Q2'
        - $ref: '#/components/schemas/Q3'
        - $ref: '#/components/schemas/Q3B'
        - $ref: '#/components/schemas/Q4'
        - $ref: '#/components/schemas/TXCC'
        - $ref: '#/components/schemas/TXCS'
        - $ref: '#/components/schemas/WO'
    BasketballFixtureStatus:
      title: BasketballFixtureStatus
      oneOf:
        - $ref: '#/components/schemas/A1'
        - $ref: '#/components/schemas/C1'
        - $ref: '#/components/schemas/F1'
        - $ref: '#/components/schemas/FO1'
        - $ref: '#/components/schemas/H1'
        - $ref: '#/components/schemas/H2'
        - $ref: '#/components/schemas/HT1'
        - $ref: '#/components/schemas/I1'
        - $ref: '#/components/schemas/NS1'
        - $ref: '#/components/schemas/OB12'
        - $ref: '#/components/schemas/OT13'
        - $ref: '#/components/schemas/Q11'
        - $ref: '#/components/schemas/Q1B1'
        - $ref: '#/components/schemas/Q21'
        - $ref: '#/components/schemas/Q31'
        - $ref: '#/components/schemas/Q3B1'
        - $ref: '#/components/schemas/Q41'
        - $ref: '#/components/schemas/TXCC1'
        - $ref: '#/components/schemas/TXCS1'
        - $ref: '#/components/schemas/WO1'
    SoccerFixtureStatus:
      title: SoccerFixtureStatus
      oneOf:
        - $ref: '#/components/schemas/A2'
        - $ref: '#/components/schemas/C2'
        - $ref: '#/components/schemas/ET1'
        - $ref: '#/components/schemas/ET2'
        - $ref: '#/components/schemas/F2'
        - $ref: '#/components/schemas/FET'
        - $ref: '#/components/schemas/FPE'
        - $ref: '#/components/schemas/H11'
        - $ref: '#/components/schemas/H21'
        - $ref: '#/components/schemas/HT2'
        - $ref: '#/components/schemas/HTET'
        - $ref: '#/components/schemas/I2'
        - $ref: '#/components/schemas/NS2'
        - $ref: '#/components/schemas/P'
        - $ref: '#/components/schemas/PE'
        - $ref: '#/components/schemas/TXCC2'
        - $ref: '#/components/schemas/TXCS2'
        - $ref: '#/components/schemas/WET'
        - $ref: '#/components/schemas/WPE'
    FixtureType:
      title: FixtureType
      oneOf:
        - $ref: '#/components/schemas/Basketball'
        - $ref: '#/components/schemas/Soccer'
        - $ref: '#/components/schemas/UsFootball'
    UsFootballFixtureClock:
      title: UsFootballFixtureClock
      type: object
      required:
        - running
        - seconds
      properties:
        running:
          type: boolean
        seconds:
          type: integer
          format: int32
    UsFootballFixtureDown:
      title: UsFootballFixtureDown
      type: object
      required:
        - number
        - yardsToGo
        - scrimmageLine
        - possession
        - side
      properties:
        number:
          type: integer
          format: int32
        yardsToGo:
          type: integer
          format: int32
        scrimmageLine:
          type: integer
          format: int32
        possession:
          $ref: '#/components/schemas/Participant'
        side:
          $ref: '#/components/schemas/Side'
    InPlayInfo:
      title: InPlayInfo
      type: object
      required:
        - BallSnapped
        - PlayersLiningUp
        - TimeoutParti1
        - TimeoutParti2
        - TVTimeout
      properties:
        BallSnapped:
          type: boolean
        PlayersLiningUp:
          type: boolean
        TimeoutParti1:
          type: boolean
        TimeoutParti2:
          type: boolean
        TVTimeout:
          type: boolean
        Outcome:
          $ref: '#/components/schemas/InPlayOutcome'
        NewSetOfDowns:
          type: boolean
        PenaltyIncreasedDown:
          type: boolean
        PreviousDown:
          $ref: '#/components/schemas/UsFootballFixtureDown'
    KickoffInfo:
      title: KickoffInfo
      type: object
      required:
        - Team
      properties:
        Team:
          $ref: '#/components/schemas/Participant'
        Type:
          $ref: '#/components/schemas/KickoffType'
        Outcome:
          $ref: '#/components/schemas/KickoffOutcome'
        KickoffPreviousAction:
          $ref: '#/components/schemas/KickoffSource'
        PenaltyYards:
          type: integer
          format: int32
    UsFootballFixtureScore:
      title: UsFootballFixtureScore
      type: object
      required:
        - Participant1
        - Participant2
      properties:
        Participant1:
          $ref: '#/components/schemas/UsFootballTotalScore'
        Participant2:
          $ref: '#/components/schemas/UsFootballTotalScore'
    UsFootballData:
      title: UsFootballData
      type: object
      properties:
        Action:
          type: string
        Active:
          type: boolean
        BigPlay:
          type: boolean
        Challenge:
          type: boolean
        Clock:
          $ref: '#/components/schemas/UsFootballFixtureClock'
        Down:
          type: string
        FieldGoal:
          type: boolean
        Id:
          type: integer
          format: int32
        IsTeam:
          type: boolean
        New:
          $ref: '#/components/schemas/UpdateReference'
        NewSetOfDowns:
          type: boolean
        Origin:
          type: string
        Outcome:
          type: string
        Participant:
          type: integer
          format: int32
        Participants:
          type: array
          items:
            type: integer
            format: int32
        PasserId:
          type: integer
          format: int32
        Penalty:
          type: boolean
        PlayerId:
          type: integer
          format: int32
        Posession:
          type: integer
          format: int32
        Previous:
          $ref: '#/components/schemas/UpdateReference'
        ReceiverId:
          type: integer
          format: int32
        ReplaceId:
          type: integer
          format: int32
        ReviewType:
          type: string
        RusherId:
          type: integer
          format: int32
        SackedPlayerId:
          type: integer
          format: int32
        Safety:
          type: boolean
        ScrimmageLine:
          type: integer
          format: int32
        Side:
          type: string
        Touchdown:
          type: boolean
        Turnover:
          type: boolean
        Type:
          type: string
        Yards:
          type: integer
          format: int32
        YardsToGo:
          type: integer
          format: int32
        YardsToEndzone:
          type: integer
          format: int32
    BasketballFixtureScore:
      title: BasketballFixtureScore
      type: object
      required:
        - Participant1
        - Participant2
      properties:
        Participant1:
          $ref: '#/components/schemas/BasketballTotalScore'
        Participant2:
          $ref: '#/components/schemas/BasketballTotalScore'
    BasketballData:
      title: BasketballData
      type: object
      properties:
        Action:
          type: string
        Active:
          type: boolean
        AssistConfirmed:
          type: boolean
        AssistId:
          type: integer
          format: int32
        BlockConfirmed:
          type: boolean
        BlockerId:
          type: integer
          format: int32
        Clock:
          $ref: '#/components/schemas/UsFootballFixtureClock'
        FouledId:
          type: integer
          format: int32
        Id:
          type: integer
          format: int32
        New:
          $ref: '#/components/schemas/BasketballUpdateReference'
        Outcome:
          type: string
        Previous:
          $ref: '#/components/schemas/BasketballUpdateReference'
        ReplaceId:
          type: integer
          format: int32
        Type:
          type: string
    SoccerFixtureScore:
      title: SoccerFixtureScore
      type: object
      required:
        - Participant1
        - Participant2
      properties:
        Participant1:
          $ref: '#/components/schemas/SoccerTotalScore'
        Participant2:
          $ref: '#/components/schemas/SoccerTotalScore'
    SoccerData:
      title: SoccerData
      type: object
      properties:
        Action:
          type: string
        Color:
          type: string
        Conditions:
          type: array
          items:
            $ref: '#/components/schemas/SoccerCondition'
        New:
          $ref: '#/components/schemas/SoccerUpdateReference'
        Corner:
          type: boolean
        FreeKickType:
          type: string
        Goal:
          type: boolean
        GoalType:
          $ref: '#/components/schemas/GoalType'
        Minutes:
          type: integer
          format: int32
        Outcome:
          type: string
        Participant:
          type: integer
          format: int32
        Penalty:
          type: boolean
        PlayerId:
          type: integer
          format: int32
        PlayerInId:
          type: integer
          format: int32
        PlayerOutId:
          type: integer
          format: int32
        Previous:
          $ref: '#/components/schemas/SoccerUpdateReference'
        StatusId:
          type: integer
          format: int32
        ThrowInType:
          type: string
        Type:
          type: string
        RedCard:
          type: boolean
        YellowCard:
          type: boolean
        VAR:
          type: boolean
        VenueType:
          $ref: '#/components/schemas/SoccerVenueType'
    Map_ScoreStatKey:
      title: Map_ScoreStatKey
      type: object
      additionalProperties:
        type: integer
        format: int32
    KickoffDetails:
      title: KickoffDetails
      type: object
      properties:
        Team:
          $ref: '#/components/schemas/Participant'
    LineupData:
      title: LineupData
      type: object
      required:
        - id
        - normativeId
        - preferredName
        - gender
        - updateDateMillis
      properties:
        id:
          type: string
        normativeId:
          type: integer
          format: int32
        preferredName:
          type: string
        gender:
          type: string
        updateDateMillis:
          type: integer
          format: int64
        lineups:
          type: array
          items:
            $ref: '#/components/schemas/PlayerLineupData'
    SoccerPossessionType:
      title: SoccerPossessionType
      oneOf:
        - $ref: '#/components/schemas/AttackPossession'
        - $ref: '#/components/schemas/DangerPossession'
        - $ref: '#/components/schemas/HighDangerPossession'
        - $ref: '#/components/schemas/SafePossession'
    SoccerPartiState:
      title: SoccerPartiState
      type: object
      required:
        - PossibleEvent
      properties:
        PossibleEvent:
          $ref: '#/components/schemas/SoccerPossiblePartiEvent'
    UsFootballPartiState:
      title: UsFootballPartiState
      type: object
      required:
        - Timeouts
        - Challenges
        - PossibleEvent
      properties:
        Timeouts:
          type: integer
          format: int32
        Challenges:
          type: integer
          format: int32
        PossibleEvent:
          $ref: '#/components/schemas/UsFootballPossiblePartiEvent'
    BasketballPartiState:
      title: BasketballPartiState
      type: object
      required:
        - AttackingBasket
        - ActiveTimeout
        - Challenges
      properties:
        AttackingBasket:
          type: boolean
        ActiveTimeout:
          type: boolean
        Challenges:
          type: integer
          format: int32
    SoccerPossibleNeutralEvent:
      title: SoccerPossibleNeutralEvent
      type: object
      required:
        - RedCard
        - YellowCard
        - VAR
      properties:
        RedCard:
          type: boolean
        YellowCard:
          type: boolean
        VAR:
          type: boolean
    UsFootballPossibleEvent:
      title: UsFootballPossibleEvent
      type: object
      required:
        - penalty
        - turnover
        - challenge
      properties:
        penalty:
          type: boolean
        turnover:
          type: boolean
        challenge:
          type: boolean
    A:
      title: A
      type: object
    C:
      title: C
      type: object
    F:
      title: F
      type: object
    FO:
      title: FO
      type: object
    HT:
      title: HT
      type: object
    I:
      title: I
      type: object
    NS:
      title: NS
      type: object
    OB:
      title: OB
      type: object
    OB1:
      title: OB1
      type: object
    OB10:
      title: OB10
      type: object
    OB11:
      title: OB11
      type: object
    OB2:
      title: OB2
      type: object
    OB3:
      title: OB3
      type: object
    OB4:
      title: OB4
      type: object
    OB5:
      title: OB5
      type: object
    OB6:
      title: OB6
      type: object
    OB7:
      title: OB7
      type: object
    OB8:
      title: OB8
      type: object
    OB9:
      title: OB9
      type: object
    OT:
      title: OT
      type: object
    OT1:
      title: OT1
      type: object
    OT10:
      title: OT10
      type: object
    OT11:
      title: OT11
      type: object
    OT12:
      title: OT12
      type: object
    OT2:
      title: OT2
      type: object
    OT3:
      title: OT3
      type: object
    OT4:
      title: OT4
      type: object
    OT5:
      title: OT5
      type: object
    OT6:
      title: OT6
      type: object
    OT7:
      title: OT7
      type: object
    OT8:
      title: OT8
      type: object
    OT9:
      title: OT9
      type: object
    Q1:
      title: Q1
      type: object
    Q1B:
      title: Q1B
      type: object
    Q2:
      title: Q2
      type: object
    Q3:
      title: Q3
      type: object
    Q3B:
      title: Q3B
      type: object
    Q4:
      title: Q4
      type: object
    TXCC:
      title: TXCC
      type: object
    TXCS:
      title: TXCS
      type: object
    WO:
      title: WO
      type: object
    A1:
      title: A
      type: object
    C1:
      title: C
      type: object
    F1:
      title: F
      type: object
    FO1:
      title: FO
      type: object
    H1:
      title: H1
      type: object
    H2:
      title: H2
      type: object
    HT1:
      title: HT
      type: object
    I1:
      title: I
      type: object
    NS1:
      title: NS
      type: object
    OB12:
      title: OB
      type: object
    OT13:
      title: OT
      type: object
    Q11:
      title: Q1
      type: object
    Q1B1:
      title: Q1B
      type: object
    Q21:
      title: Q2
      type: object
    Q31:
      title: Q3
      type: object
    Q3B1:
      title: Q3B
      type: object
    Q41:
      title: Q4
      type: object
    TXCC1:
      title: TXCC
      type: object
    TXCS1:
      title: TXCS
      type: object
    WO1:
      title: WO
      type: object
    A2:
      title: A
      type: object
    C2:
      title: C
      type: object
    ET1:
      title: ET1
      type: object
    ET2:
      title: ET2
      type: object
    F2:
      title: F
      type: object
    FET:
      title: FET
      type: object
    FPE:
      title: FPE
      type: object
    H11:
      title: H1
      type: object
    H21:
      title: H2
      type: object
    HT2:
      title: HT
      type: object
    HTET:
      title: HTET
      type: object
    I2:
      title: I
      type: object
    NS2:
      title: NS
      type: object
    P:
      title: P
      type: object
    PE:
      title: PE
      type: object
    TXCC2:
      title: TXCC
      type: object
    TXCS2:
      title: TXCS
      type: object
    WET:
      title: WET
      type: object
    WPE:
      title: WPE
      type: object
    Basketball:
      title: Basketball
      type: object
    Soccer:
      title: Soccer
      type: object
    UsFootball:
      title: UsFootball
      type: object
    Participant:
      title: Participant
      oneOf:
        - $ref: '#/components/schemas/Parti1'
        - $ref: '#/components/schemas/Parti2'
    Side:
      title: Side
      oneOf:
        - $ref: '#/components/schemas/Defensive'
        - $ref: '#/components/schemas/Offensive'
    InPlayOutcome:
      title: InPlayOutcome
      oneOf:
        - $ref: '#/components/schemas/Blocked'
        - $ref: '#/components/schemas/Downed'
        - $ref: '#/components/schemas/FairCatch'
        - $ref: '#/components/schemas/FieldGoalMissed'
        - $ref: '#/components/schemas/FieldGoalSuccessful'
        - $ref: '#/components/schemas/Fumble'
        - $ref: '#/components/schemas/OutOfBounds'
        - $ref: '#/components/schemas/PassComplete'
        - $ref: '#/components/schemas/PassIncomplete'
        - $ref: '#/components/schemas/PassIntercepted'
        - $ref: '#/components/schemas/PassSack'
        - $ref: '#/components/schemas/Recovered'
        - $ref: '#/components/schemas/Return'
        - $ref: '#/components/schemas/RushComplete'
        - $ref: '#/components/schemas/Touchback'
    KickoffType:
      title: KickoffType
      oneOf:
        - $ref: '#/components/schemas/Onside'
        - $ref: '#/components/schemas/Regular'
    KickoffOutcome:
      title: KickoffOutcome
      oneOf:
        - $ref: '#/components/schemas/FairCatch'
        - $ref: '#/components/schemas/Fumble'
        - $ref: '#/components/schemas/OutOfBounds'
        - $ref: '#/components/schemas/Recovered'
        - $ref: '#/components/schemas/Return'
        - $ref: '#/components/schemas/Touchback'
    KickoffSource:
      title: KickoffSource
      oneOf:
        - $ref: '#/components/schemas/ConversionSafety'
        - $ref: '#/components/schemas/DefensiveConversion'
        - $ref: '#/components/schemas/Safety1Pt'
        - $ref: '#/components/schemas/Safety2Pt'
    UsFootballTotalScore:
      title: UsFootballTotalScore
      type: object
      properties:
        Q1:
          $ref: '#/components/schemas/UsFootballScore'
        Q2:
          $ref: '#/components/schemas/UsFootballScore'
        HT:
          $ref: '#/components/schemas/UsFootballScore'
        Q3:
          $ref: '#/components/schemas/UsFootballScore'
        Q4:
          $ref: '#/components/schemas/UsFootballScore'
        OT:
          $ref: '#/components/schemas/Map_UsFootballScore'
        OTTotal:
          $ref: '#/components/schemas/UsFootballScore'
        Total:
          $ref: '#/components/schemas/UsFootballScore'
    UpdateReference:
      title: UpdateReference
      type: object
      properties:
        Clock:
          $ref: '#/components/schemas/UsFootballFixtureClock'
        IsTeam:
          type: boolean
        Outcome:
          $ref: '#/components/schemas/PassOutcome'
        PlayerId:
          type: integer
          format: int32
        ReceiverId:
          type: integer
          format: int32
        RusherId:
          type: integer
          format: int32
        SackedPlayerId:
          type: integer
          format: int32
        Yards:
          type: integer
          format: int32
        YardsToGo:
          type: integer
          format: int32
    BasketballTotalScore:
      title: BasketballTotalScore
      type: object
      properties:
        Period:
          $ref: '#/components/schemas/Map_BasketballScore'
        HT:
          $ref: '#/components/schemas/BasketballScore'
        OT:
          $ref: '#/components/schemas/Map_BasketballScore'
        OTTotal:
          $ref: '#/components/schemas/BasketballScore'
        Total:
          $ref: '#/components/schemas/BasketballScore'
    BasketballUpdateReference:
      title: BasketballUpdateReference
      type: object
      properties:
        AssistConfirmed:
          type: boolean
        AssistId:
          type: integer
          format: int32
        BlockConfirmed:
          type: boolean
        BlockerId:
          type: integer
          format: int32
        Clock:
          $ref: '#/components/schemas/UsFootballFixtureClock'
        FouledId:
          type: integer
          format: int32
        IsPlayerRebound:
          type: boolean
        IsTeam:
          type: boolean
        IsTeamRebound:
          type: boolean
        Outcome:
          description: Union of PointAttemptOutcome and FreeThrowOutcome
          type: string
        Participant:
          type: integer
          format: int32
        PlayerId:
          type: integer
          format: int32
        PlayerInId:
          type: integer
          format: int32
        PlayerOutId:
          type: integer
          format: int32
        TeamFoul:
          type: boolean
        TurnoverId:
          type: integer
          format: int32
        Type:
          description: Union of FoulType, ReboundType, and FreeThrowType
          type: string
        UpdatePlayersOnCourt:
          type: boolean
    SoccerTotalScore:
      title: SoccerTotalScore
      type: object
      properties:
        H1:
          $ref: '#/components/schemas/SoccerScore'
        HT:
          $ref: '#/components/schemas/SoccerScore'
        H2:
          $ref: '#/components/schemas/SoccerScore'
        ET1:
          $ref: '#/components/schemas/SoccerScore'
        ET2:
          $ref: '#/components/schemas/SoccerScore'
        PE:
          $ref: '#/components/schemas/SoccerScore'
        ETTotal:
          $ref: '#/components/schemas/SoccerScore'
        Total:
          $ref: '#/components/schemas/SoccerScore'
    SoccerCondition:
      title: SoccerCondition
      description: Union of SoccerWeather and SoccerPitchCondition
      type: string
    SoccerUpdateReference:
      title: SoccerUpdateReference
      type: object
      properties:
        Clock:
          $ref: '#/components/schemas/SoccerFixtureClock'
        FreeKickType:
          $ref: '#/components/schemas/FreeKickType'
        GoalType:
          $ref: '#/components/schemas/GoalType'
        Minutes:
          type: integer
          format: int32
        Outcome:
          description: >-
            A string representing either a ShotOutcome, SoccerPenaltyOutcome, or
            InjuryOutcome
          type: string
        PlayerId:
          type: integer
          format: int32
        PlayerInId:
          type: integer
          format: int32
        PlayerOutId:
          type: integer
          format: int32
        ThrowInType:
          $ref: '#/components/schemas/ThrowInType'
        Type:
          type: string
    GoalType:
      title: GoalType
      oneOf:
        - $ref: '#/components/schemas/Head'
        - $ref: '#/components/schemas/Other'
        - $ref: '#/components/schemas/OwnGoal'
        - $ref: '#/components/schemas/Shot'
    SoccerVenueType:
      title: SoccerVenueType
      oneOf:
        - $ref: '#/components/schemas/Away'
        - $ref: '#/components/schemas/Home'
        - $ref: '#/components/schemas/Neutral'
    PlayerLineupData:
      title: PlayerLineupData
      type: object
      required:
        - fixturePlayerId
        - statusId
        - positionId
        - unitId
        - rosterNumber
        - starter
        - starred
        - player
      properties:
        fixturePlayerId:
          type: integer
          format: int32
        statusId:
          type: integer
          format: int32
        positionId:
          type: integer
          format: int32
        unitId:
          type: integer
          format: int32
        rosterNumber:
          type: string
        starter:
          type: boolean
        starred:
          type: boolean
        player:
          $ref: '#/components/schemas/PlayerData'
    AttackPossession:
      title: AttackPossession
      type: object
    DangerPossession:
      title: DangerPossession
      type: object
    HighDangerPossession:
      title: HighDangerPossession
      type: object
    SafePossession:
      title: SafePossession
      type: object
    SoccerPossiblePartiEvent:
      title: SoccerPossiblePartiEvent
      type: object
      required:
        - Goal
        - Penalty
        - Corner
      properties:
        Goal:
          type: boolean
        Penalty:
          type: boolean
        Corner:
          type: boolean
    UsFootballPossiblePartiEvent:
      title: UsFootballPossiblePartiEvent
      type: object
      required:
        - touchdown
        - fieldGoal
        - safety
        - 4thDownConversion
        - 2ptConversionAttempt
        - 1stDown
        - bigPlay
        - punt
      properties:
        touchdown:
          type: boolean
        fieldGoal:
          type: boolean
        safety:
          type: boolean
        4thDownConversion:
          type: boolean
        2ptConversionAttempt:
          type: boolean
        1stDown:
          type: boolean
        bigPlay:
          type: boolean
        punt:
          type: boolean
    Parti1:
      title: Parti1
      type: object
    Parti2:
      title: Parti2
      type: object
    Defensive:
      title: Defensive
      type: object
    Offensive:
      title: Offensive
      type: object
    Blocked:
      title: Blocked
      type: object
    Downed:
      title: Downed
      type: object
    FairCatch:
      title: FairCatch
      type: object
    FieldGoalMissed:
      title: FieldGoalMissed
      type: object
    FieldGoalSuccessful:
      title: FieldGoalSuccessful
      type: object
    Fumble:
      title: Fumble
      type: object
    OutOfBounds:
      title: OutOfBounds
      type: object
    PassComplete:
      title: PassComplete
      type: object
    PassIncomplete:
      title: PassIncomplete
      type: object
    PassIntercepted:
      title: PassIntercepted
      type: object
    PassSack:
      title: PassSack
      type: object
    Recovered:
      title: Recovered
      type: object
    Return:
      title: Return
      type: object
    RushComplete:
      title: RushComplete
      type: object
    Touchback:
      title: Touchback
      type: object
    Onside:
      title: Onside
      type: object
    Regular:
      title: Regular
      type: object
    ConversionSafety:
      title: ConversionSafety
      type: object
    DefensiveConversion:
      title: DefensiveConversion
      type: object
    Safety1Pt:
      title: Safety1Pt
      type: object
    Safety2Pt:
      title: Safety2Pt
      type: object
    UsFootballScore:
      title: UsFootballScore
      type: object
      required:
        - Score
        - Touchdown
        - Safety
        - 1ptSafety
        - 1ptConversion
        - 2ptConversion
        - FieldGoal
        - Defensive2ptConversion
      properties:
        Score:
          type: integer
          format: int32
        Touchdown:
          type: integer
          format: int32
        Safety:
          type: integer
          format: int32
        1ptSafety:
          type: integer
          format: int32
        1ptConversion:
          type: integer
          format: int32
        2ptConversion:
          type: integer
          format: int32
        FieldGoal:
          type: integer
          format: int32
        Defensive2ptConversion:
          type: integer
          format: int32
    Map_UsFootballScore:
      title: Map_UsFootballScore
      type: object
      additionalProperties:
        $ref: '#/components/schemas/UsFootballScore'
    PassOutcome:
      title: PassOutcome
      oneOf:
        - $ref: '#/components/schemas/Complete'
        - $ref: '#/components/schemas/Incomplete'
        - $ref: '#/components/schemas/Intercepted'
        - $ref: '#/components/schemas/Sack'
    Map_BasketballScore:
      title: Map_BasketballScore
      type: object
      additionalProperties:
        $ref: '#/components/schemas/BasketballScore'
    BasketballScore:
      title: BasketballScore
      type: object
      required:
        - Score
        - Fouls
        - PersonalFouls
        - Blocks
        - Rebounds
        - FreeThrows_made
        - 2pts_made
        - 3pts_made
        - FreeThrows_missed
        - 2pts_missed
        - 3pts_missed
        - FreeThrows_attempts
        - 2pts_attempts
        - 3pts_attempts
        - Assists
        - Turnovers
        - Steals
        - UsedTimeouts
      properties:
        Score:
          type: integer
          format: int32
        Fouls:
          type: integer
          format: int32
        PersonalFouls:
          type: integer
          format: int32
        Blocks:
          type: integer
          format: int32
        Rebounds:
          type: integer
          format: int32
        FreeThrows_made:
          type: integer
          format: int32
        2pts_made:
          type: integer
          format: int32
        3pts_made:
          type: integer
          format: int32
        FreeThrows_missed:
          type: integer
          format: int32
        2pts_missed:
          type: integer
          format: int32
        3pts_missed:
          type: integer
          format: int32
        FreeThrows_attempts:
          type: integer
          format: int32
        2pts_attempts:
          type: integer
          format: int32
        3pts_attempts:
          type: integer
          format: int32
        Assists:
          type: integer
          format: int32
        Turnovers:
          type: integer
          format: int32
        Steals:
          type: integer
          format: int32
        UsedTimeouts:
          type: integer
          format: int32
    SoccerScore:
      title: SoccerScore
      type: object
      required:
        - Goals
        - YellowCards
        - RedCards
        - Corners
      properties:
        Goals:
          type: integer
          format: int32
        YellowCards:
          type: integer
          format: int32
        RedCards:
          type: integer
          format: int32
        Corners:
          type: integer
          format: int32
    SoccerFixtureClock:
      title: SoccerFixtureClock
      type: object
      required:
        - running
        - seconds
      properties:
        running:
          type: boolean
        seconds:
          type: integer
          format: int32
    FreeKickType:
      title: FreeKickType
      oneOf:
        - $ref: '#/components/schemas/Attack'
        - $ref: '#/components/schemas/Danger'
        - $ref: '#/components/schemas/HighDanger'
        - $ref: '#/components/schemas/Offside'
        - $ref: '#/components/schemas/Safe'
    ThrowInType:
      title: ThrowInType
      oneOf:
        - $ref: '#/components/schemas/Attack'
        - $ref: '#/components/schemas/Danger'
        - $ref: '#/components/schemas/Safe'
    Head:
      title: Head
      type: object
    Other:
      title: Other
      type: object
    OwnGoal:
      title: OwnGoal
      type: object
    Shot:
      title: Shot
      type: object
    Away:
      title: Away
      type: object
    Home:
      title: Home
      type: object
    Neutral:
      title: Neutral
      type: object
    PlayerData:
      title: PlayerData
      type: object
      required:
        - id
        - normativeId
        - country
        - team
        - dateOfBirth
        - gender
        - preferredName
        - updateDateMillis
      properties:
        id:
          type: string
        normativeId:
          type: integer
          format: int32
        country:
          type: string
        team:
          type: string
        dateOfBirth:
          type: string
        gender:
          type: string
        preferredName:
          type: string
        updateDateMillis:
          type: integer
          format: int64
    Complete:
      title: Complete
      type: object
    Incomplete:
      title: Incomplete
      type: object
    Intercepted:
      title: Intercepted
      type: object
    Sack:
      title: Sack
      type: object
    Attack:
      title: Attack
      type: object
    Danger:
      title: Danger
      type: object
    HighDanger:
      title: HighDanger
      type: object
    Offside:
      title: Offside
      type: object
    Safe:
      title: Safe
      type: object
  securitySchemes:
    httpAuth:
      type: http
      description: User's session JWT.
      scheme: bearer
    apiKeyAuth:
      type: apiKey
      description: The user's long-lived API token, obtained from the activation endpoint.
      name: X-Api-Token
      in: header

````

> ## Documentation Index
> Fetch the complete documentation index at: https://txline-docs.txodds.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Get a json array of all score updates from a specific historical 5-minute interval (no live data is returned)



## OpenAPI

````yaml https://txline.txodds.com/docs/docs.yaml get /api/scores/updates/{epochDay}/{hourOfDay}/{interval}
openapi: 3.1.0
info:
  title: TxLINE off-chain API for the Hybrid on-chain/off-chain TxODDS Data system
  version: 1.5.2
  description: >

    ## Overview


    This API provides access to real-time and historical sports data from the
    **TxLINE on-chain/off-chain Data system**.


    It makes proprietary TxODDS available for any funded blockchain users by
    linking the on-chain `subscribe` transaction by issuing time-limited API
    tokens.

    - The data is canonicalised so that all fixtures, odds, or scores are
    provably identifiable and ordered--confirmed by on-chain cryptographic
    proofs.

    - The data is delivered in a request-response or Server-Sent Events (SSE)
    streaming form.


    Examples of accessing the accompanying on-chain program are available
    publicly at: https://txline.txodds.com/documentation.

    All data returned by the off-chain API is canonicalised such that every
    single record can be cryptographically proven on-chain to be

    part of the unique and consistent dataset generated by the TxODDS Data
    system.


    ## Key features


    * The odds data includes the `Stable Price` demargined prices and
    percentages, currently for key markets in European football (soccer).

    * **Free subscription option that offers World Cup 2026 odds and
    off-the-board signals in real-time sampled every 60 seconds**.

    * **Data access paid for by the TxLINE token tethered to USDT ata rate 1
    USDT = 1_000 TxLINE tokens** The TxLINE utility token can purchased using
    the associated Solana program.

    * **Fine-grained service level selection** The user can list the
    pre-configured **service levels** that either map to pre-defined league
    bundles or allow custom selecting the leagues explicitly.
     The price also depends on the sampling period for the data.
    * **Maximum subscription option that offers all leagues in real-time**.

    * **Historical Snapshots:** Query the latest state of any market at a
    specific point in time.

    * **Historical Updates:** Query the updates for any given key such as
    fixture or market for a given time period.

    * **Live Data Streams:** Real-time, low-latency data feeds using Server-Sent
    Events (SSE).

    * **On-chain Validation:** Retrieve Merkle proofs to cryptographically
    verify data against the on-chain held Merkle roots by calling appropriate
    validate on-chain instructions.


    ## How do the users gain access to off-chain data (see more details and
    examples at: https://github.com/txodds/tx-on-chain)


    1. For paid service tiers, the user purchases TxODDS TxLINE utility tokens
    for USDT at a fixed rate using either a script (e.g., calling
    `purchase_subscription_token_usdt`) or an affiliate website. The tokens are
    deposited into the user's associated token account. (Note: This step is
    skipped for the free World Cup tier).

    2. As a guest, with no prior authentication, the user calls the off-chain
    API at "https://oracle.txodds.com/auth/guest/start" (or `oracle-dev` for
    DevNet) to obtain an anonymous JWT with Guest claims. **Please note that the
    JWT token has 30 days  expiration so if you are issuing calls to the data
    endpoints beyond 30 days, you should either pre-acquire a new JWT token in
    time before 30 days expire or respond to the returned HTTP 401 code by
    reacquiring a fresh JWT token.**

    3. The user creates, signs, and confirms a Solana transaction to the
    `subscribe` instruction, indicating the duration in weeks (must be a
    multiple of 4 weeks, e.g. 4, 8, 12) and the chosen service level. The user
    explicitly acts as the transaction fee payer. For the free tier, the smart
    contract registers the subscription but charges 0 TxLINE tokens.

    4. The user records the confirmed transaction signature (`txSig`).

    5. The user constructs a strict message binding consisting of the `txSig`, a
    comma-separated list of selected leagues, and the JWT.

    6. The user cryptographically signs this message using their wallet's secret
    key to generate a detached signature, which is then Base64-encoded.

    7. The user activates the subscription with the off-chain server at
    "https://oracle.txodds.com/api/token/activate" (or `oracle-dev` for DevNet)
    by posting the `txSig`, the Base64 wallet signature, and the selected
    leagues array, using the JWT for authorization.

    8. The off-chain server validates the cryptographic proof and entitlements,
    issuing an appropriate API Token or rejecting the activation with a reason.

    9. The user calls the documented APIs while the subscription is valid,
    supplying both the JWT and the API Token.

    10. Before the subscription expires, the user may call the `subscribe`
    instruction again to extend the validity period (by a multiple of 4 weeks,
    e.g. 4, 8, 12) via the same off-chain activation call. The selected leagues
    can also be amended.

    11. If the previous subscription has expired, the user can activate a new
    API Token by repeating the process.
servers:
  - url: https://txline.txodds.com
    description: Production TxLINE server
  - url: http://txline-dev.txodds.com
    description: Test TxLINE server
security: []
paths:
  /api/scores/updates/{epochDay}/{hourOfDay}/{interval}:
    get:
      tags:
        - Scores
      summary: >-
        Get a json array of all score updates from a specific historical
        5-minute interval (no live data is returned)
      operationId: getApiScoresUpdatesEpochdayHourofdayInterval
      parameters:
        - name: Authorization
          in: header
          description: Bearer token for the user's session JWT.
          required: true
          schema:
            type: string
        - name: X-Api-Token
          in: header
          description: The user's long-lived API token.
          required: true
          schema:
            type: string
        - name: epochDay
          in: path
          description: The day since the Unix epoch
          required: true
          schema:
            type: integer
        - name: hourOfDay
          in: path
          description: The hour of the day (0-23)
          required: true
          schema:
            type: integer
        - name: interval
          in: path
          description: The 0-indexed 5-minute interval within the hour (0-11)
          required: true
          schema:
            type: integer
        - name: fixtureId
          in: query
          description: Optional filter by fixture ID
          required: false
          schema:
            type: integer
            format: int32
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Scores'
        '400':
          description: >-
            Invalid value for: header Authorization, Invalid value for: header
            X-Api-Token, Invalid value for: path parameter epochDay, Invalid
            value for: path parameter hourOfDay, Invalid value for: path
            parameter interval, Invalid value for: query parameter fixtureId
          content:
            text/plain:
              schema:
                type: string
        '401':
          description: 'Authorization failed: Invalid or expired guest JWT'
          content:
            text/plain:
              schema:
                type: string
        '403':
          description: 'Access denied: Invalid API token or insufficient permissions'
          content:
            text/plain:
              schema:
                type: string
        '500':
          description: Internal server error
          content:
            text/plain:
              schema:
                type: string
      security:
        - httpAuth: []
          apiKeyAuth: []
components:
  schemas:
    Scores:
      title: Scores
      type: object
      required:
        - fixtureId
        - gameState
        - startTime
        - isTeam
        - fixtureGroupId
        - competitionId
        - countryId
        - sportId
        - participant1IsHome
        - participant2Id
        - participant1Id
        - action
        - id
        - ts
        - connectionId
        - seq
      properties:
        fixtureId:
          type: integer
          format: int32
        gameState:
          type: string
        startTime:
          type: integer
          format: int64
        isTeam:
          type: boolean
        fixtureGroupId:
          type: integer
          format: int32
        competitionId:
          type: integer
          format: int32
        countryId:
          type: integer
          format: int32
        sportId:
          type: integer
          format: int32
        participant1IsHome:
          type: boolean
        participant2Id:
          type: integer
          format: int32
        participant1Id:
          type: integer
          format: int32
        coverageSecondaryData:
          type: boolean
        coverageType:
          type: string
        action:
          type: string
        id:
          type: integer
          format: int32
        ts:
          type: integer
          format: int64
        connectionId:
          type: integer
          format: int64
        seq:
          type: integer
          format: int32
        statusId:
          $ref: '#/components/schemas/UsFootballFixtureStatus'
        statusBasketballId:
          $ref: '#/components/schemas/BasketballFixtureStatus'
        statusSoccerId:
          $ref: '#/components/schemas/SoccerFixtureStatus'
        type:
          $ref: '#/components/schemas/FixtureType'
        confirmed:
          type: boolean
        clock:
          $ref: '#/components/schemas/UsFootballFixtureClock'
        down:
          $ref: '#/components/schemas/UsFootballFixtureDown'
        inPlayInfo:
          $ref: '#/components/schemas/InPlayInfo'
        kickoffInfo:
          $ref: '#/components/schemas/KickoffInfo'
        score:
          $ref: '#/components/schemas/UsFootballFixtureScore'
        data:
          $ref: '#/components/schemas/UsFootballData'
        scoreBasketball:
          $ref: '#/components/schemas/BasketballFixtureScore'
        dataBasketball:
          $ref: '#/components/schemas/BasketballData'
        scoreSoccer:
          $ref: '#/components/schemas/SoccerFixtureScore'
        dataSoccer:
          $ref: '#/components/schemas/SoccerData'
        stats:
          $ref: '#/components/schemas/Map_ScoreStatKey'
        participant:
          type: integer
          format: int32
        kickoff:
          $ref: '#/components/schemas/KickoffDetails'
        lineups:
          type: array
          items:
            $ref: '#/components/schemas/LineupData'
        possession:
          type: integer
          format: int32
        possessionType:
          $ref: '#/components/schemas/SoccerPossessionType'
        parti1StateSoccer:
          $ref: '#/components/schemas/SoccerPartiState'
        parti1StateUsFootball:
          $ref: '#/components/schemas/UsFootballPartiState'
        parti1StateBasketball:
          $ref: '#/components/schemas/BasketballPartiState'
        parti2StateSoccer:
          $ref: '#/components/schemas/SoccerPartiState'
        parti2StateUsFootball:
          $ref: '#/components/schemas/UsFootballPartiState'
        parti2StateBasketball:
          $ref: '#/components/schemas/BasketballPartiState'
        possibleEventSoccer:
          $ref: '#/components/schemas/SoccerPossibleNeutralEvent'
        possibleEventUsFootball:
          $ref: '#/components/schemas/UsFootballPossibleEvent'
    UsFootballFixtureStatus:
      title: UsFootballFixtureStatus
      oneOf:
        - $ref: '#/components/schemas/A'
        - $ref: '#/components/schemas/C'
        - $ref: '#/components/schemas/F'
        - $ref: '#/components/schemas/FO'
        - $ref: '#/components/schemas/HT'
        - $ref: '#/components/schemas/I'
        - $ref: '#/components/schemas/NS'
        - $ref: '#/components/schemas/OB'
        - $ref: '#/components/schemas/OB1'
        - $ref: '#/components/schemas/OB10'
        - $ref: '#/components/schemas/OB11'
        - $ref: '#/components/schemas/OB2'
        - $ref: '#/components/schemas/OB3'
        - $ref: '#/components/schemas/OB4'
        - $ref: '#/components/schemas/OB5'
        - $ref: '#/components/schemas/OB6'
        - $ref: '#/components/schemas/OB7'
        - $ref: '#/components/schemas/OB8'
        - $ref: '#/components/schemas/OB9'
        - $ref: '#/components/schemas/OT'
        - $ref: '#/components/schemas/OT1'
        - $ref: '#/components/schemas/OT10'
        - $ref: '#/components/schemas/OT11'
        - $ref: '#/components/schemas/OT12'
        - $ref: '#/components/schemas/OT2'
        - $ref: '#/components/schemas/OT3'
        - $ref: '#/components/schemas/OT4'
        - $ref: '#/components/schemas/OT5'
        - $ref: '#/components/schemas/OT6'
        - $ref: '#/components/schemas/OT7'
        - $ref: '#/components/schemas/OT8'
        - $ref: '#/components/schemas/OT9'
        - $ref: '#/components/schemas/Q1'
        - $ref: '#/components/schemas/Q1B'
        - $ref: '#/components/schemas/Q2'
        - $ref: '#/components/schemas/Q3'
        - $ref: '#/components/schemas/Q3B'
        - $ref: '#/components/schemas/Q4'
        - $ref: '#/components/schemas/TXCC'
        - $ref: '#/components/schemas/TXCS'
        - $ref: '#/components/schemas/WO'
    BasketballFixtureStatus:
      title: BasketballFixtureStatus
      oneOf:
        - $ref: '#/components/schemas/A1'
        - $ref: '#/components/schemas/C1'
        - $ref: '#/components/schemas/F1'
        - $ref: '#/components/schemas/FO1'
        - $ref: '#/components/schemas/H1'
        - $ref: '#/components/schemas/H2'
        - $ref: '#/components/schemas/HT1'
        - $ref: '#/components/schemas/I1'
        - $ref: '#/components/schemas/NS1'
        - $ref: '#/components/schemas/OB12'
        - $ref: '#/components/schemas/OT13'
        - $ref: '#/components/schemas/Q11'
        - $ref: '#/components/schemas/Q1B1'
        - $ref: '#/components/schemas/Q21'
        - $ref: '#/components/schemas/Q31'
        - $ref: '#/components/schemas/Q3B1'
        - $ref: '#/components/schemas/Q41'
        - $ref: '#/components/schemas/TXCC1'
        - $ref: '#/components/schemas/TXCS1'
        - $ref: '#/components/schemas/WO1'
    SoccerFixtureStatus:
      title: SoccerFixtureStatus
      oneOf:
        - $ref: '#/components/schemas/A2'
        - $ref: '#/components/schemas/C2'
        - $ref: '#/components/schemas/ET1'
        - $ref: '#/components/schemas/ET2'
        - $ref: '#/components/schemas/F2'
        - $ref: '#/components/schemas/FET'
        - $ref: '#/components/schemas/FPE'
        - $ref: '#/components/schemas/H11'
        - $ref: '#/components/schemas/H21'
        - $ref: '#/components/schemas/HT2'
        - $ref: '#/components/schemas/HTET'
        - $ref: '#/components/schemas/I2'
        - $ref: '#/components/schemas/NS2'
        - $ref: '#/components/schemas/P'
        - $ref: '#/components/schemas/PE'
        - $ref: '#/components/schemas/TXCC2'
        - $ref: '#/components/schemas/TXCS2'
        - $ref: '#/components/schemas/WET'
        - $ref: '#/components/schemas/WPE'
    FixtureType:
      title: FixtureType
      oneOf:
        - $ref: '#/components/schemas/Basketball'
        - $ref: '#/components/schemas/Soccer'
        - $ref: '#/components/schemas/UsFootball'
    UsFootballFixtureClock:
      title: UsFootballFixtureClock
      type: object
      required:
        - running
        - seconds
      properties:
        running:
          type: boolean
        seconds:
          type: integer
          format: int32
    UsFootballFixtureDown:
      title: UsFootballFixtureDown
      type: object
      required:
        - number
        - yardsToGo
        - scrimmageLine
        - possession
        - side
      properties:
        number:
          type: integer
          format: int32
        yardsToGo:
          type: integer
          format: int32
        scrimmageLine:
          type: integer
          format: int32
        possession:
          $ref: '#/components/schemas/Participant'
        side:
          $ref: '#/components/schemas/Side'
    InPlayInfo:
      title: InPlayInfo
      type: object
      required:
        - BallSnapped
        - PlayersLiningUp
        - TimeoutParti1
        - TimeoutParti2
        - TVTimeout
      properties:
        BallSnapped:
          type: boolean
        PlayersLiningUp:
          type: boolean
        TimeoutParti1:
          type: boolean
        TimeoutParti2:
          type: boolean
        TVTimeout:
          type: boolean
        Outcome:
          $ref: '#/components/schemas/InPlayOutcome'
        NewSetOfDowns:
          type: boolean
        PenaltyIncreasedDown:
          type: boolean
        PreviousDown:
          $ref: '#/components/schemas/UsFootballFixtureDown'
    KickoffInfo:
      title: KickoffInfo
      type: object
      required:
        - Team
      properties:
        Team:
          $ref: '#/components/schemas/Participant'
        Type:
          $ref: '#/components/schemas/KickoffType'
        Outcome:
          $ref: '#/components/schemas/KickoffOutcome'
        KickoffPreviousAction:
          $ref: '#/components/schemas/KickoffSource'
        PenaltyYards:
          type: integer
          format: int32
    UsFootballFixtureScore:
      title: UsFootballFixtureScore
      type: object
      required:
        - Participant1
        - Participant2
      properties:
        Participant1:
          $ref: '#/components/schemas/UsFootballTotalScore'
        Participant2:
          $ref: '#/components/schemas/UsFootballTotalScore'
    UsFootballData:
      title: UsFootballData
      type: object
      properties:
        Action:
          type: string
        Active:
          type: boolean
        BigPlay:
          type: boolean
        Challenge:
          type: boolean
        Clock:
          $ref: '#/components/schemas/UsFootballFixtureClock'
        Down:
          type: string
        FieldGoal:
          type: boolean
        Id:
          type: integer
          format: int32
        IsTeam:
          type: boolean
        New:
          $ref: '#/components/schemas/UpdateReference'
        NewSetOfDowns:
          type: boolean
        Origin:
          type: string
        Outcome:
          type: string
        Participant:
          type: integer
          format: int32
        Participants:
          type: array
          items:
            type: integer
            format: int32
        PasserId:
          type: integer
          format: int32
        Penalty:
          type: boolean
        PlayerId:
          type: integer
          format: int32
        Posession:
          type: integer
          format: int32
        Previous:
          $ref: '#/components/schemas/UpdateReference'
        ReceiverId:
          type: integer
          format: int32
        ReplaceId:
          type: integer
          format: int32
        ReviewType:
          type: string
        RusherId:
          type: integer
          format: int32
        SackedPlayerId:
          type: integer
          format: int32
        Safety:
          type: boolean
        ScrimmageLine:
          type: integer
          format: int32
        Side:
          type: string
        Touchdown:
          type: boolean
        Turnover:
          type: boolean
        Type:
          type: string
        Yards:
          type: integer
          format: int32
        YardsToGo:
          type: integer
          format: int32
        YardsToEndzone:
          type: integer
          format: int32
    BasketballFixtureScore:
      title: BasketballFixtureScore
      type: object
      required:
        - Participant1
        - Participant2
      properties:
        Participant1:
          $ref: '#/components/schemas/BasketballTotalScore'
        Participant2:
          $ref: '#/components/schemas/BasketballTotalScore'
    BasketballData:
      title: BasketballData
      type: object
      properties:
        Action:
          type: string
        Active:
          type: boolean
        AssistConfirmed:
          type: boolean
        AssistId:
          type: integer
          format: int32
        BlockConfirmed:
          type: boolean
        BlockerId:
          type: integer
          format: int32
        Clock:
          $ref: '#/components/schemas/UsFootballFixtureClock'
        FouledId:
          type: integer
          format: int32
        Id:
          type: integer
          format: int32
        New:
          $ref: '#/components/schemas/BasketballUpdateReference'
        Outcome:
          type: string
        Previous:
          $ref: '#/components/schemas/BasketballUpdateReference'
        ReplaceId:
          type: integer
          format: int32
        Type:
          type: string
    SoccerFixtureScore:
      title: SoccerFixtureScore
      type: object
      required:
        - Participant1
        - Participant2
      properties:
        Participant1:
          $ref: '#/components/schemas/SoccerTotalScore'
        Participant2:
          $ref: '#/components/schemas/SoccerTotalScore'
    SoccerData:
      title: SoccerData
      type: object
      properties:
        Action:
          type: string
        Color:
          type: string
        Conditions:
          type: array
          items:
            $ref: '#/components/schemas/SoccerCondition'
        New:
          $ref: '#/components/schemas/SoccerUpdateReference'
        Corner:
          type: boolean
        FreeKickType:
          type: string
        Goal:
          type: boolean
        GoalType:
          $ref: '#/components/schemas/GoalType'
        Minutes:
          type: integer
          format: int32
        Outcome:
          type: string
        Participant:
          type: integer
          format: int32
        Penalty:
          type: boolean
        PlayerId:
          type: integer
          format: int32
        PlayerInId:
          type: integer
          format: int32
        PlayerOutId:
          type: integer
          format: int32
        Previous:
          $ref: '#/components/schemas/SoccerUpdateReference'
        StatusId:
          type: integer
          format: int32
        ThrowInType:
          type: string
        Type:
          type: string
        RedCard:
          type: boolean
        YellowCard:
          type: boolean
        VAR:
          type: boolean
        VenueType:
          $ref: '#/components/schemas/SoccerVenueType'
    Map_ScoreStatKey:
      title: Map_ScoreStatKey
      type: object
      additionalProperties:
        type: integer
        format: int32
    KickoffDetails:
      title: KickoffDetails
      type: object
      properties:
        Team:
          $ref: '#/components/schemas/Participant'
    LineupData:
      title: LineupData
      type: object
      required:
        - id
        - normativeId
        - preferredName
        - gender
        - updateDateMillis
      properties:
        id:
          type: string
        normativeId:
          type: integer
          format: int32
        preferredName:
          type: string
        gender:
          type: string
        updateDateMillis:
          type: integer
          format: int64
        lineups:
          type: array
          items:
            $ref: '#/components/schemas/PlayerLineupData'
    SoccerPossessionType:
      title: SoccerPossessionType
      oneOf:
        - $ref: '#/components/schemas/AttackPossession'
        - $ref: '#/components/schemas/DangerPossession'
        - $ref: '#/components/schemas/HighDangerPossession'
        - $ref: '#/components/schemas/SafePossession'
    SoccerPartiState:
      title: SoccerPartiState
      type: object
      required:
        - PossibleEvent
      properties:
        PossibleEvent:
          $ref: '#/components/schemas/SoccerPossiblePartiEvent'
    UsFootballPartiState:
      title: UsFootballPartiState
      type: object
      required:
        - Timeouts
        - Challenges
        - PossibleEvent
      properties:
        Timeouts:
          type: integer
          format: int32
        Challenges:
          type: integer
          format: int32
        PossibleEvent:
          $ref: '#/components/schemas/UsFootballPossiblePartiEvent'
    BasketballPartiState:
      title: BasketballPartiState
      type: object
      required:
        - AttackingBasket
        - ActiveTimeout
        - Challenges
      properties:
        AttackingBasket:
          type: boolean
        ActiveTimeout:
          type: boolean
        Challenges:
          type: integer
          format: int32
    SoccerPossibleNeutralEvent:
      title: SoccerPossibleNeutralEvent
      type: object
      required:
        - RedCard
        - YellowCard
        - VAR
      properties:
        RedCard:
          type: boolean
        YellowCard:
          type: boolean
        VAR:
          type: boolean
    UsFootballPossibleEvent:
      title: UsFootballPossibleEvent
      type: object
      required:
        - penalty
        - turnover
        - challenge
      properties:
        penalty:
          type: boolean
        turnover:
          type: boolean
        challenge:
          type: boolean
    A:
      title: A
      type: object
    C:
      title: C
      type: object
    F:
      title: F
      type: object
    FO:
      title: FO
      type: object
    HT:
      title: HT
      type: object
    I:
      title: I
      type: object
    NS:
      title: NS
      type: object
    OB:
      title: OB
      type: object
    OB1:
      title: OB1
      type: object
    OB10:
      title: OB10
      type: object
    OB11:
      title: OB11
      type: object
    OB2:
      title: OB2
      type: object
    OB3:
      title: OB3
      type: object
    OB4:
      title: OB4
      type: object
    OB5:
      title: OB5
      type: object
    OB6:
      title: OB6
      type: object
    OB7:
      title: OB7
      type: object
    OB8:
      title: OB8
      type: object
    OB9:
      title: OB9
      type: object
    OT:
      title: OT
      type: object
    OT1:
      title: OT1
      type: object
    OT10:
      title: OT10
      type: object
    OT11:
      title: OT11
      type: object
    OT12:
      title: OT12
      type: object
    OT2:
      title: OT2
      type: object
    OT3:
      title: OT3
      type: object
    OT4:
      title: OT4
      type: object
    OT5:
      title: OT5
      type: object
    OT6:
      title: OT6
      type: object
    OT7:
      title: OT7
      type: object
    OT8:
      title: OT8
      type: object
    OT9:
      title: OT9
      type: object
    Q1:
      title: Q1
      type: object
    Q1B:
      title: Q1B
      type: object
    Q2:
      title: Q2
      type: object
    Q3:
      title: Q3
      type: object
    Q3B:
      title: Q3B
      type: object
    Q4:
      title: Q4
      type: object
    TXCC:
      title: TXCC
      type: object
    TXCS:
      title: TXCS
      type: object
    WO:
      title: WO
      type: object
    A1:
      title: A
      type: object
    C1:
      title: C
      type: object
    F1:
      title: F
      type: object
    FO1:
      title: FO
      type: object
    H1:
      title: H1
      type: object
    H2:
      title: H2
      type: object
    HT1:
      title: HT
      type: object
    I1:
      title: I
      type: object
    NS1:
      title: NS
      type: object
    OB12:
      title: OB
      type: object
    OT13:
      title: OT
      type: object
    Q11:
      title: Q1
      type: object
    Q1B1:
      title: Q1B
      type: object
    Q21:
      title: Q2
      type: object
    Q31:
      title: Q3
      type: object
    Q3B1:
      title: Q3B
      type: object
    Q41:
      title: Q4
      type: object
    TXCC1:
      title: TXCC
      type: object
    TXCS1:
      title: TXCS
      type: object
    WO1:
      title: WO
      type: object
    A2:
      title: A
      type: object
    C2:
      title: C
      type: object
    ET1:
      title: ET1
      type: object
    ET2:
      title: ET2
      type: object
    F2:
      title: F
      type: object
    FET:
      title: FET
      type: object
    FPE:
      title: FPE
      type: object
    H11:
      title: H1
      type: object
    H21:
      title: H2
      type: object
    HT2:
      title: HT
      type: object
    HTET:
      title: HTET
      type: object
    I2:
      title: I
      type: object
    NS2:
      title: NS
      type: object
    P:
      title: P
      type: object
    PE:
      title: PE
      type: object
    TXCC2:
      title: TXCC
      type: object
    TXCS2:
      title: TXCS
      type: object
    WET:
      title: WET
      type: object
    WPE:
      title: WPE
      type: object
    Basketball:
      title: Basketball
      type: object
    Soccer:
      title: Soccer
      type: object
    UsFootball:
      title: UsFootball
      type: object
    Participant:
      title: Participant
      oneOf:
        - $ref: '#/components/schemas/Parti1'
        - $ref: '#/components/schemas/Parti2'
    Side:
      title: Side
      oneOf:
        - $ref: '#/components/schemas/Defensive'
        - $ref: '#/components/schemas/Offensive'
    InPlayOutcome:
      title: InPlayOutcome
      oneOf:
        - $ref: '#/components/schemas/Blocked'
        - $ref: '#/components/schemas/Downed'
        - $ref: '#/components/schemas/FairCatch'
        - $ref: '#/components/schemas/FieldGoalMissed'
        - $ref: '#/components/schemas/FieldGoalSuccessful'
        - $ref: '#/components/schemas/Fumble'
        - $ref: '#/components/schemas/OutOfBounds'
        - $ref: '#/components/schemas/PassComplete'
        - $ref: '#/components/schemas/PassIncomplete'
        - $ref: '#/components/schemas/PassIntercepted'
        - $ref: '#/components/schemas/PassSack'
        - $ref: '#/components/schemas/Recovered'
        - $ref: '#/components/schemas/Return'
        - $ref: '#/components/schemas/RushComplete'
        - $ref: '#/components/schemas/Touchback'
    KickoffType:
      title: KickoffType
      oneOf:
        - $ref: '#/components/schemas/Onside'
        - $ref: '#/components/schemas/Regular'
    KickoffOutcome:
      title: KickoffOutcome
      oneOf:
        - $ref: '#/components/schemas/FairCatch'
        - $ref: '#/components/schemas/Fumble'
        - $ref: '#/components/schemas/OutOfBounds'
        - $ref: '#/components/schemas/Recovered'
        - $ref: '#/components/schemas/Return'
        - $ref: '#/components/schemas/Touchback'
    KickoffSource:
      title: KickoffSource
      oneOf:
        - $ref: '#/components/schemas/ConversionSafety'
        - $ref: '#/components/schemas/DefensiveConversion'
        - $ref: '#/components/schemas/Safety1Pt'
        - $ref: '#/components/schemas/Safety2Pt'
    UsFootballTotalScore:
      title: UsFootballTotalScore
      type: object
      properties:
        Q1:
          $ref: '#/components/schemas/UsFootballScore'
        Q2:
          $ref: '#/components/schemas/UsFootballScore'
        HT:
          $ref: '#/components/schemas/UsFootballScore'
        Q3:
          $ref: '#/components/schemas/UsFootballScore'
        Q4:
          $ref: '#/components/schemas/UsFootballScore'
        OT:
          $ref: '#/components/schemas/Map_UsFootballScore'
        OTTotal:
          $ref: '#/components/schemas/UsFootballScore'
        Total:
          $ref: '#/components/schemas/UsFootballScore'
    UpdateReference:
      title: UpdateReference
      type: object
      properties:
        Clock:
          $ref: '#/components/schemas/UsFootballFixtureClock'
        IsTeam:
          type: boolean
        Outcome:
          $ref: '#/components/schemas/PassOutcome'
        PlayerId:
          type: integer
          format: int32
        ReceiverId:
          type: integer
          format: int32
        RusherId:
          type: integer
          format: int32
        SackedPlayerId:
          type: integer
          format: int32
        Yards:
          type: integer
          format: int32
        YardsToGo:
          type: integer
          format: int32
    BasketballTotalScore:
      title: BasketballTotalScore
      type: object
      properties:
        Period:
          $ref: '#/components/schemas/Map_BasketballScore'
        HT:
          $ref: '#/components/schemas/BasketballScore'
        OT:
          $ref: '#/components/schemas/Map_BasketballScore'
        OTTotal:
          $ref: '#/components/schemas/BasketballScore'
        Total:
          $ref: '#/components/schemas/BasketballScore'
    BasketballUpdateReference:
      title: BasketballUpdateReference
      type: object
      properties:
        AssistConfirmed:
          type: boolean
        AssistId:
          type: integer
          format: int32
        BlockConfirmed:
          type: boolean
        BlockerId:
          type: integer
          format: int32
        Clock:
          $ref: '#/components/schemas/UsFootballFixtureClock'
        FouledId:
          type: integer
          format: int32
        IsPlayerRebound:
          type: boolean
        IsTeam:
          type: boolean
        IsTeamRebound:
          type: boolean
        Outcome:
          description: Union of PointAttemptOutcome and FreeThrowOutcome
          type: string
        Participant:
          type: integer
          format: int32
        PlayerId:
          type: integer
          format: int32
        PlayerInId:
          type: integer
          format: int32
        PlayerOutId:
          type: integer
          format: int32
        TeamFoul:
          type: boolean
        TurnoverId:
          type: integer
          format: int32
        Type:
          description: Union of FoulType, ReboundType, and FreeThrowType
          type: string
        UpdatePlayersOnCourt:
          type: boolean
    SoccerTotalScore:
      title: SoccerTotalScore
      type: object
      properties:
        H1:
          $ref: '#/components/schemas/SoccerScore'
        HT:
          $ref: '#/components/schemas/SoccerScore'
        H2:
          $ref: '#/components/schemas/SoccerScore'
        ET1:
          $ref: '#/components/schemas/SoccerScore'
        ET2:
          $ref: '#/components/schemas/SoccerScore'
        PE:
          $ref: '#/components/schemas/SoccerScore'
        ETTotal:
          $ref: '#/components/schemas/SoccerScore'
        Total:
          $ref: '#/components/schemas/SoccerScore'
    SoccerCondition:
      title: SoccerCondition
      description: Union of SoccerWeather and SoccerPitchCondition
      type: string
    SoccerUpdateReference:
      title: SoccerUpdateReference
      type: object
      properties:
        Clock:
          $ref: '#/components/schemas/SoccerFixtureClock'
        FreeKickType:
          $ref: '#/components/schemas/FreeKickType'
        GoalType:
          $ref: '#/components/schemas/GoalType'
        Minutes:
          type: integer
          format: int32
        Outcome:
          description: >-
            A string representing either a ShotOutcome, SoccerPenaltyOutcome, or
            InjuryOutcome
          type: string
        PlayerId:
          type: integer
          format: int32
        PlayerInId:
          type: integer
          format: int32
        PlayerOutId:
          type: integer
          format: int32
        ThrowInType:
          $ref: '#/components/schemas/ThrowInType'
        Type:
          type: string
    GoalType:
      title: GoalType
      oneOf:
        - $ref: '#/components/schemas/Head'
        - $ref: '#/components/schemas/Other'
        - $ref: '#/components/schemas/OwnGoal'
        - $ref: '#/components/schemas/Shot'
    SoccerVenueType:
      title: SoccerVenueType
      oneOf:
        - $ref: '#/components/schemas/Away'
        - $ref: '#/components/schemas/Home'
        - $ref: '#/components/schemas/Neutral'
    PlayerLineupData:
      title: PlayerLineupData
      type: object
      required:
        - fixturePlayerId
        - statusId
        - positionId
        - unitId
        - rosterNumber
        - starter
        - starred
        - player
      properties:
        fixturePlayerId:
          type: integer
          format: int32
        statusId:
          type: integer
          format: int32
        positionId:
          type: integer
          format: int32
        unitId:
          type: integer
          format: int32
        rosterNumber:
          type: string
        starter:
          type: boolean
        starred:
          type: boolean
        player:
          $ref: '#/components/schemas/PlayerData'
    AttackPossession:
      title: AttackPossession
      type: object
    DangerPossession:
      title: DangerPossession
      type: object
    HighDangerPossession:
      title: HighDangerPossession
      type: object
    SafePossession:
      title: SafePossession
      type: object
    SoccerPossiblePartiEvent:
      title: SoccerPossiblePartiEvent
      type: object
      required:
        - Goal
        - Penalty
        - Corner
      properties:
        Goal:
          type: boolean
        Penalty:
          type: boolean
        Corner:
          type: boolean
    UsFootballPossiblePartiEvent:
      title: UsFootballPossiblePartiEvent
      type: object
      required:
        - touchdown
        - fieldGoal
        - safety
        - 4thDownConversion
        - 2ptConversionAttempt
        - 1stDown
        - bigPlay
        - punt
      properties:
        touchdown:
          type: boolean
        fieldGoal:
          type: boolean
        safety:
          type: boolean
        4thDownConversion:
          type: boolean
        2ptConversionAttempt:
          type: boolean
        1stDown:
          type: boolean
        bigPlay:
          type: boolean
        punt:
          type: boolean
    Parti1:
      title: Parti1
      type: object
    Parti2:
      title: Parti2
      type: object
    Defensive:
      title: Defensive
      type: object
    Offensive:
      title: Offensive
      type: object
    Blocked:
      title: Blocked
      type: object
    Downed:
      title: Downed
      type: object
    FairCatch:
      title: FairCatch
      type: object
    FieldGoalMissed:
      title: FieldGoalMissed
      type: object
    FieldGoalSuccessful:
      title: FieldGoalSuccessful
      type: object
    Fumble:
      title: Fumble
      type: object
    OutOfBounds:
      title: OutOfBounds
      type: object
    PassComplete:
      title: PassComplete
      type: object
    PassIncomplete:
      title: PassIncomplete
      type: object
    PassIntercepted:
      title: PassIntercepted
      type: object
    PassSack:
      title: PassSack
      type: object
    Recovered:
      title: Recovered
      type: object
    Return:
      title: Return
      type: object
    RushComplete:
      title: RushComplete
      type: object
    Touchback:
      title: Touchback
      type: object
    Onside:
      title: Onside
      type: object
    Regular:
      title: Regular
      type: object
    ConversionSafety:
      title: ConversionSafety
      type: object
    DefensiveConversion:
      title: DefensiveConversion
      type: object
    Safety1Pt:
      title: Safety1Pt
      type: object
    Safety2Pt:
      title: Safety2Pt
      type: object
    UsFootballScore:
      title: UsFootballScore
      type: object
      required:
        - Score
        - Touchdown
        - Safety
        - 1ptSafety
        - 1ptConversion
        - 2ptConversion
        - FieldGoal
        - Defensive2ptConversion
      properties:
        Score:
          type: integer
          format: int32
        Touchdown:
          type: integer
          format: int32
        Safety:
          type: integer
          format: int32
        1ptSafety:
          type: integer
          format: int32
        1ptConversion:
          type: integer
          format: int32
        2ptConversion:
          type: integer
          format: int32
        FieldGoal:
          type: integer
          format: int32
        Defensive2ptConversion:
          type: integer
          format: int32
    Map_UsFootballScore:
      title: Map_UsFootballScore
      type: object
      additionalProperties:
        $ref: '#/components/schemas/UsFootballScore'
    PassOutcome:
      title: PassOutcome
      oneOf:
        - $ref: '#/components/schemas/Complete'
        - $ref: '#/components/schemas/Incomplete'
        - $ref: '#/components/schemas/Intercepted'
        - $ref: '#/components/schemas/Sack'
    Map_BasketballScore:
      title: Map_BasketballScore
      type: object
      additionalProperties:
        $ref: '#/components/schemas/BasketballScore'
    BasketballScore:
      title: BasketballScore
      type: object
      required:
        - Score
        - Fouls
        - PersonalFouls
        - Blocks
        - Rebounds
        - FreeThrows_made
        - 2pts_made
        - 3pts_made
        - FreeThrows_missed
        - 2pts_missed
        - 3pts_missed
        - FreeThrows_attempts
        - 2pts_attempts
        - 3pts_attempts
        - Assists
        - Turnovers
        - Steals
        - UsedTimeouts
      properties:
        Score:
          type: integer
          format: int32
        Fouls:
          type: integer
          format: int32
        PersonalFouls:
          type: integer
          format: int32
        Blocks:
          type: integer
          format: int32
        Rebounds:
          type: integer
          format: int32
        FreeThrows_made:
          type: integer
          format: int32
        2pts_made:
          type: integer
          format: int32
        3pts_made:
          type: integer
          format: int32
        FreeThrows_missed:
          type: integer
          format: int32
        2pts_missed:
          type: integer
          format: int32
        3pts_missed:
          type: integer
          format: int32
        FreeThrows_attempts:
          type: integer
          format: int32
        2pts_attempts:
          type: integer
          format: int32
        3pts_attempts:
          type: integer
          format: int32
        Assists:
          type: integer
          format: int32
        Turnovers:
          type: integer
          format: int32
        Steals:
          type: integer
          format: int32
        UsedTimeouts:
          type: integer
          format: int32
    SoccerScore:
      title: SoccerScore
      type: object
      required:
        - Goals
        - YellowCards
        - RedCards
        - Corners
      properties:
        Goals:
          type: integer
          format: int32
        YellowCards:
          type: integer
          format: int32
        RedCards:
          type: integer
          format: int32
        Corners:
          type: integer
          format: int32
    SoccerFixtureClock:
      title: SoccerFixtureClock
      type: object
      required:
        - running
        - seconds
      properties:
        running:
          type: boolean
        seconds:
          type: integer
          format: int32
    FreeKickType:
      title: FreeKickType
      oneOf:
        - $ref: '#/components/schemas/Attack'
        - $ref: '#/components/schemas/Danger'
        - $ref: '#/components/schemas/HighDanger'
        - $ref: '#/components/schemas/Offside'
        - $ref: '#/components/schemas/Safe'
    ThrowInType:
      title: ThrowInType
      oneOf:
        - $ref: '#/components/schemas/Attack'
        - $ref: '#/components/schemas/Danger'
        - $ref: '#/components/schemas/Safe'
    Head:
      title: Head
      type: object
    Other:
      title: Other
      type: object
    OwnGoal:
      title: OwnGoal
      type: object
    Shot:
      title: Shot
      type: object
    Away:
      title: Away
      type: object
    Home:
      title: Home
      type: object
    Neutral:
      title: Neutral
      type: object
    PlayerData:
      title: PlayerData
      type: object
      required:
        - id
        - normativeId
        - country
        - team
        - dateOfBirth
        - gender
        - preferredName
        - updateDateMillis
      properties:
        id:
          type: string
        normativeId:
          type: integer
          format: int32
        country:
          type: string
        team:
          type: string
        dateOfBirth:
          type: string
        gender:
          type: string
        preferredName:
          type: string
        updateDateMillis:
          type: integer
          format: int64
    Complete:
      title: Complete
      type: object
    Incomplete:
      title: Incomplete
      type: object
    Intercepted:
      title: Intercepted
      type: object
    Sack:
      title: Sack
      type: object
    Attack:
      title: Attack
      type: object
    Danger:
      title: Danger
      type: object
    HighDanger:
      title: HighDanger
      type: object
    Offside:
      title: Offside
      type: object
    Safe:
      title: Safe
      type: object
  securitySchemes:
    httpAuth:
      type: http
      description: User's session JWT.
      scheme: bearer
    apiKeyAuth:
      type: apiKey
      description: The user's long-lived API token, obtained from the activation endpoint.
      name: X-Api-Token
      in: header

````

> ## Documentation Index
> Fetch the complete documentation index at: https://txline-docs.txodds.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Get the sequence of score updates for a single fixture within the current 5-min interval

> Return a json array of all score updates for a single fixture included within the current 5-minute interval with live data if it exists.



## OpenAPI

````yaml https://txline.txodds.com/docs/docs.yaml get /api/scores/updates/{fixtureId}
openapi: 3.1.0
info:
  title: TxLINE off-chain API for the Hybrid on-chain/off-chain TxODDS Data system
  version: 1.5.2
  description: >

    ## Overview


    This API provides access to real-time and historical sports data from the
    **TxLINE on-chain/off-chain Data system**.


    It makes proprietary TxODDS available for any funded blockchain users by
    linking the on-chain `subscribe` transaction by issuing time-limited API
    tokens.

    - The data is canonicalised so that all fixtures, odds, or scores are
    provably identifiable and ordered--confirmed by on-chain cryptographic
    proofs.

    - The data is delivered in a request-response or Server-Sent Events (SSE)
    streaming form.


    Examples of accessing the accompanying on-chain program are available
    publicly at: https://txline.txodds.com/documentation.

    All data returned by the off-chain API is canonicalised such that every
    single record can be cryptographically proven on-chain to be

    part of the unique and consistent dataset generated by the TxODDS Data
    system.


    ## Key features


    * The odds data includes the `Stable Price` demargined prices and
    percentages, currently for key markets in European football (soccer).

    * **Free subscription option that offers World Cup 2026 odds and
    off-the-board signals in real-time sampled every 60 seconds**.

    * **Data access paid for by the TxLINE token tethered to USDT ata rate 1
    USDT = 1_000 TxLINE tokens** The TxLINE utility token can purchased using
    the associated Solana program.

    * **Fine-grained service level selection** The user can list the
    pre-configured **service levels** that either map to pre-defined league
    bundles or allow custom selecting the leagues explicitly.
     The price also depends on the sampling period for the data.
    * **Maximum subscription option that offers all leagues in real-time**.

    * **Historical Snapshots:** Query the latest state of any market at a
    specific point in time.

    * **Historical Updates:** Query the updates for any given key such as
    fixture or market for a given time period.

    * **Live Data Streams:** Real-time, low-latency data feeds using Server-Sent
    Events (SSE).

    * **On-chain Validation:** Retrieve Merkle proofs to cryptographically
    verify data against the on-chain held Merkle roots by calling appropriate
    validate on-chain instructions.


    ## How do the users gain access to off-chain data (see more details and
    examples at: https://github.com/txodds/tx-on-chain)


    1. For paid service tiers, the user purchases TxODDS TxLINE utility tokens
    for USDT at a fixed rate using either a script (e.g., calling
    `purchase_subscription_token_usdt`) or an affiliate website. The tokens are
    deposited into the user's associated token account. (Note: This step is
    skipped for the free World Cup tier).

    2. As a guest, with no prior authentication, the user calls the off-chain
    API at "https://oracle.txodds.com/auth/guest/start" (or `oracle-dev` for
    DevNet) to obtain an anonymous JWT with Guest claims. **Please note that the
    JWT token has 30 days  expiration so if you are issuing calls to the data
    endpoints beyond 30 days, you should either pre-acquire a new JWT token in
    time before 30 days expire or respond to the returned HTTP 401 code by
    reacquiring a fresh JWT token.**

    3. The user creates, signs, and confirms a Solana transaction to the
    `subscribe` instruction, indicating the duration in weeks (must be a
    multiple of 4 weeks, e.g. 4, 8, 12) and the chosen service level. The user
    explicitly acts as the transaction fee payer. For the free tier, the smart
    contract registers the subscription but charges 0 TxLINE tokens.

    4. The user records the confirmed transaction signature (`txSig`).

    5. The user constructs a strict message binding consisting of the `txSig`, a
    comma-separated list of selected leagues, and the JWT.

    6. The user cryptographically signs this message using their wallet's secret
    key to generate a detached signature, which is then Base64-encoded.

    7. The user activates the subscription with the off-chain server at
    "https://oracle.txodds.com/api/token/activate" (or `oracle-dev` for DevNet)
    by posting the `txSig`, the Base64 wallet signature, and the selected
    leagues array, using the JWT for authorization.

    8. The off-chain server validates the cryptographic proof and entitlements,
    issuing an appropriate API Token or rejecting the activation with a reason.

    9. The user calls the documented APIs while the subscription is valid,
    supplying both the JWT and the API Token.

    10. Before the subscription expires, the user may call the `subscribe`
    instruction again to extend the validity period (by a multiple of 4 weeks,
    e.g. 4, 8, 12) via the same off-chain activation call. The selected leagues
    can also be amended.

    11. If the previous subscription has expired, the user can activate a new
    API Token by repeating the process.
servers:
  - url: https://txline.txodds.com
    description: Production TxLINE server
  - url: http://txline-dev.txodds.com
    description: Test TxLINE server
security: []
paths:
  /api/scores/updates/{fixtureId}:
    get:
      tags:
        - Scores
      summary: >-
        Get the sequence of score updates for a single fixture within the
        current 5-min interval
      description: >-
        Return a json array of all score updates for a single fixture included
        within the current 5-minute interval with live data if it exists.
      operationId: getApiScoresUpdatesFixtureid
      parameters:
        - name: Authorization
          in: header
          description: Bearer token for the user's session JWT.
          required: true
          schema:
            type: string
        - name: X-Api-Token
          in: header
          description: The user's long-lived API token.
          required: true
          schema:
            type: string
        - name: fixtureId
          in: path
          description: The ID of the fixture to retrieve all updates for
          required: true
          schema:
            type: integer
            format: int64
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Scores'
        '400':
          description: >-
            Invalid value for: header Authorization, Invalid value for: header
            X-Api-Token, Invalid value for: path parameter fixtureId
          content:
            text/plain:
              schema:
                type: string
        '401':
          description: 'Authorization failed: Invalid or expired guest JWT'
          content:
            text/plain:
              schema:
                type: string
        '403':
          description: 'Access denied: Invalid API token or insufficient permissions'
          content:
            text/plain:
              schema:
                type: string
        '500':
          description: Internal server error
          content:
            text/plain:
              schema:
                type: string
      security:
        - httpAuth: []
          apiKeyAuth: []
components:
  schemas:
    Scores:
      title: Scores
      type: object
      required:
        - fixtureId
        - gameState
        - startTime
        - isTeam
        - fixtureGroupId
        - competitionId
        - countryId
        - sportId
        - participant1IsHome
        - participant2Id
        - participant1Id
        - action
        - id
        - ts
        - connectionId
        - seq
      properties:
        fixtureId:
          type: integer
          format: int32
        gameState:
          type: string
        startTime:
          type: integer
          format: int64
        isTeam:
          type: boolean
        fixtureGroupId:
          type: integer
          format: int32
        competitionId:
          type: integer
          format: int32
        countryId:
          type: integer
          format: int32
        sportId:
          type: integer
          format: int32
        participant1IsHome:
          type: boolean
        participant2Id:
          type: integer
          format: int32
        participant1Id:
          type: integer
          format: int32
        coverageSecondaryData:
          type: boolean
        coverageType:
          type: string
        action:
          type: string
        id:
          type: integer
          format: int32
        ts:
          type: integer
          format: int64
        connectionId:
          type: integer
          format: int64
        seq:
          type: integer
          format: int32
        statusId:
          $ref: '#/components/schemas/UsFootballFixtureStatus'
        statusBasketballId:
          $ref: '#/components/schemas/BasketballFixtureStatus'
        statusSoccerId:
          $ref: '#/components/schemas/SoccerFixtureStatus'
        type:
          $ref: '#/components/schemas/FixtureType'
        confirmed:
          type: boolean
        clock:
          $ref: '#/components/schemas/UsFootballFixtureClock'
        down:
          $ref: '#/components/schemas/UsFootballFixtureDown'
        inPlayInfo:
          $ref: '#/components/schemas/InPlayInfo'
        kickoffInfo:
          $ref: '#/components/schemas/KickoffInfo'
        score:
          $ref: '#/components/schemas/UsFootballFixtureScore'
        data:
          $ref: '#/components/schemas/UsFootballData'
        scoreBasketball:
          $ref: '#/components/schemas/BasketballFixtureScore'
        dataBasketball:
          $ref: '#/components/schemas/BasketballData'
        scoreSoccer:
          $ref: '#/components/schemas/SoccerFixtureScore'
        dataSoccer:
          $ref: '#/components/schemas/SoccerData'
        stats:
          $ref: '#/components/schemas/Map_ScoreStatKey'
        participant:
          type: integer
          format: int32
        kickoff:
          $ref: '#/components/schemas/KickoffDetails'
        lineups:
          type: array
          items:
            $ref: '#/components/schemas/LineupData'
        possession:
          type: integer
          format: int32
        possessionType:
          $ref: '#/components/schemas/SoccerPossessionType'
        parti1StateSoccer:
          $ref: '#/components/schemas/SoccerPartiState'
        parti1StateUsFootball:
          $ref: '#/components/schemas/UsFootballPartiState'
        parti1StateBasketball:
          $ref: '#/components/schemas/BasketballPartiState'
        parti2StateSoccer:
          $ref: '#/components/schemas/SoccerPartiState'
        parti2StateUsFootball:
          $ref: '#/components/schemas/UsFootballPartiState'
        parti2StateBasketball:
          $ref: '#/components/schemas/BasketballPartiState'
        possibleEventSoccer:
          $ref: '#/components/schemas/SoccerPossibleNeutralEvent'
        possibleEventUsFootball:
          $ref: '#/components/schemas/UsFootballPossibleEvent'
    UsFootballFixtureStatus:
      title: UsFootballFixtureStatus
      oneOf:
        - $ref: '#/components/schemas/A'
        - $ref: '#/components/schemas/C'
        - $ref: '#/components/schemas/F'
        - $ref: '#/components/schemas/FO'
        - $ref: '#/components/schemas/HT'
        - $ref: '#/components/schemas/I'
        - $ref: '#/components/schemas/NS'
        - $ref: '#/components/schemas/OB'
        - $ref: '#/components/schemas/OB1'
        - $ref: '#/components/schemas/OB10'
        - $ref: '#/components/schemas/OB11'
        - $ref: '#/components/schemas/OB2'
        - $ref: '#/components/schemas/OB3'
        - $ref: '#/components/schemas/OB4'
        - $ref: '#/components/schemas/OB5'
        - $ref: '#/components/schemas/OB6'
        - $ref: '#/components/schemas/OB7'
        - $ref: '#/components/schemas/OB8'
        - $ref: '#/components/schemas/OB9'
        - $ref: '#/components/schemas/OT'
        - $ref: '#/components/schemas/OT1'
        - $ref: '#/components/schemas/OT10'
        - $ref: '#/components/schemas/OT11'
        - $ref: '#/components/schemas/OT12'
        - $ref: '#/components/schemas/OT2'
        - $ref: '#/components/schemas/OT3'
        - $ref: '#/components/schemas/OT4'
        - $ref: '#/components/schemas/OT5'
        - $ref: '#/components/schemas/OT6'
        - $ref: '#/components/schemas/OT7'
        - $ref: '#/components/schemas/OT8'
        - $ref: '#/components/schemas/OT9'
        - $ref: '#/components/schemas/Q1'
        - $ref: '#/components/schemas/Q1B'
        - $ref: '#/components/schemas/Q2'
        - $ref: '#/components/schemas/Q3'
        - $ref: '#/components/schemas/Q3B'
        - $ref: '#/components/schemas/Q4'
        - $ref: '#/components/schemas/TXCC'
        - $ref: '#/components/schemas/TXCS'
        - $ref: '#/components/schemas/WO'
    BasketballFixtureStatus:
      title: BasketballFixtureStatus
      oneOf:
        - $ref: '#/components/schemas/A1'
        - $ref: '#/components/schemas/C1'
        - $ref: '#/components/schemas/F1'
        - $ref: '#/components/schemas/FO1'
        - $ref: '#/components/schemas/H1'
        - $ref: '#/components/schemas/H2'
        - $ref: '#/components/schemas/HT1'
        - $ref: '#/components/schemas/I1'
        - $ref: '#/components/schemas/NS1'
        - $ref: '#/components/schemas/OB12'
        - $ref: '#/components/schemas/OT13'
        - $ref: '#/components/schemas/Q11'
        - $ref: '#/components/schemas/Q1B1'
        - $ref: '#/components/schemas/Q21'
        - $ref: '#/components/schemas/Q31'
        - $ref: '#/components/schemas/Q3B1'
        - $ref: '#/components/schemas/Q41'
        - $ref: '#/components/schemas/TXCC1'
        - $ref: '#/components/schemas/TXCS1'
        - $ref: '#/components/schemas/WO1'
    SoccerFixtureStatus:
      title: SoccerFixtureStatus
      oneOf:
        - $ref: '#/components/schemas/A2'
        - $ref: '#/components/schemas/C2'
        - $ref: '#/components/schemas/ET1'
        - $ref: '#/components/schemas/ET2'
        - $ref: '#/components/schemas/F2'
        - $ref: '#/components/schemas/FET'
        - $ref: '#/components/schemas/FPE'
        - $ref: '#/components/schemas/H11'
        - $ref: '#/components/schemas/H21'
        - $ref: '#/components/schemas/HT2'
        - $ref: '#/components/schemas/HTET'
        - $ref: '#/components/schemas/I2'
        - $ref: '#/components/schemas/NS2'
        - $ref: '#/components/schemas/P'
        - $ref: '#/components/schemas/PE'
        - $ref: '#/components/schemas/TXCC2'
        - $ref: '#/components/schemas/TXCS2'
        - $ref: '#/components/schemas/WET'
        - $ref: '#/components/schemas/WPE'
    FixtureType:
      title: FixtureType
      oneOf:
        - $ref: '#/components/schemas/Basketball'
        - $ref: '#/components/schemas/Soccer'
        - $ref: '#/components/schemas/UsFootball'
    UsFootballFixtureClock:
      title: UsFootballFixtureClock
      type: object
      required:
        - running
        - seconds
      properties:
        running:
          type: boolean
        seconds:
          type: integer
          format: int32
    UsFootballFixtureDown:
      title: UsFootballFixtureDown
      type: object
      required:
        - number
        - yardsToGo
        - scrimmageLine
        - possession
        - side
      properties:
        number:
          type: integer
          format: int32
        yardsToGo:
          type: integer
          format: int32
        scrimmageLine:
          type: integer
          format: int32
        possession:
          $ref: '#/components/schemas/Participant'
        side:
          $ref: '#/components/schemas/Side'
    InPlayInfo:
      title: InPlayInfo
      type: object
      required:
        - BallSnapped
        - PlayersLiningUp
        - TimeoutParti1
        - TimeoutParti2
        - TVTimeout
      properties:
        BallSnapped:
          type: boolean
        PlayersLiningUp:
          type: boolean
        TimeoutParti1:
          type: boolean
        TimeoutParti2:
          type: boolean
        TVTimeout:
          type: boolean
        Outcome:
          $ref: '#/components/schemas/InPlayOutcome'
        NewSetOfDowns:
          type: boolean
        PenaltyIncreasedDown:
          type: boolean
        PreviousDown:
          $ref: '#/components/schemas/UsFootballFixtureDown'
    KickoffInfo:
      title: KickoffInfo
      type: object
      required:
        - Team
      properties:
        Team:
          $ref: '#/components/schemas/Participant'
        Type:
          $ref: '#/components/schemas/KickoffType'
        Outcome:
          $ref: '#/components/schemas/KickoffOutcome'
        KickoffPreviousAction:
          $ref: '#/components/schemas/KickoffSource'
        PenaltyYards:
          type: integer
          format: int32
    UsFootballFixtureScore:
      title: UsFootballFixtureScore
      type: object
      required:
        - Participant1
        - Participant2
      properties:
        Participant1:
          $ref: '#/components/schemas/UsFootballTotalScore'
        Participant2:
          $ref: '#/components/schemas/UsFootballTotalScore'
    UsFootballData:
      title: UsFootballData
      type: object
      properties:
        Action:
          type: string
        Active:
          type: boolean
        BigPlay:
          type: boolean
        Challenge:
          type: boolean
        Clock:
          $ref: '#/components/schemas/UsFootballFixtureClock'
        Down:
          type: string
        FieldGoal:
          type: boolean
        Id:
          type: integer
          format: int32
        IsTeam:
          type: boolean
        New:
          $ref: '#/components/schemas/UpdateReference'
        NewSetOfDowns:
          type: boolean
        Origin:
          type: string
        Outcome:
          type: string
        Participant:
          type: integer
          format: int32
        Participants:
          type: array
          items:
            type: integer
            format: int32
        PasserId:
          type: integer
          format: int32
        Penalty:
          type: boolean
        PlayerId:
          type: integer
          format: int32
        Posession:
          type: integer
          format: int32
        Previous:
          $ref: '#/components/schemas/UpdateReference'
        ReceiverId:
          type: integer
          format: int32
        ReplaceId:
          type: integer
          format: int32
        ReviewType:
          type: string
        RusherId:
          type: integer
          format: int32
        SackedPlayerId:
          type: integer
          format: int32
        Safety:
          type: boolean
        ScrimmageLine:
          type: integer
          format: int32
        Side:
          type: string
        Touchdown:
          type: boolean
        Turnover:
          type: boolean
        Type:
          type: string
        Yards:
          type: integer
          format: int32
        YardsToGo:
          type: integer
          format: int32
        YardsToEndzone:
          type: integer
          format: int32
    BasketballFixtureScore:
      title: BasketballFixtureScore
      type: object
      required:
        - Participant1
        - Participant2
      properties:
        Participant1:
          $ref: '#/components/schemas/BasketballTotalScore'
        Participant2:
          $ref: '#/components/schemas/BasketballTotalScore'
    BasketballData:
      title: BasketballData
      type: object
      properties:
        Action:
          type: string
        Active:
          type: boolean
        AssistConfirmed:
          type: boolean
        AssistId:
          type: integer
          format: int32
        BlockConfirmed:
          type: boolean
        BlockerId:
          type: integer
          format: int32
        Clock:
          $ref: '#/components/schemas/UsFootballFixtureClock'
        FouledId:
          type: integer
          format: int32
        Id:
          type: integer
          format: int32
        New:
          $ref: '#/components/schemas/BasketballUpdateReference'
        Outcome:
          type: string
        Previous:
          $ref: '#/components/schemas/BasketballUpdateReference'
        ReplaceId:
          type: integer
          format: int32
        Type:
          type: string
    SoccerFixtureScore:
      title: SoccerFixtureScore
      type: object
      required:
        - Participant1
        - Participant2
      properties:
        Participant1:
          $ref: '#/components/schemas/SoccerTotalScore'
        Participant2:
          $ref: '#/components/schemas/SoccerTotalScore'
    SoccerData:
      title: SoccerData
      type: object
      properties:
        Action:
          type: string
        Color:
          type: string
        Conditions:
          type: array
          items:
            $ref: '#/components/schemas/SoccerCondition'
        New:
          $ref: '#/components/schemas/SoccerUpdateReference'
        Corner:
          type: boolean
        FreeKickType:
          type: string
        Goal:
          type: boolean
        GoalType:
          $ref: '#/components/schemas/GoalType'
        Minutes:
          type: integer
          format: int32
        Outcome:
          type: string
        Participant:
          type: integer
          format: int32
        Penalty:
          type: boolean
        PlayerId:
          type: integer
          format: int32
        PlayerInId:
          type: integer
          format: int32
        PlayerOutId:
          type: integer
          format: int32
        Previous:
          $ref: '#/components/schemas/SoccerUpdateReference'
        StatusId:
          type: integer
          format: int32
        ThrowInType:
          type: string
        Type:
          type: string
        RedCard:
          type: boolean
        YellowCard:
          type: boolean
        VAR:
          type: boolean
        VenueType:
          $ref: '#/components/schemas/SoccerVenueType'
    Map_ScoreStatKey:
      title: Map_ScoreStatKey
      type: object
      additionalProperties:
        type: integer
        format: int32
    KickoffDetails:
      title: KickoffDetails
      type: object
      properties:
        Team:
          $ref: '#/components/schemas/Participant'
    LineupData:
      title: LineupData
      type: object
      required:
        - id
        - normativeId
        - preferredName
        - gender
        - updateDateMillis
      properties:
        id:
          type: string
        normativeId:
          type: integer
          format: int32
        preferredName:
          type: string
        gender:
          type: string
        updateDateMillis:
          type: integer
          format: int64
        lineups:
          type: array
          items:
            $ref: '#/components/schemas/PlayerLineupData'
    SoccerPossessionType:
      title: SoccerPossessionType
      oneOf:
        - $ref: '#/components/schemas/AttackPossession'
        - $ref: '#/components/schemas/DangerPossession'
        - $ref: '#/components/schemas/HighDangerPossession'
        - $ref: '#/components/schemas/SafePossession'
    SoccerPartiState:
      title: SoccerPartiState
      type: object
      required:
        - PossibleEvent
      properties:
        PossibleEvent:
          $ref: '#/components/schemas/SoccerPossiblePartiEvent'
    UsFootballPartiState:
      title: UsFootballPartiState
      type: object
      required:
        - Timeouts
        - Challenges
        - PossibleEvent
      properties:
        Timeouts:
          type: integer
          format: int32
        Challenges:
          type: integer
          format: int32
        PossibleEvent:
          $ref: '#/components/schemas/UsFootballPossiblePartiEvent'
    BasketballPartiState:
      title: BasketballPartiState
      type: object
      required:
        - AttackingBasket
        - ActiveTimeout
        - Challenges
      properties:
        AttackingBasket:
          type: boolean
        ActiveTimeout:
          type: boolean
        Challenges:
          type: integer
          format: int32
    SoccerPossibleNeutralEvent:
      title: SoccerPossibleNeutralEvent
      type: object
      required:
        - RedCard
        - YellowCard
        - VAR
      properties:
        RedCard:
          type: boolean
        YellowCard:
          type: boolean
        VAR:
          type: boolean
    UsFootballPossibleEvent:
      title: UsFootballPossibleEvent
      type: object
      required:
        - penalty
        - turnover
        - challenge
      properties:
        penalty:
          type: boolean
        turnover:
          type: boolean
        challenge:
          type: boolean
    A:
      title: A
      type: object
    C:
      title: C
      type: object
    F:
      title: F
      type: object
    FO:
      title: FO
      type: object
    HT:
      title: HT
      type: object
    I:
      title: I
      type: object
    NS:
      title: NS
      type: object
    OB:
      title: OB
      type: object
    OB1:
      title: OB1
      type: object
    OB10:
      title: OB10
      type: object
    OB11:
      title: OB11
      type: object
    OB2:
      title: OB2
      type: object
    OB3:
      title: OB3
      type: object
    OB4:
      title: OB4
      type: object
    OB5:
      title: OB5
      type: object
    OB6:
      title: OB6
      type: object
    OB7:
      title: OB7
      type: object
    OB8:
      title: OB8
      type: object
    OB9:
      title: OB9
      type: object
    OT:
      title: OT
      type: object
    OT1:
      title: OT1
      type: object
    OT10:
      title: OT10
      type: object
    OT11:
      title: OT11
      type: object
    OT12:
      title: OT12
      type: object
    OT2:
      title: OT2
      type: object
    OT3:
      title: OT3
      type: object
    OT4:
      title: OT4
      type: object
    OT5:
      title: OT5
      type: object
    OT6:
      title: OT6
      type: object
    OT7:
      title: OT7
      type: object
    OT8:
      title: OT8
      type: object
    OT9:
      title: OT9
      type: object
    Q1:
      title: Q1
      type: object
    Q1B:
      title: Q1B
      type: object
    Q2:
      title: Q2
      type: object
    Q3:
      title: Q3
      type: object
    Q3B:
      title: Q3B
      type: object
    Q4:
      title: Q4
      type: object
    TXCC:
      title: TXCC
      type: object
    TXCS:
      title: TXCS
      type: object
    WO:
      title: WO
      type: object
    A1:
      title: A
      type: object
    C1:
      title: C
      type: object
    F1:
      title: F
      type: object
    FO1:
      title: FO
      type: object
    H1:
      title: H1
      type: object
    H2:
      title: H2
      type: object
    HT1:
      title: HT
      type: object
    I1:
      title: I
      type: object
    NS1:
      title: NS
      type: object
    OB12:
      title: OB
      type: object
    OT13:
      title: OT
      type: object
    Q11:
      title: Q1
      type: object
    Q1B1:
      title: Q1B
      type: object
    Q21:
      title: Q2
      type: object
    Q31:
      title: Q3
      type: object
    Q3B1:
      title: Q3B
      type: object
    Q41:
      title: Q4
      type: object
    TXCC1:
      title: TXCC
      type: object
    TXCS1:
      title: TXCS
      type: object
    WO1:
      title: WO
      type: object
    A2:
      title: A
      type: object
    C2:
      title: C
      type: object
    ET1:
      title: ET1
      type: object
    ET2:
      title: ET2
      type: object
    F2:
      title: F
      type: object
    FET:
      title: FET
      type: object
    FPE:
      title: FPE
      type: object
    H11:
      title: H1
      type: object
    H21:
      title: H2
      type: object
    HT2:
      title: HT
      type: object
    HTET:
      title: HTET
      type: object
    I2:
      title: I
      type: object
    NS2:
      title: NS
      type: object
    P:
      title: P
      type: object
    PE:
      title: PE
      type: object
    TXCC2:
      title: TXCC
      type: object
    TXCS2:
      title: TXCS
      type: object
    WET:
      title: WET
      type: object
    WPE:
      title: WPE
      type: object
    Basketball:
      title: Basketball
      type: object
    Soccer:
      title: Soccer
      type: object
    UsFootball:
      title: UsFootball
      type: object
    Participant:
      title: Participant
      oneOf:
        - $ref: '#/components/schemas/Parti1'
        - $ref: '#/components/schemas/Parti2'
    Side:
      title: Side
      oneOf:
        - $ref: '#/components/schemas/Defensive'
        - $ref: '#/components/schemas/Offensive'
    InPlayOutcome:
      title: InPlayOutcome
      oneOf:
        - $ref: '#/components/schemas/Blocked'
        - $ref: '#/components/schemas/Downed'
        - $ref: '#/components/schemas/FairCatch'
        - $ref: '#/components/schemas/FieldGoalMissed'
        - $ref: '#/components/schemas/FieldGoalSuccessful'
        - $ref: '#/components/schemas/Fumble'
        - $ref: '#/components/schemas/OutOfBounds'
        - $ref: '#/components/schemas/PassComplete'
        - $ref: '#/components/schemas/PassIncomplete'
        - $ref: '#/components/schemas/PassIntercepted'
        - $ref: '#/components/schemas/PassSack'
        - $ref: '#/components/schemas/Recovered'
        - $ref: '#/components/schemas/Return'
        - $ref: '#/components/schemas/RushComplete'
        - $ref: '#/components/schemas/Touchback'
    KickoffType:
      title: KickoffType
      oneOf:
        - $ref: '#/components/schemas/Onside'
        - $ref: '#/components/schemas/Regular'
    KickoffOutcome:
      title: KickoffOutcome
      oneOf:
        - $ref: '#/components/schemas/FairCatch'
        - $ref: '#/components/schemas/Fumble'
        - $ref: '#/components/schemas/OutOfBounds'
        - $ref: '#/components/schemas/Recovered'
        - $ref: '#/components/schemas/Return'
        - $ref: '#/components/schemas/Touchback'
    KickoffSource:
      title: KickoffSource
      oneOf:
        - $ref: '#/components/schemas/ConversionSafety'
        - $ref: '#/components/schemas/DefensiveConversion'
        - $ref: '#/components/schemas/Safety1Pt'
        - $ref: '#/components/schemas/Safety2Pt'
    UsFootballTotalScore:
      title: UsFootballTotalScore
      type: object
      properties:
        Q1:
          $ref: '#/components/schemas/UsFootballScore'
        Q2:
          $ref: '#/components/schemas/UsFootballScore'
        HT:
          $ref: '#/components/schemas/UsFootballScore'
        Q3:
          $ref: '#/components/schemas/UsFootballScore'
        Q4:
          $ref: '#/components/schemas/UsFootballScore'
        OT:
          $ref: '#/components/schemas/Map_UsFootballScore'
        OTTotal:
          $ref: '#/components/schemas/UsFootballScore'
        Total:
          $ref: '#/components/schemas/UsFootballScore'
    UpdateReference:
      title: UpdateReference
      type: object
      properties:
        Clock:
          $ref: '#/components/schemas/UsFootballFixtureClock'
        IsTeam:
          type: boolean
        Outcome:
          $ref: '#/components/schemas/PassOutcome'
        PlayerId:
          type: integer
          format: int32
        ReceiverId:
          type: integer
          format: int32
        RusherId:
          type: integer
          format: int32
        SackedPlayerId:
          type: integer
          format: int32
        Yards:
          type: integer
          format: int32
        YardsToGo:
          type: integer
          format: int32
    BasketballTotalScore:
      title: BasketballTotalScore
      type: object
      properties:
        Period:
          $ref: '#/components/schemas/Map_BasketballScore'
        HT:
          $ref: '#/components/schemas/BasketballScore'
        OT:
          $ref: '#/components/schemas/Map_BasketballScore'
        OTTotal:
          $ref: '#/components/schemas/BasketballScore'
        Total:
          $ref: '#/components/schemas/BasketballScore'
    BasketballUpdateReference:
      title: BasketballUpdateReference
      type: object
      properties:
        AssistConfirmed:
          type: boolean
        AssistId:
          type: integer
          format: int32
        BlockConfirmed:
          type: boolean
        BlockerId:
          type: integer
          format: int32
        Clock:
          $ref: '#/components/schemas/UsFootballFixtureClock'
        FouledId:
          type: integer
          format: int32
        IsPlayerRebound:
          type: boolean
        IsTeam:
          type: boolean
        IsTeamRebound:
          type: boolean
        Outcome:
          description: Union of PointAttemptOutcome and FreeThrowOutcome
          type: string
        Participant:
          type: integer
          format: int32
        PlayerId:
          type: integer
          format: int32
        PlayerInId:
          type: integer
          format: int32
        PlayerOutId:
          type: integer
          format: int32
        TeamFoul:
          type: boolean
        TurnoverId:
          type: integer
          format: int32
        Type:
          description: Union of FoulType, ReboundType, and FreeThrowType
          type: string
        UpdatePlayersOnCourt:
          type: boolean
    SoccerTotalScore:
      title: SoccerTotalScore
      type: object
      properties:
        H1:
          $ref: '#/components/schemas/SoccerScore'
        HT:
          $ref: '#/components/schemas/SoccerScore'
        H2:
          $ref: '#/components/schemas/SoccerScore'
        ET1:
          $ref: '#/components/schemas/SoccerScore'
        ET2:
          $ref: '#/components/schemas/SoccerScore'
        PE:
          $ref: '#/components/schemas/SoccerScore'
        ETTotal:
          $ref: '#/components/schemas/SoccerScore'
        Total:
          $ref: '#/components/schemas/SoccerScore'
    SoccerCondition:
      title: SoccerCondition
      description: Union of SoccerWeather and SoccerPitchCondition
      type: string
    SoccerUpdateReference:
      title: SoccerUpdateReference
      type: object
      properties:
        Clock:
          $ref: '#/components/schemas/SoccerFixtureClock'
        FreeKickType:
          $ref: '#/components/schemas/FreeKickType'
        GoalType:
          $ref: '#/components/schemas/GoalType'
        Minutes:
          type: integer
          format: int32
        Outcome:
          description: >-
            A string representing either a ShotOutcome, SoccerPenaltyOutcome, or
            InjuryOutcome
          type: string
        PlayerId:
          type: integer
          format: int32
        PlayerInId:
          type: integer
          format: int32
        PlayerOutId:
          type: integer
          format: int32
        ThrowInType:
          $ref: '#/components/schemas/ThrowInType'
        Type:
          type: string
    GoalType:
      title: GoalType
      oneOf:
        - $ref: '#/components/schemas/Head'
        - $ref: '#/components/schemas/Other'
        - $ref: '#/components/schemas/OwnGoal'
        - $ref: '#/components/schemas/Shot'
    SoccerVenueType:
      title: SoccerVenueType
      oneOf:
        - $ref: '#/components/schemas/Away'
        - $ref: '#/components/schemas/Home'
        - $ref: '#/components/schemas/Neutral'
    PlayerLineupData:
      title: PlayerLineupData
      type: object
      required:
        - fixturePlayerId
        - statusId
        - positionId
        - unitId
        - rosterNumber
        - starter
        - starred
        - player
      properties:
        fixturePlayerId:
          type: integer
          format: int32
        statusId:
          type: integer
          format: int32
        positionId:
          type: integer
          format: int32
        unitId:
          type: integer
          format: int32
        rosterNumber:
          type: string
        starter:
          type: boolean
        starred:
          type: boolean
        player:
          $ref: '#/components/schemas/PlayerData'
    AttackPossession:
      title: AttackPossession
      type: object
    DangerPossession:
      title: DangerPossession
      type: object
    HighDangerPossession:
      title: HighDangerPossession
      type: object
    SafePossession:
      title: SafePossession
      type: object
    SoccerPossiblePartiEvent:
      title: SoccerPossiblePartiEvent
      type: object
      required:
        - Goal
        - Penalty
        - Corner
      properties:
        Goal:
          type: boolean
        Penalty:
          type: boolean
        Corner:
          type: boolean
    UsFootballPossiblePartiEvent:
      title: UsFootballPossiblePartiEvent
      type: object
      required:
        - touchdown
        - fieldGoal
        - safety
        - 4thDownConversion
        - 2ptConversionAttempt
        - 1stDown
        - bigPlay
        - punt
      properties:
        touchdown:
          type: boolean
        fieldGoal:
          type: boolean
        safety:
          type: boolean
        4thDownConversion:
          type: boolean
        2ptConversionAttempt:
          type: boolean
        1stDown:
          type: boolean
        bigPlay:
          type: boolean
        punt:
          type: boolean
    Parti1:
      title: Parti1
      type: object
    Parti2:
      title: Parti2
      type: object
    Defensive:
      title: Defensive
      type: object
    Offensive:
      title: Offensive
      type: object
    Blocked:
      title: Blocked
      type: object
    Downed:
      title: Downed
      type: object
    FairCatch:
      title: FairCatch
      type: object
    FieldGoalMissed:
      title: FieldGoalMissed
      type: object
    FieldGoalSuccessful:
      title: FieldGoalSuccessful
      type: object
    Fumble:
      title: Fumble
      type: object
    OutOfBounds:
      title: OutOfBounds
      type: object
    PassComplete:
      title: PassComplete
      type: object
    PassIncomplete:
      title: PassIncomplete
      type: object
    PassIntercepted:
      title: PassIntercepted
      type: object
    PassSack:
      title: PassSack
      type: object
    Recovered:
      title: Recovered
      type: object
    Return:
      title: Return
      type: object
    RushComplete:
      title: RushComplete
      type: object
    Touchback:
      title: Touchback
      type: object
    Onside:
      title: Onside
      type: object
    Regular:
      title: Regular
      type: object
    ConversionSafety:
      title: ConversionSafety
      type: object
    DefensiveConversion:
      title: DefensiveConversion
      type: object
    Safety1Pt:
      title: Safety1Pt
      type: object
    Safety2Pt:
      title: Safety2Pt
      type: object
    UsFootballScore:
      title: UsFootballScore
      type: object
      required:
        - Score
        - Touchdown
        - Safety
        - 1ptSafety
        - 1ptConversion
        - 2ptConversion
        - FieldGoal
        - Defensive2ptConversion
      properties:
        Score:
          type: integer
          format: int32
        Touchdown:
          type: integer
          format: int32
        Safety:
          type: integer
          format: int32
        1ptSafety:
          type: integer
          format: int32
        1ptConversion:
          type: integer
          format: int32
        2ptConversion:
          type: integer
          format: int32
        FieldGoal:
          type: integer
          format: int32
        Defensive2ptConversion:
          type: integer
          format: int32
    Map_UsFootballScore:
      title: Map_UsFootballScore
      type: object
      additionalProperties:
        $ref: '#/components/schemas/UsFootballScore'
    PassOutcome:
      title: PassOutcome
      oneOf:
        - $ref: '#/components/schemas/Complete'
        - $ref: '#/components/schemas/Incomplete'
        - $ref: '#/components/schemas/Intercepted'
        - $ref: '#/components/schemas/Sack'
    Map_BasketballScore:
      title: Map_BasketballScore
      type: object
      additionalProperties:
        $ref: '#/components/schemas/BasketballScore'
    BasketballScore:
      title: BasketballScore
      type: object
      required:
        - Score
        - Fouls
        - PersonalFouls
        - Blocks
        - Rebounds
        - FreeThrows_made
        - 2pts_made
        - 3pts_made
        - FreeThrows_missed
        - 2pts_missed
        - 3pts_missed
        - FreeThrows_attempts
        - 2pts_attempts
        - 3pts_attempts
        - Assists
        - Turnovers
        - Steals
        - UsedTimeouts
      properties:
        Score:
          type: integer
          format: int32
        Fouls:
          type: integer
          format: int32
        PersonalFouls:
          type: integer
          format: int32
        Blocks:
          type: integer
          format: int32
        Rebounds:
          type: integer
          format: int32
        FreeThrows_made:
          type: integer
          format: int32
        2pts_made:
          type: integer
          format: int32
        3pts_made:
          type: integer
          format: int32
        FreeThrows_missed:
          type: integer
          format: int32
        2pts_missed:
          type: integer
          format: int32
        3pts_missed:
          type: integer
          format: int32
        FreeThrows_attempts:
          type: integer
          format: int32
        2pts_attempts:
          type: integer
          format: int32
        3pts_attempts:
          type: integer
          format: int32
        Assists:
          type: integer
          format: int32
        Turnovers:
          type: integer
          format: int32
        Steals:
          type: integer
          format: int32
        UsedTimeouts:
          type: integer
          format: int32
    SoccerScore:
      title: SoccerScore
      type: object
      required:
        - Goals
        - YellowCards
        - RedCards
        - Corners
      properties:
        Goals:
          type: integer
          format: int32
        YellowCards:
          type: integer
          format: int32
        RedCards:
          type: integer
          format: int32
        Corners:
          type: integer
          format: int32
    SoccerFixtureClock:
      title: SoccerFixtureClock
      type: object
      required:
        - running
        - seconds
      properties:
        running:
          type: boolean
        seconds:
          type: integer
          format: int32
    FreeKickType:
      title: FreeKickType
      oneOf:
        - $ref: '#/components/schemas/Attack'
        - $ref: '#/components/schemas/Danger'
        - $ref: '#/components/schemas/HighDanger'
        - $ref: '#/components/schemas/Offside'
        - $ref: '#/components/schemas/Safe'
    ThrowInType:
      title: ThrowInType
      oneOf:
        - $ref: '#/components/schemas/Attack'
        - $ref: '#/components/schemas/Danger'
        - $ref: '#/components/schemas/Safe'
    Head:
      title: Head
      type: object
    Other:
      title: Other
      type: object
    OwnGoal:
      title: OwnGoal
      type: object
    Shot:
      title: Shot
      type: object
    Away:
      title: Away
      type: object
    Home:
      title: Home
      type: object
    Neutral:
      title: Neutral
      type: object
    PlayerData:
      title: PlayerData
      type: object
      required:
        - id
        - normativeId
        - country
        - team
        - dateOfBirth
        - gender
        - preferredName
        - updateDateMillis
      properties:
        id:
          type: string
        normativeId:
          type: integer
          format: int32
        country:
          type: string
        team:
          type: string
        dateOfBirth:
          type: string
        gender:
          type: string
        preferredName:
          type: string
        updateDateMillis:
          type: integer
          format: int64
    Complete:
      title: Complete
      type: object
    Incomplete:
      title: Incomplete
      type: object
    Intercepted:
      title: Intercepted
      type: object
    Sack:
      title: Sack
      type: object
    Attack:
      title: Attack
      type: object
    Danger:
      title: Danger
      type: object
    HighDanger:
      title: HighDanger
      type: object
    Offside:
      title: Offside
      type: object
    Safe:
      title: Safe
      type: object
  securitySchemes:
    httpAuth:
      type: http
      description: User's session JWT.
      scheme: bearer
    apiKeyAuth:
      type: apiKey
      description: The user's long-lived API token, obtained from the activation endpoint.
      name: X-Api-Token
      in: header

````

> ## Documentation Index
> Fetch the complete documentation index at: https://txline-docs.txodds.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Get the full sequence of score updates for a single fixture

> Return a json array of all score updates for a single fixture provided its start time is between two weeks and six hours in the past from current time.



## OpenAPI

````yaml https://txline.txodds.com/docs/docs.yaml get /api/scores/historical/{fixtureId}
openapi: 3.1.0
info:
  title: TxLINE off-chain API for the Hybrid on-chain/off-chain TxODDS Data system
  version: 1.5.2
  description: >

    ## Overview


    This API provides access to real-time and historical sports data from the
    **TxLINE on-chain/off-chain Data system**.


    It makes proprietary TxODDS available for any funded blockchain users by
    linking the on-chain `subscribe` transaction by issuing time-limited API
    tokens.

    - The data is canonicalised so that all fixtures, odds, or scores are
    provably identifiable and ordered--confirmed by on-chain cryptographic
    proofs.

    - The data is delivered in a request-response or Server-Sent Events (SSE)
    streaming form.


    Examples of accessing the accompanying on-chain program are available
    publicly at: https://txline.txodds.com/documentation.

    All data returned by the off-chain API is canonicalised such that every
    single record can be cryptographically proven on-chain to be

    part of the unique and consistent dataset generated by the TxODDS Data
    system.


    ## Key features


    * The odds data includes the `Stable Price` demargined prices and
    percentages, currently for key markets in European football (soccer).

    * **Free subscription option that offers World Cup 2026 odds and
    off-the-board signals in real-time sampled every 60 seconds**.

    * **Data access paid for by the TxLINE token tethered to USDT ata rate 1
    USDT = 1_000 TxLINE tokens** The TxLINE utility token can purchased using
    the associated Solana program.

    * **Fine-grained service level selection** The user can list the
    pre-configured **service levels** that either map to pre-defined league
    bundles or allow custom selecting the leagues explicitly.
     The price also depends on the sampling period for the data.
    * **Maximum subscription option that offers all leagues in real-time**.

    * **Historical Snapshots:** Query the latest state of any market at a
    specific point in time.

    * **Historical Updates:** Query the updates for any given key such as
    fixture or market for a given time period.

    * **Live Data Streams:** Real-time, low-latency data feeds using Server-Sent
    Events (SSE).

    * **On-chain Validation:** Retrieve Merkle proofs to cryptographically
    verify data against the on-chain held Merkle roots by calling appropriate
    validate on-chain instructions.


    ## How do the users gain access to off-chain data (see more details and
    examples at: https://github.com/txodds/tx-on-chain)


    1. For paid service tiers, the user purchases TxODDS TxLINE utility tokens
    for USDT at a fixed rate using either a script (e.g., calling
    `purchase_subscription_token_usdt`) or an affiliate website. The tokens are
    deposited into the user's associated token account. (Note: This step is
    skipped for the free World Cup tier).

    2. As a guest, with no prior authentication, the user calls the off-chain
    API at "https://oracle.txodds.com/auth/guest/start" (or `oracle-dev` for
    DevNet) to obtain an anonymous JWT with Guest claims. **Please note that the
    JWT token has 30 days  expiration so if you are issuing calls to the data
    endpoints beyond 30 days, you should either pre-acquire a new JWT token in
    time before 30 days expire or respond to the returned HTTP 401 code by
    reacquiring a fresh JWT token.**

    3. The user creates, signs, and confirms a Solana transaction to the
    `subscribe` instruction, indicating the duration in weeks (must be a
    multiple of 4 weeks, e.g. 4, 8, 12) and the chosen service level. The user
    explicitly acts as the transaction fee payer. For the free tier, the smart
    contract registers the subscription but charges 0 TxLINE tokens.

    4. The user records the confirmed transaction signature (`txSig`).

    5. The user constructs a strict message binding consisting of the `txSig`, a
    comma-separated list of selected leagues, and the JWT.

    6. The user cryptographically signs this message using their wallet's secret
    key to generate a detached signature, which is then Base64-encoded.

    7. The user activates the subscription with the off-chain server at
    "https://oracle.txodds.com/api/token/activate" (or `oracle-dev` for DevNet)
    by posting the `txSig`, the Base64 wallet signature, and the selected
    leagues array, using the JWT for authorization.

    8. The off-chain server validates the cryptographic proof and entitlements,
    issuing an appropriate API Token or rejecting the activation with a reason.

    9. The user calls the documented APIs while the subscription is valid,
    supplying both the JWT and the API Token.

    10. Before the subscription expires, the user may call the `subscribe`
    instruction again to extend the validity period (by a multiple of 4 weeks,
    e.g. 4, 8, 12) via the same off-chain activation call. The selected leagues
    can also be amended.

    11. If the previous subscription has expired, the user can activate a new
    API Token by repeating the process.
servers:
  - url: https://txline.txodds.com
    description: Production TxLINE server
  - url: http://txline-dev.txodds.com
    description: Test TxLINE server
security: []
paths:
  /api/scores/historical/{fixtureId}:
    get:
      tags:
        - Scores
      summary: Get the full sequence of score updates for a single fixture
      description: >-
        Return a json array of all score updates for a single fixture provided
        its start time is between two weeks and six hours in the past from
        current time.
      operationId: getApiScoresHistoricalFixtureid
      parameters:
        - name: Authorization
          in: header
          description: Bearer token for the user's session JWT.
          required: true
          schema:
            type: string
        - name: X-Api-Token
          in: header
          description: The user's long-lived API token.
          required: true
          schema:
            type: string
        - name: fixtureId
          in: path
          description: The ID of the fixture to retrieve all updates for
          required: true
          schema:
            type: integer
            format: int64
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Scores'
        '400':
          description: >-
            Invalid value for: header Authorization, Invalid value for: header
            X-Api-Token, Invalid value for: path parameter fixtureId
          content:
            text/plain:
              schema:
                type: string
        '401':
          description: 'Authorization failed: Invalid or expired guest JWT'
          content:
            text/plain:
              schema:
                type: string
        '403':
          description: 'Access denied: Invalid API token or insufficient permissions'
          content:
            text/plain:
              schema:
                type: string
        '500':
          description: Internal server error
          content:
            text/plain:
              schema:
                type: string
      security:
        - httpAuth: []
          apiKeyAuth: []
components:
  schemas:
    Scores:
      title: Scores
      type: object
      required:
        - fixtureId
        - gameState
        - startTime
        - isTeam
        - fixtureGroupId
        - competitionId
        - countryId
        - sportId
        - participant1IsHome
        - participant2Id
        - participant1Id
        - action
        - id
        - ts
        - connectionId
        - seq
      properties:
        fixtureId:
          type: integer
          format: int32
        gameState:
          type: string
        startTime:
          type: integer
          format: int64
        isTeam:
          type: boolean
        fixtureGroupId:
          type: integer
          format: int32
        competitionId:
          type: integer
          format: int32
        countryId:
          type: integer
          format: int32
        sportId:
          type: integer
          format: int32
        participant1IsHome:
          type: boolean
        participant2Id:
          type: integer
          format: int32
        participant1Id:
          type: integer
          format: int32
        coverageSecondaryData:
          type: boolean
        coverageType:
          type: string
        action:
          type: string
        id:
          type: integer
          format: int32
        ts:
          type: integer
          format: int64
        connectionId:
          type: integer
          format: int64
        seq:
          type: integer
          format: int32
        statusId:
          $ref: '#/components/schemas/UsFootballFixtureStatus'
        statusBasketballId:
          $ref: '#/components/schemas/BasketballFixtureStatus'
        statusSoccerId:
          $ref: '#/components/schemas/SoccerFixtureStatus'
        type:
          $ref: '#/components/schemas/FixtureType'
        confirmed:
          type: boolean
        clock:
          $ref: '#/components/schemas/UsFootballFixtureClock'
        down:
          $ref: '#/components/schemas/UsFootballFixtureDown'
        inPlayInfo:
          $ref: '#/components/schemas/InPlayInfo'
        kickoffInfo:
          $ref: '#/components/schemas/KickoffInfo'
        score:
          $ref: '#/components/schemas/UsFootballFixtureScore'
        data:
          $ref: '#/components/schemas/UsFootballData'
        scoreBasketball:
          $ref: '#/components/schemas/BasketballFixtureScore'
        dataBasketball:
          $ref: '#/components/schemas/BasketballData'
        scoreSoccer:
          $ref: '#/components/schemas/SoccerFixtureScore'
        dataSoccer:
          $ref: '#/components/schemas/SoccerData'
        stats:
          $ref: '#/components/schemas/Map_ScoreStatKey'
        participant:
          type: integer
          format: int32
        kickoff:
          $ref: '#/components/schemas/KickoffDetails'
        lineups:
          type: array
          items:
            $ref: '#/components/schemas/LineupData'
        possession:
          type: integer
          format: int32
        possessionType:
          $ref: '#/components/schemas/SoccerPossessionType'
        parti1StateSoccer:
          $ref: '#/components/schemas/SoccerPartiState'
        parti1StateUsFootball:
          $ref: '#/components/schemas/UsFootballPartiState'
        parti1StateBasketball:
          $ref: '#/components/schemas/BasketballPartiState'
        parti2StateSoccer:
          $ref: '#/components/schemas/SoccerPartiState'
        parti2StateUsFootball:
          $ref: '#/components/schemas/UsFootballPartiState'
        parti2StateBasketball:
          $ref: '#/components/schemas/BasketballPartiState'
        possibleEventSoccer:
          $ref: '#/components/schemas/SoccerPossibleNeutralEvent'
        possibleEventUsFootball:
          $ref: '#/components/schemas/UsFootballPossibleEvent'
    UsFootballFixtureStatus:
      title: UsFootballFixtureStatus
      oneOf:
        - $ref: '#/components/schemas/A'
        - $ref: '#/components/schemas/C'
        - $ref: '#/components/schemas/F'
        - $ref: '#/components/schemas/FO'
        - $ref: '#/components/schemas/HT'
        - $ref: '#/components/schemas/I'
        - $ref: '#/components/schemas/NS'
        - $ref: '#/components/schemas/OB'
        - $ref: '#/components/schemas/OB1'
        - $ref: '#/components/schemas/OB10'
        - $ref: '#/components/schemas/OB11'
        - $ref: '#/components/schemas/OB2'
        - $ref: '#/components/schemas/OB3'
        - $ref: '#/components/schemas/OB4'
        - $ref: '#/components/schemas/OB5'
        - $ref: '#/components/schemas/OB6'
        - $ref: '#/components/schemas/OB7'
        - $ref: '#/components/schemas/OB8'
        - $ref: '#/components/schemas/OB9'
        - $ref: '#/components/schemas/OT'
        - $ref: '#/components/schemas/OT1'
        - $ref: '#/components/schemas/OT10'
        - $ref: '#/components/schemas/OT11'
        - $ref: '#/components/schemas/OT12'
        - $ref: '#/components/schemas/OT2'
        - $ref: '#/components/schemas/OT3'
        - $ref: '#/components/schemas/OT4'
        - $ref: '#/components/schemas/OT5'
        - $ref: '#/components/schemas/OT6'
        - $ref: '#/components/schemas/OT7'
        - $ref: '#/components/schemas/OT8'
        - $ref: '#/components/schemas/OT9'
        - $ref: '#/components/schemas/Q1'
        - $ref: '#/components/schemas/Q1B'
        - $ref: '#/components/schemas/Q2'
        - $ref: '#/components/schemas/Q3'
        - $ref: '#/components/schemas/Q3B'
        - $ref: '#/components/schemas/Q4'
        - $ref: '#/components/schemas/TXCC'
        - $ref: '#/components/schemas/TXCS'
        - $ref: '#/components/schemas/WO'
    BasketballFixtureStatus:
      title: BasketballFixtureStatus
      oneOf:
        - $ref: '#/components/schemas/A1'
        - $ref: '#/components/schemas/C1'
        - $ref: '#/components/schemas/F1'
        - $ref: '#/components/schemas/FO1'
        - $ref: '#/components/schemas/H1'
        - $ref: '#/components/schemas/H2'
        - $ref: '#/components/schemas/HT1'
        - $ref: '#/components/schemas/I1'
        - $ref: '#/components/schemas/NS1'
        - $ref: '#/components/schemas/OB12'
        - $ref: '#/components/schemas/OT13'
        - $ref: '#/components/schemas/Q11'
        - $ref: '#/components/schemas/Q1B1'
        - $ref: '#/components/schemas/Q21'
        - $ref: '#/components/schemas/Q31'
        - $ref: '#/components/schemas/Q3B1'
        - $ref: '#/components/schemas/Q41'
        - $ref: '#/components/schemas/TXCC1'
        - $ref: '#/components/schemas/TXCS1'
        - $ref: '#/components/schemas/WO1'
    SoccerFixtureStatus:
      title: SoccerFixtureStatus
      oneOf:
        - $ref: '#/components/schemas/A2'
        - $ref: '#/components/schemas/C2'
        - $ref: '#/components/schemas/ET1'
        - $ref: '#/components/schemas/ET2'
        - $ref: '#/components/schemas/F2'
        - $ref: '#/components/schemas/FET'
        - $ref: '#/components/schemas/FPE'
        - $ref: '#/components/schemas/H11'
        - $ref: '#/components/schemas/H21'
        - $ref: '#/components/schemas/HT2'
        - $ref: '#/components/schemas/HTET'
        - $ref: '#/components/schemas/I2'
        - $ref: '#/components/schemas/NS2'
        - $ref: '#/components/schemas/P'
        - $ref: '#/components/schemas/PE'
        - $ref: '#/components/schemas/TXCC2'
        - $ref: '#/components/schemas/TXCS2'
        - $ref: '#/components/schemas/WET'
        - $ref: '#/components/schemas/WPE'
    FixtureType:
      title: FixtureType
      oneOf:
        - $ref: '#/components/schemas/Basketball'
        - $ref: '#/components/schemas/Soccer'
        - $ref: '#/components/schemas/UsFootball'
    UsFootballFixtureClock:
      title: UsFootballFixtureClock
      type: object
      required:
        - running
        - seconds
      properties:
        running:
          type: boolean
        seconds:
          type: integer
          format: int32
    UsFootballFixtureDown:
      title: UsFootballFixtureDown
      type: object
      required:
        - number
        - yardsToGo
        - scrimmageLine
        - possession
        - side
      properties:
        number:
          type: integer
          format: int32
        yardsToGo:
          type: integer
          format: int32
        scrimmageLine:
          type: integer
          format: int32
        possession:
          $ref: '#/components/schemas/Participant'
        side:
          $ref: '#/components/schemas/Side'
    InPlayInfo:
      title: InPlayInfo
      type: object
      required:
        - BallSnapped
        - PlayersLiningUp
        - TimeoutParti1
        - TimeoutParti2
        - TVTimeout
      properties:
        BallSnapped:
          type: boolean
        PlayersLiningUp:
          type: boolean
        TimeoutParti1:
          type: boolean
        TimeoutParti2:
          type: boolean
        TVTimeout:
          type: boolean
        Outcome:
          $ref: '#/components/schemas/InPlayOutcome'
        NewSetOfDowns:
          type: boolean
        PenaltyIncreasedDown:
          type: boolean
        PreviousDown:
          $ref: '#/components/schemas/UsFootballFixtureDown'
    KickoffInfo:
      title: KickoffInfo
      type: object
      required:
        - Team
      properties:
        Team:
          $ref: '#/components/schemas/Participant'
        Type:
          $ref: '#/components/schemas/KickoffType'
        Outcome:
          $ref: '#/components/schemas/KickoffOutcome'
        KickoffPreviousAction:
          $ref: '#/components/schemas/KickoffSource'
        PenaltyYards:
          type: integer
          format: int32
    UsFootballFixtureScore:
      title: UsFootballFixtureScore
      type: object
      required:
        - Participant1
        - Participant2
      properties:
        Participant1:
          $ref: '#/components/schemas/UsFootballTotalScore'
        Participant2:
          $ref: '#/components/schemas/UsFootballTotalScore'
    UsFootballData:
      title: UsFootballData
      type: object
      properties:
        Action:
          type: string
        Active:
          type: boolean
        BigPlay:
          type: boolean
        Challenge:
          type: boolean
        Clock:
          $ref: '#/components/schemas/UsFootballFixtureClock'
        Down:
          type: string
        FieldGoal:
          type: boolean
        Id:
          type: integer
          format: int32
        IsTeam:
          type: boolean
        New:
          $ref: '#/components/schemas/UpdateReference'
        NewSetOfDowns:
          type: boolean
        Origin:
          type: string
        Outcome:
          type: string
        Participant:
          type: integer
          format: int32
        Participants:
          type: array
          items:
            type: integer
            format: int32
        PasserId:
          type: integer
          format: int32
        Penalty:
          type: boolean
        PlayerId:
          type: integer
          format: int32
        Posession:
          type: integer
          format: int32
        Previous:
          $ref: '#/components/schemas/UpdateReference'
        ReceiverId:
          type: integer
          format: int32
        ReplaceId:
          type: integer
          format: int32
        ReviewType:
          type: string
        RusherId:
          type: integer
          format: int32
        SackedPlayerId:
          type: integer
          format: int32
        Safety:
          type: boolean
        ScrimmageLine:
          type: integer
          format: int32
        Side:
          type: string
        Touchdown:
          type: boolean
        Turnover:
          type: boolean
        Type:
          type: string
        Yards:
          type: integer
          format: int32
        YardsToGo:
          type: integer
          format: int32
        YardsToEndzone:
          type: integer
          format: int32
    BasketballFixtureScore:
      title: BasketballFixtureScore
      type: object
      required:
        - Participant1
        - Participant2
      properties:
        Participant1:
          $ref: '#/components/schemas/BasketballTotalScore'
        Participant2:
          $ref: '#/components/schemas/BasketballTotalScore'
    BasketballData:
      title: BasketballData
      type: object
      properties:
        Action:
          type: string
        Active:
          type: boolean
        AssistConfirmed:
          type: boolean
        AssistId:
          type: integer
          format: int32
        BlockConfirmed:
          type: boolean
        BlockerId:
          type: integer
          format: int32
        Clock:
          $ref: '#/components/schemas/UsFootballFixtureClock'
        FouledId:
          type: integer
          format: int32
        Id:
          type: integer
          format: int32
        New:
          $ref: '#/components/schemas/BasketballUpdateReference'
        Outcome:
          type: string
        Previous:
          $ref: '#/components/schemas/BasketballUpdateReference'
        ReplaceId:
          type: integer
          format: int32
        Type:
          type: string
    SoccerFixtureScore:
      title: SoccerFixtureScore
      type: object
      required:
        - Participant1
        - Participant2
      properties:
        Participant1:
          $ref: '#/components/schemas/SoccerTotalScore'
        Participant2:
          $ref: '#/components/schemas/SoccerTotalScore'
    SoccerData:
      title: SoccerData
      type: object
      properties:
        Action:
          type: string
        Color:
          type: string
        Conditions:
          type: array
          items:
            $ref: '#/components/schemas/SoccerCondition'
        New:
          $ref: '#/components/schemas/SoccerUpdateReference'
        Corner:
          type: boolean
        FreeKickType:
          type: string
        Goal:
          type: boolean
        GoalType:
          $ref: '#/components/schemas/GoalType'
        Minutes:
          type: integer
          format: int32
        Outcome:
          type: string
        Participant:
          type: integer
          format: int32
        Penalty:
          type: boolean
        PlayerId:
          type: integer
          format: int32
        PlayerInId:
          type: integer
          format: int32
        PlayerOutId:
          type: integer
          format: int32
        Previous:
          $ref: '#/components/schemas/SoccerUpdateReference'
        StatusId:
          type: integer
          format: int32
        ThrowInType:
          type: string
        Type:
          type: string
        RedCard:
          type: boolean
        YellowCard:
          type: boolean
        VAR:
          type: boolean
        VenueType:
          $ref: '#/components/schemas/SoccerVenueType'
    Map_ScoreStatKey:
      title: Map_ScoreStatKey
      type: object
      additionalProperties:
        type: integer
        format: int32
    KickoffDetails:
      title: KickoffDetails
      type: object
      properties:
        Team:
          $ref: '#/components/schemas/Participant'
    LineupData:
      title: LineupData
      type: object
      required:
        - id
        - normativeId
        - preferredName
        - gender
        - updateDateMillis
      properties:
        id:
          type: string
        normativeId:
          type: integer
          format: int32
        preferredName:
          type: string
        gender:
          type: string
        updateDateMillis:
          type: integer
          format: int64
        lineups:
          type: array
          items:
            $ref: '#/components/schemas/PlayerLineupData'
    SoccerPossessionType:
      title: SoccerPossessionType
      oneOf:
        - $ref: '#/components/schemas/AttackPossession'
        - $ref: '#/components/schemas/DangerPossession'
        - $ref: '#/components/schemas/HighDangerPossession'
        - $ref: '#/components/schemas/SafePossession'
    SoccerPartiState:
      title: SoccerPartiState
      type: object
      required:
        - PossibleEvent
      properties:
        PossibleEvent:
          $ref: '#/components/schemas/SoccerPossiblePartiEvent'
    UsFootballPartiState:
      title: UsFootballPartiState
      type: object
      required:
        - Timeouts
        - Challenges
        - PossibleEvent
      properties:
        Timeouts:
          type: integer
          format: int32
        Challenges:
          type: integer
          format: int32
        PossibleEvent:
          $ref: '#/components/schemas/UsFootballPossiblePartiEvent'
    BasketballPartiState:
      title: BasketballPartiState
      type: object
      required:
        - AttackingBasket
        - ActiveTimeout
        - Challenges
      properties:
        AttackingBasket:
          type: boolean
        ActiveTimeout:
          type: boolean
        Challenges:
          type: integer
          format: int32
    SoccerPossibleNeutralEvent:
      title: SoccerPossibleNeutralEvent
      type: object
      required:
        - RedCard
        - YellowCard
        - VAR
      properties:
        RedCard:
          type: boolean
        YellowCard:
          type: boolean
        VAR:
          type: boolean
    UsFootballPossibleEvent:
      title: UsFootballPossibleEvent
      type: object
      required:
        - penalty
        - turnover
        - challenge
      properties:
        penalty:
          type: boolean
        turnover:
          type: boolean
        challenge:
          type: boolean
    A:
      title: A
      type: object
    C:
      title: C
      type: object
    F:
      title: F
      type: object
    FO:
      title: FO
      type: object
    HT:
      title: HT
      type: object
    I:
      title: I
      type: object
    NS:
      title: NS
      type: object
    OB:
      title: OB
      type: object
    OB1:
      title: OB1
      type: object
    OB10:
      title: OB10
      type: object
    OB11:
      title: OB11
      type: object
    OB2:
      title: OB2
      type: object
    OB3:
      title: OB3
      type: object
    OB4:
      title: OB4
      type: object
    OB5:
      title: OB5
      type: object
    OB6:
      title: OB6
      type: object
    OB7:
      title: OB7
      type: object
    OB8:
      title: OB8
      type: object
    OB9:
      title: OB9
      type: object
    OT:
      title: OT
      type: object
    OT1:
      title: OT1
      type: object
    OT10:
      title: OT10
      type: object
    OT11:
      title: OT11
      type: object
    OT12:
      title: OT12
      type: object
    OT2:
      title: OT2
      type: object
    OT3:
      title: OT3
      type: object
    OT4:
      title: OT4
      type: object
    OT5:
      title: OT5
      type: object
    OT6:
      title: OT6
      type: object
    OT7:
      title: OT7
      type: object
    OT8:
      title: OT8
      type: object
    OT9:
      title: OT9
      type: object
    Q1:
      title: Q1
      type: object
    Q1B:
      title: Q1B
      type: object
    Q2:
      title: Q2
      type: object
    Q3:
      title: Q3
      type: object
    Q3B:
      title: Q3B
      type: object
    Q4:
      title: Q4
      type: object
    TXCC:
      title: TXCC
      type: object
    TXCS:
      title: TXCS
      type: object
    WO:
      title: WO
      type: object
    A1:
      title: A
      type: object
    C1:
      title: C
      type: object
    F1:
      title: F
      type: object
    FO1:
      title: FO
      type: object
    H1:
      title: H1
      type: object
    H2:
      title: H2
      type: object
    HT1:
      title: HT
      type: object
    I1:
      title: I
      type: object
    NS1:
      title: NS
      type: object
    OB12:
      title: OB
      type: object
    OT13:
      title: OT
      type: object
    Q11:
      title: Q1
      type: object
    Q1B1:
      title: Q1B
      type: object
    Q21:
      title: Q2
      type: object
    Q31:
      title: Q3
      type: object
    Q3B1:
      title: Q3B
      type: object
    Q41:
      title: Q4
      type: object
    TXCC1:
      title: TXCC
      type: object
    TXCS1:
      title: TXCS
      type: object
    WO1:
      title: WO
      type: object
    A2:
      title: A
      type: object
    C2:
      title: C
      type: object
    ET1:
      title: ET1
      type: object
    ET2:
      title: ET2
      type: object
    F2:
      title: F
      type: object
    FET:
      title: FET
      type: object
    FPE:
      title: FPE
      type: object
    H11:
      title: H1
      type: object
    H21:
      title: H2
      type: object
    HT2:
      title: HT
      type: object
    HTET:
      title: HTET
      type: object
    I2:
      title: I
      type: object
    NS2:
      title: NS
      type: object
    P:
      title: P
      type: object
    PE:
      title: PE
      type: object
    TXCC2:
      title: TXCC
      type: object
    TXCS2:
      title: TXCS
      type: object
    WET:
      title: WET
      type: object
    WPE:
      title: WPE
      type: object
    Basketball:
      title: Basketball
      type: object
    Soccer:
      title: Soccer
      type: object
    UsFootball:
      title: UsFootball
      type: object
    Participant:
      title: Participant
      oneOf:
        - $ref: '#/components/schemas/Parti1'
        - $ref: '#/components/schemas/Parti2'
    Side:
      title: Side
      oneOf:
        - $ref: '#/components/schemas/Defensive'
        - $ref: '#/components/schemas/Offensive'
    InPlayOutcome:
      title: InPlayOutcome
      oneOf:
        - $ref: '#/components/schemas/Blocked'
        - $ref: '#/components/schemas/Downed'
        - $ref: '#/components/schemas/FairCatch'
        - $ref: '#/components/schemas/FieldGoalMissed'
        - $ref: '#/components/schemas/FieldGoalSuccessful'
        - $ref: '#/components/schemas/Fumble'
        - $ref: '#/components/schemas/OutOfBounds'
        - $ref: '#/components/schemas/PassComplete'
        - $ref: '#/components/schemas/PassIncomplete'
        - $ref: '#/components/schemas/PassIntercepted'
        - $ref: '#/components/schemas/PassSack'
        - $ref: '#/components/schemas/Recovered'
        - $ref: '#/components/schemas/Return'
        - $ref: '#/components/schemas/RushComplete'
        - $ref: '#/components/schemas/Touchback'
    KickoffType:
      title: KickoffType
      oneOf:
        - $ref: '#/components/schemas/Onside'
        - $ref: '#/components/schemas/Regular'
    KickoffOutcome:
      title: KickoffOutcome
      oneOf:
        - $ref: '#/components/schemas/FairCatch'
        - $ref: '#/components/schemas/Fumble'
        - $ref: '#/components/schemas/OutOfBounds'
        - $ref: '#/components/schemas/Recovered'
        - $ref: '#/components/schemas/Return'
        - $ref: '#/components/schemas/Touchback'
    KickoffSource:
      title: KickoffSource
      oneOf:
        - $ref: '#/components/schemas/ConversionSafety'
        - $ref: '#/components/schemas/DefensiveConversion'
        - $ref: '#/components/schemas/Safety1Pt'
        - $ref: '#/components/schemas/Safety2Pt'
    UsFootballTotalScore:
      title: UsFootballTotalScore
      type: object
      properties:
        Q1:
          $ref: '#/components/schemas/UsFootballScore'
        Q2:
          $ref: '#/components/schemas/UsFootballScore'
        HT:
          $ref: '#/components/schemas/UsFootballScore'
        Q3:
          $ref: '#/components/schemas/UsFootballScore'
        Q4:
          $ref: '#/components/schemas/UsFootballScore'
        OT:
          $ref: '#/components/schemas/Map_UsFootballScore'
        OTTotal:
          $ref: '#/components/schemas/UsFootballScore'
        Total:
          $ref: '#/components/schemas/UsFootballScore'
    UpdateReference:
      title: UpdateReference
      type: object
      properties:
        Clock:
          $ref: '#/components/schemas/UsFootballFixtureClock'
        IsTeam:
          type: boolean
        Outcome:
          $ref: '#/components/schemas/PassOutcome'
        PlayerId:
          type: integer
          format: int32
        ReceiverId:
          type: integer
          format: int32
        RusherId:
          type: integer
          format: int32
        SackedPlayerId:
          type: integer
          format: int32
        Yards:
          type: integer
          format: int32
        YardsToGo:
          type: integer
          format: int32
    BasketballTotalScore:
      title: BasketballTotalScore
      type: object
      properties:
        Period:
          $ref: '#/components/schemas/Map_BasketballScore'
        HT:
          $ref: '#/components/schemas/BasketballScore'
        OT:
          $ref: '#/components/schemas/Map_BasketballScore'
        OTTotal:
          $ref: '#/components/schemas/BasketballScore'
        Total:
          $ref: '#/components/schemas/BasketballScore'
    BasketballUpdateReference:
      title: BasketballUpdateReference
      type: object
      properties:
        AssistConfirmed:
          type: boolean
        AssistId:
          type: integer
          format: int32
        BlockConfirmed:
          type: boolean
        BlockerId:
          type: integer
          format: int32
        Clock:
          $ref: '#/components/schemas/UsFootballFixtureClock'
        FouledId:
          type: integer
          format: int32
        IsPlayerRebound:
          type: boolean
        IsTeam:
          type: boolean
        IsTeamRebound:
          type: boolean
        Outcome:
          description: Union of PointAttemptOutcome and FreeThrowOutcome
          type: string
        Participant:
          type: integer
          format: int32
        PlayerId:
          type: integer
          format: int32
        PlayerInId:
          type: integer
          format: int32
        PlayerOutId:
          type: integer
          format: int32
        TeamFoul:
          type: boolean
        TurnoverId:
          type: integer
          format: int32
        Type:
          description: Union of FoulType, ReboundType, and FreeThrowType
          type: string
        UpdatePlayersOnCourt:
          type: boolean
    SoccerTotalScore:
      title: SoccerTotalScore
      type: object
      properties:
        H1:
          $ref: '#/components/schemas/SoccerScore'
        HT:
          $ref: '#/components/schemas/SoccerScore'
        H2:
          $ref: '#/components/schemas/SoccerScore'
        ET1:
          $ref: '#/components/schemas/SoccerScore'
        ET2:
          $ref: '#/components/schemas/SoccerScore'
        PE:
          $ref: '#/components/schemas/SoccerScore'
        ETTotal:
          $ref: '#/components/schemas/SoccerScore'
        Total:
          $ref: '#/components/schemas/SoccerScore'
    SoccerCondition:
      title: SoccerCondition
      description: Union of SoccerWeather and SoccerPitchCondition
      type: string
    SoccerUpdateReference:
      title: SoccerUpdateReference
      type: object
      properties:
        Clock:
          $ref: '#/components/schemas/SoccerFixtureClock'
        FreeKickType:
          $ref: '#/components/schemas/FreeKickType'
        GoalType:
          $ref: '#/components/schemas/GoalType'
        Minutes:
          type: integer
          format: int32
        Outcome:
          description: >-
            A string representing either a ShotOutcome, SoccerPenaltyOutcome, or
            InjuryOutcome
          type: string
        PlayerId:
          type: integer
          format: int32
        PlayerInId:
          type: integer
          format: int32
        PlayerOutId:
          type: integer
          format: int32
        ThrowInType:
          $ref: '#/components/schemas/ThrowInType'
        Type:
          type: string
    GoalType:
      title: GoalType
      oneOf:
        - $ref: '#/components/schemas/Head'
        - $ref: '#/components/schemas/Other'
        - $ref: '#/components/schemas/OwnGoal'
        - $ref: '#/components/schemas/Shot'
    SoccerVenueType:
      title: SoccerVenueType
      oneOf:
        - $ref: '#/components/schemas/Away'
        - $ref: '#/components/schemas/Home'
        - $ref: '#/components/schemas/Neutral'
    PlayerLineupData:
      title: PlayerLineupData
      type: object
      required:
        - fixturePlayerId
        - statusId
        - positionId
        - unitId
        - rosterNumber
        - starter
        - starred
        - player
      properties:
        fixturePlayerId:
          type: integer
          format: int32
        statusId:
          type: integer
          format: int32
        positionId:
          type: integer
          format: int32
        unitId:
          type: integer
          format: int32
        rosterNumber:
          type: string
        starter:
          type: boolean
        starred:
          type: boolean
        player:
          $ref: '#/components/schemas/PlayerData'
    AttackPossession:
      title: AttackPossession
      type: object
    DangerPossession:
      title: DangerPossession
      type: object
    HighDangerPossession:
      title: HighDangerPossession
      type: object
    SafePossession:
      title: SafePossession
      type: object
    SoccerPossiblePartiEvent:
      title: SoccerPossiblePartiEvent
      type: object
      required:
        - Goal
        - Penalty
        - Corner
      properties:
        Goal:
          type: boolean
        Penalty:
          type: boolean
        Corner:
          type: boolean
    UsFootballPossiblePartiEvent:
      title: UsFootballPossiblePartiEvent
      type: object
      required:
        - touchdown
        - fieldGoal
        - safety
        - 4thDownConversion
        - 2ptConversionAttempt
        - 1stDown
        - bigPlay
        - punt
      properties:
        touchdown:
          type: boolean
        fieldGoal:
          type: boolean
        safety:
          type: boolean
        4thDownConversion:
          type: boolean
        2ptConversionAttempt:
          type: boolean
        1stDown:
          type: boolean
        bigPlay:
          type: boolean
        punt:
          type: boolean
    Parti1:
      title: Parti1
      type: object
    Parti2:
      title: Parti2
      type: object
    Defensive:
      title: Defensive
      type: object
    Offensive:
      title: Offensive
      type: object
    Blocked:
      title: Blocked
      type: object
    Downed:
      title: Downed
      type: object
    FairCatch:
      title: FairCatch
      type: object
    FieldGoalMissed:
      title: FieldGoalMissed
      type: object
    FieldGoalSuccessful:
      title: FieldGoalSuccessful
      type: object
    Fumble:
      title: Fumble
      type: object
    OutOfBounds:
      title: OutOfBounds
      type: object
    PassComplete:
      title: PassComplete
      type: object
    PassIncomplete:
      title: PassIncomplete
      type: object
    PassIntercepted:
      title: PassIntercepted
      type: object
    PassSack:
      title: PassSack
      type: object
    Recovered:
      title: Recovered
      type: object
    Return:
      title: Return
      type: object
    RushComplete:
      title: RushComplete
      type: object
    Touchback:
      title: Touchback
      type: object
    Onside:
      title: Onside
      type: object
    Regular:
      title: Regular
      type: object
    ConversionSafety:
      title: ConversionSafety
      type: object
    DefensiveConversion:
      title: DefensiveConversion
      type: object
    Safety1Pt:
      title: Safety1Pt
      type: object
    Safety2Pt:
      title: Safety2Pt
      type: object
    UsFootballScore:
      title: UsFootballScore
      type: object
      required:
        - Score
        - Touchdown
        - Safety
        - 1ptSafety
        - 1ptConversion
        - 2ptConversion
        - FieldGoal
        - Defensive2ptConversion
      properties:
        Score:
          type: integer
          format: int32
        Touchdown:
          type: integer
          format: int32
        Safety:
          type: integer
          format: int32
        1ptSafety:
          type: integer
          format: int32
        1ptConversion:
          type: integer
          format: int32
        2ptConversion:
          type: integer
          format: int32
        FieldGoal:
          type: integer
          format: int32
        Defensive2ptConversion:
          type: integer
          format: int32
    Map_UsFootballScore:
      title: Map_UsFootballScore
      type: object
      additionalProperties:
        $ref: '#/components/schemas/UsFootballScore'
    PassOutcome:
      title: PassOutcome
      oneOf:
        - $ref: '#/components/schemas/Complete'
        - $ref: '#/components/schemas/Incomplete'
        - $ref: '#/components/schemas/Intercepted'
        - $ref: '#/components/schemas/Sack'
    Map_BasketballScore:
      title: Map_BasketballScore
      type: object
      additionalProperties:
        $ref: '#/components/schemas/BasketballScore'
    BasketballScore:
      title: BasketballScore
      type: object
      required:
        - Score
        - Fouls
        - PersonalFouls
        - Blocks
        - Rebounds
        - FreeThrows_made
        - 2pts_made
        - 3pts_made
        - FreeThrows_missed
        - 2pts_missed
        - 3pts_missed
        - FreeThrows_attempts
        - 2pts_attempts
        - 3pts_attempts
        - Assists
        - Turnovers
        - Steals
        - UsedTimeouts
      properties:
        Score:
          type: integer
          format: int32
        Fouls:
          type: integer
          format: int32
        PersonalFouls:
          type: integer
          format: int32
        Blocks:
          type: integer
          format: int32
        Rebounds:
          type: integer
          format: int32
        FreeThrows_made:
          type: integer
          format: int32
        2pts_made:
          type: integer
          format: int32
        3pts_made:
          type: integer
          format: int32
        FreeThrows_missed:
          type: integer
          format: int32
        2pts_missed:
          type: integer
          format: int32
        3pts_missed:
          type: integer
          format: int32
        FreeThrows_attempts:
          type: integer
          format: int32
        2pts_attempts:
          type: integer
          format: int32
        3pts_attempts:
          type: integer
          format: int32
        Assists:
          type: integer
          format: int32
        Turnovers:
          type: integer
          format: int32
        Steals:
          type: integer
          format: int32
        UsedTimeouts:
          type: integer
          format: int32
    SoccerScore:
      title: SoccerScore
      type: object
      required:
        - Goals
        - YellowCards
        - RedCards
        - Corners
      properties:
        Goals:
          type: integer
          format: int32
        YellowCards:
          type: integer
          format: int32
        RedCards:
          type: integer
          format: int32
        Corners:
          type: integer
          format: int32
    SoccerFixtureClock:
      title: SoccerFixtureClock
      type: object
      required:
        - running
        - seconds
      properties:
        running:
          type: boolean
        seconds:
          type: integer
          format: int32
    FreeKickType:
      title: FreeKickType
      oneOf:
        - $ref: '#/components/schemas/Attack'
        - $ref: '#/components/schemas/Danger'
        - $ref: '#/components/schemas/HighDanger'
        - $ref: '#/components/schemas/Offside'
        - $ref: '#/components/schemas/Safe'
    ThrowInType:
      title: ThrowInType
      oneOf:
        - $ref: '#/components/schemas/Attack'
        - $ref: '#/components/schemas/Danger'
        - $ref: '#/components/schemas/Safe'
    Head:
      title: Head
      type: object
    Other:
      title: Other
      type: object
    OwnGoal:
      title: OwnGoal
      type: object
    Shot:
      title: Shot
      type: object
    Away:
      title: Away
      type: object
    Home:
      title: Home
      type: object
    Neutral:
      title: Neutral
      type: object
    PlayerData:
      title: PlayerData
      type: object
      required:
        - id
        - normativeId
        - country
        - team
        - dateOfBirth
        - gender
        - preferredName
        - updateDateMillis
      properties:
        id:
          type: string
        normativeId:
          type: integer
          format: int32
        country:
          type: string
        team:
          type: string
        dateOfBirth:
          type: string
        gender:
          type: string
        preferredName:
          type: string
        updateDateMillis:
          type: integer
          format: int64
    Complete:
      title: Complete
      type: object
    Incomplete:
      title: Incomplete
      type: object
    Intercepted:
      title: Intercepted
      type: object
    Sack:
      title: Sack
      type: object
    Attack:
      title: Attack
      type: object
    Danger:
      title: Danger
      type: object
    HighDanger:
      title: HighDanger
      type: object
    Offside:
      title: Offside
      type: object
    Safe:
      title: Safe
      type: object
  securitySchemes:
    httpAuth:
      type: http
      description: User's session JWT.
      scheme: bearer
    apiKeyAuth:
      type: apiKey
      description: The user's long-lived API token, obtained from the activation endpoint.
      name: X-Api-Token
      in: header

````

> ## Documentation Index
> Fetch the complete documentation index at: https://txline-docs.txodds.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Get a real-time Server-Sent Events stream of scores updates

> A long-lived stream of scores updates.

The stream consists of two types of events:
1. **Data messages:** These have an `id` in the format `timestamp:index` and `data` containing a JSON object for a single Scores record.
2. **Heartbeats:** These have an `event` field set to `heartbeat` and may have data like `{"Ts": 12345}`.




## OpenAPI

````yaml https://txline.txodds.com/docs/docs.yaml get /api/scores/stream
openapi: 3.1.0
info:
  title: TxLINE off-chain API for the Hybrid on-chain/off-chain TxODDS Data system
  version: 1.5.2
  description: >

    ## Overview


    This API provides access to real-time and historical sports data from the
    **TxLINE on-chain/off-chain Data system**.


    It makes proprietary TxODDS available for any funded blockchain users by
    linking the on-chain `subscribe` transaction by issuing time-limited API
    tokens.

    - The data is canonicalised so that all fixtures, odds, or scores are
    provably identifiable and ordered--confirmed by on-chain cryptographic
    proofs.

    - The data is delivered in a request-response or Server-Sent Events (SSE)
    streaming form.


    Examples of accessing the accompanying on-chain program are available
    publicly at: https://txline.txodds.com/documentation.

    All data returned by the off-chain API is canonicalised such that every
    single record can be cryptographically proven on-chain to be

    part of the unique and consistent dataset generated by the TxODDS Data
    system.


    ## Key features


    * The odds data includes the `Stable Price` demargined prices and
    percentages, currently for key markets in European football (soccer).

    * **Free subscription option that offers World Cup 2026 odds and
    off-the-board signals in real-time sampled every 60 seconds**.

    * **Data access paid for by the TxLINE token tethered to USDT ata rate 1
    USDT = 1_000 TxLINE tokens** The TxLINE utility token can purchased using
    the associated Solana program.

    * **Fine-grained service level selection** The user can list the
    pre-configured **service levels** that either map to pre-defined league
    bundles or allow custom selecting the leagues explicitly.
     The price also depends on the sampling period for the data.
    * **Maximum subscription option that offers all leagues in real-time**.

    * **Historical Snapshots:** Query the latest state of any market at a
    specific point in time.

    * **Historical Updates:** Query the updates for any given key such as
    fixture or market for a given time period.

    * **Live Data Streams:** Real-time, low-latency data feeds using Server-Sent
    Events (SSE).

    * **On-chain Validation:** Retrieve Merkle proofs to cryptographically
    verify data against the on-chain held Merkle roots by calling appropriate
    validate on-chain instructions.


    ## How do the users gain access to off-chain data (see more details and
    examples at: https://github.com/txodds/tx-on-chain)


    1. For paid service tiers, the user purchases TxODDS TxLINE utility tokens
    for USDT at a fixed rate using either a script (e.g., calling
    `purchase_subscription_token_usdt`) or an affiliate website. The tokens are
    deposited into the user's associated token account. (Note: This step is
    skipped for the free World Cup tier).

    2. As a guest, with no prior authentication, the user calls the off-chain
    API at "https://oracle.txodds.com/auth/guest/start" (or `oracle-dev` for
    DevNet) to obtain an anonymous JWT with Guest claims. **Please note that the
    JWT token has 30 days  expiration so if you are issuing calls to the data
    endpoints beyond 30 days, you should either pre-acquire a new JWT token in
    time before 30 days expire or respond to the returned HTTP 401 code by
    reacquiring a fresh JWT token.**

    3. The user creates, signs, and confirms a Solana transaction to the
    `subscribe` instruction, indicating the duration in weeks (must be a
    multiple of 4 weeks, e.g. 4, 8, 12) and the chosen service level. The user
    explicitly acts as the transaction fee payer. For the free tier, the smart
    contract registers the subscription but charges 0 TxLINE tokens.

    4. The user records the confirmed transaction signature (`txSig`).

    5. The user constructs a strict message binding consisting of the `txSig`, a
    comma-separated list of selected leagues, and the JWT.

    6. The user cryptographically signs this message using their wallet's secret
    key to generate a detached signature, which is then Base64-encoded.

    7. The user activates the subscription with the off-chain server at
    "https://oracle.txodds.com/api/token/activate" (or `oracle-dev` for DevNet)
    by posting the `txSig`, the Base64 wallet signature, and the selected
    leagues array, using the JWT for authorization.

    8. The off-chain server validates the cryptographic proof and entitlements,
    issuing an appropriate API Token or rejecting the activation with a reason.

    9. The user calls the documented APIs while the subscription is valid,
    supplying both the JWT and the API Token.

    10. Before the subscription expires, the user may call the `subscribe`
    instruction again to extend the validity period (by a multiple of 4 weeks,
    e.g. 4, 8, 12) via the same off-chain activation call. The selected leagues
    can also be amended.

    11. If the previous subscription has expired, the user can activate a new
    API Token by repeating the process.
servers:
  - url: https://txline.txodds.com
    description: Production TxLINE server
  - url: http://txline-dev.txodds.com
    description: Test TxLINE server
security: []
paths:
  /api/scores/stream:
    get:
      tags:
        - Scores
      summary: Get a real-time Server-Sent Events stream of scores updates
      description: >
        A long-lived stream of scores updates.


        The stream consists of two types of events:

        1. **Data messages:** These have an `id` in the format `timestamp:index`
        and `data` containing a JSON object for a single Scores record.

        2. **Heartbeats:** These have an `event` field set to `heartbeat` and
        may have data like `{"Ts": 12345}`.
      operationId: getApiScoresStream
      parameters:
        - name: Authorization
          in: header
          description: Bearer token for the user's session JWT.
          required: true
          schema:
            type: string
        - name: X-Api-Token
          in: header
          description: The user's long-lived API token.
          required: true
          schema:
            type: string
        - name: fixtureId
          in: query
          description: Optional. Filter the event stream for a single fixture ID.
          required: false
          schema:
            type: integer
            format: int64
        - name: Last-Event-ID
          in: header
          description: Optional. The ID of the last event received, to resume the stream.
          required: false
          schema:
            type: string
      responses:
        '200':
          description: ''
          content:
            text/event-stream:
              schema:
                $ref: '#/components/schemas/ScoresStreamEvent'
        '400':
          description: >-
            Invalid value for: header Authorization, Invalid value for: header
            X-Api-Token, Invalid value for: query parameter fixtureId
          content:
            text/plain:
              schema:
                type: string
        '401':
          description: 'Authorization failed: Invalid or expired guest JWT'
          content:
            text/plain:
              schema:
                type: string
        '403':
          description: 'Access denied: Invalid API token or insufficient permissions'
          content:
            text/plain:
              schema:
                type: string
        '500':
          description: Internal server error
          content:
            text/plain:
              schema:
                type: string
      security:
        - httpAuth: []
          apiKeyAuth: []
components:
  schemas:
    ScoresStreamEvent:
      title: ScoresStreamEvent
      type: object
      properties:
        id:
          type: string
        event:
          type: string
        data:
          $ref: '#/components/schemas/Scores'
    Scores:
      title: Scores
      type: object
      required:
        - fixtureId
        - gameState
        - startTime
        - isTeam
        - fixtureGroupId
        - competitionId
        - countryId
        - sportId
        - participant1IsHome
        - participant2Id
        - participant1Id
        - action
        - id
        - ts
        - connectionId
        - seq
      properties:
        fixtureId:
          type: integer
          format: int32
        gameState:
          type: string
        startTime:
          type: integer
          format: int64
        isTeam:
          type: boolean
        fixtureGroupId:
          type: integer
          format: int32
        competitionId:
          type: integer
          format: int32
        countryId:
          type: integer
          format: int32
        sportId:
          type: integer
          format: int32
        participant1IsHome:
          type: boolean
        participant2Id:
          type: integer
          format: int32
        participant1Id:
          type: integer
          format: int32
        coverageSecondaryData:
          type: boolean
        coverageType:
          type: string
        action:
          type: string
        id:
          type: integer
          format: int32
        ts:
          type: integer
          format: int64
        connectionId:
          type: integer
          format: int64
        seq:
          type: integer
          format: int32
        statusId:
          $ref: '#/components/schemas/UsFootballFixtureStatus'
        statusBasketballId:
          $ref: '#/components/schemas/BasketballFixtureStatus'
        statusSoccerId:
          $ref: '#/components/schemas/SoccerFixtureStatus'
        type:
          $ref: '#/components/schemas/FixtureType'
        confirmed:
          type: boolean
        clock:
          $ref: '#/components/schemas/UsFootballFixtureClock'
        down:
          $ref: '#/components/schemas/UsFootballFixtureDown'
        inPlayInfo:
          $ref: '#/components/schemas/InPlayInfo'
        kickoffInfo:
          $ref: '#/components/schemas/KickoffInfo'
        score:
          $ref: '#/components/schemas/UsFootballFixtureScore'
        data:
          $ref: '#/components/schemas/UsFootballData'
        scoreBasketball:
          $ref: '#/components/schemas/BasketballFixtureScore'
        dataBasketball:
          $ref: '#/components/schemas/BasketballData'
        scoreSoccer:
          $ref: '#/components/schemas/SoccerFixtureScore'
        dataSoccer:
          $ref: '#/components/schemas/SoccerData'
        stats:
          $ref: '#/components/schemas/Map_ScoreStatKey'
        participant:
          type: integer
          format: int32
        kickoff:
          $ref: '#/components/schemas/KickoffDetails'
        lineups:
          type: array
          items:
            $ref: '#/components/schemas/LineupData'
        possession:
          type: integer
          format: int32
        possessionType:
          $ref: '#/components/schemas/SoccerPossessionType'
        parti1StateSoccer:
          $ref: '#/components/schemas/SoccerPartiState'
        parti1StateUsFootball:
          $ref: '#/components/schemas/UsFootballPartiState'
        parti1StateBasketball:
          $ref: '#/components/schemas/BasketballPartiState'
        parti2StateSoccer:
          $ref: '#/components/schemas/SoccerPartiState'
        parti2StateUsFootball:
          $ref: '#/components/schemas/UsFootballPartiState'
        parti2StateBasketball:
          $ref: '#/components/schemas/BasketballPartiState'
        possibleEventSoccer:
          $ref: '#/components/schemas/SoccerPossibleNeutralEvent'
        possibleEventUsFootball:
          $ref: '#/components/schemas/UsFootballPossibleEvent'
    UsFootballFixtureStatus:
      title: UsFootballFixtureStatus
      oneOf:
        - $ref: '#/components/schemas/A'
        - $ref: '#/components/schemas/C'
        - $ref: '#/components/schemas/F'
        - $ref: '#/components/schemas/FO'
        - $ref: '#/components/schemas/HT'
        - $ref: '#/components/schemas/I'
        - $ref: '#/components/schemas/NS'
        - $ref: '#/components/schemas/OB'
        - $ref: '#/components/schemas/OB1'
        - $ref: '#/components/schemas/OB10'
        - $ref: '#/components/schemas/OB11'
        - $ref: '#/components/schemas/OB2'
        - $ref: '#/components/schemas/OB3'
        - $ref: '#/components/schemas/OB4'
        - $ref: '#/components/schemas/OB5'
        - $ref: '#/components/schemas/OB6'
        - $ref: '#/components/schemas/OB7'
        - $ref: '#/components/schemas/OB8'
        - $ref: '#/components/schemas/OB9'
        - $ref: '#/components/schemas/OT'
        - $ref: '#/components/schemas/OT1'
        - $ref: '#/components/schemas/OT10'
        - $ref: '#/components/schemas/OT11'
        - $ref: '#/components/schemas/OT12'
        - $ref: '#/components/schemas/OT2'
        - $ref: '#/components/schemas/OT3'
        - $ref: '#/components/schemas/OT4'
        - $ref: '#/components/schemas/OT5'
        - $ref: '#/components/schemas/OT6'
        - $ref: '#/components/schemas/OT7'
        - $ref: '#/components/schemas/OT8'
        - $ref: '#/components/schemas/OT9'
        - $ref: '#/components/schemas/Q1'
        - $ref: '#/components/schemas/Q1B'
        - $ref: '#/components/schemas/Q2'
        - $ref: '#/components/schemas/Q3'
        - $ref: '#/components/schemas/Q3B'
        - $ref: '#/components/schemas/Q4'
        - $ref: '#/components/schemas/TXCC'
        - $ref: '#/components/schemas/TXCS'
        - $ref: '#/components/schemas/WO'
    BasketballFixtureStatus:
      title: BasketballFixtureStatus
      oneOf:
        - $ref: '#/components/schemas/A1'
        - $ref: '#/components/schemas/C1'
        - $ref: '#/components/schemas/F1'
        - $ref: '#/components/schemas/FO1'
        - $ref: '#/components/schemas/H1'
        - $ref: '#/components/schemas/H2'
        - $ref: '#/components/schemas/HT1'
        - $ref: '#/components/schemas/I1'
        - $ref: '#/components/schemas/NS1'
        - $ref: '#/components/schemas/OB12'
        - $ref: '#/components/schemas/OT13'
        - $ref: '#/components/schemas/Q11'
        - $ref: '#/components/schemas/Q1B1'
        - $ref: '#/components/schemas/Q21'
        - $ref: '#/components/schemas/Q31'
        - $ref: '#/components/schemas/Q3B1'
        - $ref: '#/components/schemas/Q41'
        - $ref: '#/components/schemas/TXCC1'
        - $ref: '#/components/schemas/TXCS1'
        - $ref: '#/components/schemas/WO1'
    SoccerFixtureStatus:
      title: SoccerFixtureStatus
      oneOf:
        - $ref: '#/components/schemas/A2'
        - $ref: '#/components/schemas/C2'
        - $ref: '#/components/schemas/ET1'
        - $ref: '#/components/schemas/ET2'
        - $ref: '#/components/schemas/F2'
        - $ref: '#/components/schemas/FET'
        - $ref: '#/components/schemas/FPE'
        - $ref: '#/components/schemas/H11'
        - $ref: '#/components/schemas/H21'
        - $ref: '#/components/schemas/HT2'
        - $ref: '#/components/schemas/HTET'
        - $ref: '#/components/schemas/I2'
        - $ref: '#/components/schemas/NS2'
        - $ref: '#/components/schemas/P'
        - $ref: '#/components/schemas/PE'
        - $ref: '#/components/schemas/TXCC2'
        - $ref: '#/components/schemas/TXCS2'
        - $ref: '#/components/schemas/WET'
        - $ref: '#/components/schemas/WPE'
    FixtureType:
      title: FixtureType
      oneOf:
        - $ref: '#/components/schemas/Basketball'
        - $ref: '#/components/schemas/Soccer'
        - $ref: '#/components/schemas/UsFootball'
    UsFootballFixtureClock:
      title: UsFootballFixtureClock
      type: object
      required:
        - running
        - seconds
      properties:
        running:
          type: boolean
        seconds:
          type: integer
          format: int32
    UsFootballFixtureDown:
      title: UsFootballFixtureDown
      type: object
      required:
        - number
        - yardsToGo
        - scrimmageLine
        - possession
        - side
      properties:
        number:
          type: integer
          format: int32
        yardsToGo:
          type: integer
          format: int32
        scrimmageLine:
          type: integer
          format: int32
        possession:
          $ref: '#/components/schemas/Participant'
        side:
          $ref: '#/components/schemas/Side'
    InPlayInfo:
      title: InPlayInfo
      type: object
      required:
        - BallSnapped
        - PlayersLiningUp
        - TimeoutParti1
        - TimeoutParti2
        - TVTimeout
      properties:
        BallSnapped:
          type: boolean
        PlayersLiningUp:
          type: boolean
        TimeoutParti1:
          type: boolean
        TimeoutParti2:
          type: boolean
        TVTimeout:
          type: boolean
        Outcome:
          $ref: '#/components/schemas/InPlayOutcome'
        NewSetOfDowns:
          type: boolean
        PenaltyIncreasedDown:
          type: boolean
        PreviousDown:
          $ref: '#/components/schemas/UsFootballFixtureDown'
    KickoffInfo:
      title: KickoffInfo
      type: object
      required:
        - Team
      properties:
        Team:
          $ref: '#/components/schemas/Participant'
        Type:
          $ref: '#/components/schemas/KickoffType'
        Outcome:
          $ref: '#/components/schemas/KickoffOutcome'
        KickoffPreviousAction:
          $ref: '#/components/schemas/KickoffSource'
        PenaltyYards:
          type: integer
          format: int32
    UsFootballFixtureScore:
      title: UsFootballFixtureScore
      type: object
      required:
        - Participant1
        - Participant2
      properties:
        Participant1:
          $ref: '#/components/schemas/UsFootballTotalScore'
        Participant2:
          $ref: '#/components/schemas/UsFootballTotalScore'
    UsFootballData:
      title: UsFootballData
      type: object
      properties:
        Action:
          type: string
        Active:
          type: boolean
        BigPlay:
          type: boolean
        Challenge:
          type: boolean
        Clock:
          $ref: '#/components/schemas/UsFootballFixtureClock'
        Down:
          type: string
        FieldGoal:
          type: boolean
        Id:
          type: integer
          format: int32
        IsTeam:
          type: boolean
        New:
          $ref: '#/components/schemas/UpdateReference'
        NewSetOfDowns:
          type: boolean
        Origin:
          type: string
        Outcome:
          type: string
        Participant:
          type: integer
          format: int32
        Participants:
          type: array
          items:
            type: integer
            format: int32
        PasserId:
          type: integer
          format: int32
        Penalty:
          type: boolean
        PlayerId:
          type: integer
          format: int32
        Posession:
          type: integer
          format: int32
        Previous:
          $ref: '#/components/schemas/UpdateReference'
        ReceiverId:
          type: integer
          format: int32
        ReplaceId:
          type: integer
          format: int32
        ReviewType:
          type: string
        RusherId:
          type: integer
          format: int32
        SackedPlayerId:
          type: integer
          format: int32
        Safety:
          type: boolean
        ScrimmageLine:
          type: integer
          format: int32
        Side:
          type: string
        Touchdown:
          type: boolean
        Turnover:
          type: boolean
        Type:
          type: string
        Yards:
          type: integer
          format: int32
        YardsToGo:
          type: integer
          format: int32
        YardsToEndzone:
          type: integer
          format: int32
    BasketballFixtureScore:
      title: BasketballFixtureScore
      type: object
      required:
        - Participant1
        - Participant2
      properties:
        Participant1:
          $ref: '#/components/schemas/BasketballTotalScore'
        Participant2:
          $ref: '#/components/schemas/BasketballTotalScore'
    BasketballData:
      title: BasketballData
      type: object
      properties:
        Action:
          type: string
        Active:
          type: boolean
        AssistConfirmed:
          type: boolean
        AssistId:
          type: integer
          format: int32
        BlockConfirmed:
          type: boolean
        BlockerId:
          type: integer
          format: int32
        Clock:
          $ref: '#/components/schemas/UsFootballFixtureClock'
        FouledId:
          type: integer
          format: int32
        Id:
          type: integer
          format: int32
        New:
          $ref: '#/components/schemas/BasketballUpdateReference'
        Outcome:
          type: string
        Previous:
          $ref: '#/components/schemas/BasketballUpdateReference'
        ReplaceId:
          type: integer
          format: int32
        Type:
          type: string
    SoccerFixtureScore:
      title: SoccerFixtureScore
      type: object
      required:
        - Participant1
        - Participant2
      properties:
        Participant1:
          $ref: '#/components/schemas/SoccerTotalScore'
        Participant2:
          $ref: '#/components/schemas/SoccerTotalScore'
    SoccerData:
      title: SoccerData
      type: object
      properties:
        Action:
          type: string
        Color:
          type: string
        Conditions:
          type: array
          items:
            $ref: '#/components/schemas/SoccerCondition'
        New:
          $ref: '#/components/schemas/SoccerUpdateReference'
        Corner:
          type: boolean
        FreeKickType:
          type: string
        Goal:
          type: boolean
        GoalType:
          $ref: '#/components/schemas/GoalType'
        Minutes:
          type: integer
          format: int32
        Outcome:
          type: string
        Participant:
          type: integer
          format: int32
        Penalty:
          type: boolean
        PlayerId:
          type: integer
          format: int32
        PlayerInId:
          type: integer
          format: int32
        PlayerOutId:
          type: integer
          format: int32
        Previous:
          $ref: '#/components/schemas/SoccerUpdateReference'
        StatusId:
          type: integer
          format: int32
        ThrowInType:
          type: string
        Type:
          type: string
        RedCard:
          type: boolean
        YellowCard:
          type: boolean
        VAR:
          type: boolean
        VenueType:
          $ref: '#/components/schemas/SoccerVenueType'
    Map_ScoreStatKey:
      title: Map_ScoreStatKey
      type: object
      additionalProperties:
        type: integer
        format: int32
    KickoffDetails:
      title: KickoffDetails
      type: object
      properties:
        Team:
          $ref: '#/components/schemas/Participant'
    LineupData:
      title: LineupData
      type: object
      required:
        - id
        - normativeId
        - preferredName
        - gender
        - updateDateMillis
      properties:
        id:
          type: string
        normativeId:
          type: integer
          format: int32
        preferredName:
          type: string
        gender:
          type: string
        updateDateMillis:
          type: integer
          format: int64
        lineups:
          type: array
          items:
            $ref: '#/components/schemas/PlayerLineupData'
    SoccerPossessionType:
      title: SoccerPossessionType
      oneOf:
        - $ref: '#/components/schemas/AttackPossession'
        - $ref: '#/components/schemas/DangerPossession'
        - $ref: '#/components/schemas/HighDangerPossession'
        - $ref: '#/components/schemas/SafePossession'
    SoccerPartiState:
      title: SoccerPartiState
      type: object
      required:
        - PossibleEvent
      properties:
        PossibleEvent:
          $ref: '#/components/schemas/SoccerPossiblePartiEvent'
    UsFootballPartiState:
      title: UsFootballPartiState
      type: object
      required:
        - Timeouts
        - Challenges
        - PossibleEvent
      properties:
        Timeouts:
          type: integer
          format: int32
        Challenges:
          type: integer
          format: int32
        PossibleEvent:
          $ref: '#/components/schemas/UsFootballPossiblePartiEvent'
    BasketballPartiState:
      title: BasketballPartiState
      type: object
      required:
        - AttackingBasket
        - ActiveTimeout
        - Challenges
      properties:
        AttackingBasket:
          type: boolean
        ActiveTimeout:
          type: boolean
        Challenges:
          type: integer
          format: int32
    SoccerPossibleNeutralEvent:
      title: SoccerPossibleNeutralEvent
      type: object
      required:
        - RedCard
        - YellowCard
        - VAR
      properties:
        RedCard:
          type: boolean
        YellowCard:
          type: boolean
        VAR:
          type: boolean
    UsFootballPossibleEvent:
      title: UsFootballPossibleEvent
      type: object
      required:
        - penalty
        - turnover
        - challenge
      properties:
        penalty:
          type: boolean
        turnover:
          type: boolean
        challenge:
          type: boolean
    A:
      title: A
      type: object
    C:
      title: C
      type: object
    F:
      title: F
      type: object
    FO:
      title: FO
      type: object
    HT:
      title: HT
      type: object
    I:
      title: I
      type: object
    NS:
      title: NS
      type: object
    OB:
      title: OB
      type: object
    OB1:
      title: OB1
      type: object
    OB10:
      title: OB10
      type: object
    OB11:
      title: OB11
      type: object
    OB2:
      title: OB2
      type: object
    OB3:
      title: OB3
      type: object
    OB4:
      title: OB4
      type: object
    OB5:
      title: OB5
      type: object
    OB6:
      title: OB6
      type: object
    OB7:
      title: OB7
      type: object
    OB8:
      title: OB8
      type: object
    OB9:
      title: OB9
      type: object
    OT:
      title: OT
      type: object
    OT1:
      title: OT1
      type: object
    OT10:
      title: OT10
      type: object
    OT11:
      title: OT11
      type: object
    OT12:
      title: OT12
      type: object
    OT2:
      title: OT2
      type: object
    OT3:
      title: OT3
      type: object
    OT4:
      title: OT4
      type: object
    OT5:
      title: OT5
      type: object
    OT6:
      title: OT6
      type: object
    OT7:
      title: OT7
      type: object
    OT8:
      title: OT8
      type: object
    OT9:
      title: OT9
      type: object
    Q1:
      title: Q1
      type: object
    Q1B:
      title: Q1B
      type: object
    Q2:
      title: Q2
      type: object
    Q3:
      title: Q3
      type: object
    Q3B:
      title: Q3B
      type: object
    Q4:
      title: Q4
      type: object
    TXCC:
      title: TXCC
      type: object
    TXCS:
      title: TXCS
      type: object
    WO:
      title: WO
      type: object
    A1:
      title: A
      type: object
    C1:
      title: C
      type: object
    F1:
      title: F
      type: object
    FO1:
      title: FO
      type: object
    H1:
      title: H1
      type: object
    H2:
      title: H2
      type: object
    HT1:
      title: HT
      type: object
    I1:
      title: I
      type: object
    NS1:
      title: NS
      type: object
    OB12:
      title: OB
      type: object
    OT13:
      title: OT
      type: object
    Q11:
      title: Q1
      type: object
    Q1B1:
      title: Q1B
      type: object
    Q21:
      title: Q2
      type: object
    Q31:
      title: Q3
      type: object
    Q3B1:
      title: Q3B
      type: object
    Q41:
      title: Q4
      type: object
    TXCC1:
      title: TXCC
      type: object
    TXCS1:
      title: TXCS
      type: object
    WO1:
      title: WO
      type: object
    A2:
      title: A
      type: object
    C2:
      title: C
      type: object
    ET1:
      title: ET1
      type: object
    ET2:
      title: ET2
      type: object
    F2:
      title: F
      type: object
    FET:
      title: FET
      type: object
    FPE:
      title: FPE
      type: object
    H11:
      title: H1
      type: object
    H21:
      title: H2
      type: object
    HT2:
      title: HT
      type: object
    HTET:
      title: HTET
      type: object
    I2:
      title: I
      type: object
    NS2:
      title: NS
      type: object
    P:
      title: P
      type: object
    PE:
      title: PE
      type: object
    TXCC2:
      title: TXCC
      type: object
    TXCS2:
      title: TXCS
      type: object
    WET:
      title: WET
      type: object
    WPE:
      title: WPE
      type: object
    Basketball:
      title: Basketball
      type: object
    Soccer:
      title: Soccer
      type: object
    UsFootball:
      title: UsFootball
      type: object
    Participant:
      title: Participant
      oneOf:
        - $ref: '#/components/schemas/Parti1'
        - $ref: '#/components/schemas/Parti2'
    Side:
      title: Side
      oneOf:
        - $ref: '#/components/schemas/Defensive'
        - $ref: '#/components/schemas/Offensive'
    InPlayOutcome:
      title: InPlayOutcome
      oneOf:
        - $ref: '#/components/schemas/Blocked'
        - $ref: '#/components/schemas/Downed'
        - $ref: '#/components/schemas/FairCatch'
        - $ref: '#/components/schemas/FieldGoalMissed'
        - $ref: '#/components/schemas/FieldGoalSuccessful'
        - $ref: '#/components/schemas/Fumble'
        - $ref: '#/components/schemas/OutOfBounds'
        - $ref: '#/components/schemas/PassComplete'
        - $ref: '#/components/schemas/PassIncomplete'
        - $ref: '#/components/schemas/PassIntercepted'
        - $ref: '#/components/schemas/PassSack'
        - $ref: '#/components/schemas/Recovered'
        - $ref: '#/components/schemas/Return'
        - $ref: '#/components/schemas/RushComplete'
        - $ref: '#/components/schemas/Touchback'
    KickoffType:
      title: KickoffType
      oneOf:
        - $ref: '#/components/schemas/Onside'
        - $ref: '#/components/schemas/Regular'
    KickoffOutcome:
      title: KickoffOutcome
      oneOf:
        - $ref: '#/components/schemas/FairCatch'
        - $ref: '#/components/schemas/Fumble'
        - $ref: '#/components/schemas/OutOfBounds'
        - $ref: '#/components/schemas/Recovered'
        - $ref: '#/components/schemas/Return'
        - $ref: '#/components/schemas/Touchback'
    KickoffSource:
      title: KickoffSource
      oneOf:
        - $ref: '#/components/schemas/ConversionSafety'
        - $ref: '#/components/schemas/DefensiveConversion'
        - $ref: '#/components/schemas/Safety1Pt'
        - $ref: '#/components/schemas/Safety2Pt'
    UsFootballTotalScore:
      title: UsFootballTotalScore
      type: object
      properties:
        Q1:
          $ref: '#/components/schemas/UsFootballScore'
        Q2:
          $ref: '#/components/schemas/UsFootballScore'
        HT:
          $ref: '#/components/schemas/UsFootballScore'
        Q3:
          $ref: '#/components/schemas/UsFootballScore'
        Q4:
          $ref: '#/components/schemas/UsFootballScore'
        OT:
          $ref: '#/components/schemas/Map_UsFootballScore'
        OTTotal:
          $ref: '#/components/schemas/UsFootballScore'
        Total:
          $ref: '#/components/schemas/UsFootballScore'
    UpdateReference:
      title: UpdateReference
      type: object
      properties:
        Clock:
          $ref: '#/components/schemas/UsFootballFixtureClock'
        IsTeam:
          type: boolean
        Outcome:
          $ref: '#/components/schemas/PassOutcome'
        PlayerId:
          type: integer
          format: int32
        ReceiverId:
          type: integer
          format: int32
        RusherId:
          type: integer
          format: int32
        SackedPlayerId:
          type: integer
          format: int32
        Yards:
          type: integer
          format: int32
        YardsToGo:
          type: integer
          format: int32
    BasketballTotalScore:
      title: BasketballTotalScore
      type: object
      properties:
        Period:
          $ref: '#/components/schemas/Map_BasketballScore'
        HT:
          $ref: '#/components/schemas/BasketballScore'
        OT:
          $ref: '#/components/schemas/Map_BasketballScore'
        OTTotal:
          $ref: '#/components/schemas/BasketballScore'
        Total:
          $ref: '#/components/schemas/BasketballScore'
    BasketballUpdateReference:
      title: BasketballUpdateReference
      type: object
      properties:
        AssistConfirmed:
          type: boolean
        AssistId:
          type: integer
          format: int32
        BlockConfirmed:
          type: boolean
        BlockerId:
          type: integer
          format: int32
        Clock:
          $ref: '#/components/schemas/UsFootballFixtureClock'
        FouledId:
          type: integer
          format: int32
        IsPlayerRebound:
          type: boolean
        IsTeam:
          type: boolean
        IsTeamRebound:
          type: boolean
        Outcome:
          description: Union of PointAttemptOutcome and FreeThrowOutcome
          type: string
        Participant:
          type: integer
          format: int32
        PlayerId:
          type: integer
          format: int32
        PlayerInId:
          type: integer
          format: int32
        PlayerOutId:
          type: integer
          format: int32
        TeamFoul:
          type: boolean
        TurnoverId:
          type: integer
          format: int32
        Type:
          description: Union of FoulType, ReboundType, and FreeThrowType
          type: string
        UpdatePlayersOnCourt:
          type: boolean
    SoccerTotalScore:
      title: SoccerTotalScore
      type: object
      properties:
        H1:
          $ref: '#/components/schemas/SoccerScore'
        HT:
          $ref: '#/components/schemas/SoccerScore'
        H2:
          $ref: '#/components/schemas/SoccerScore'
        ET1:
          $ref: '#/components/schemas/SoccerScore'
        ET2:
          $ref: '#/components/schemas/SoccerScore'
        PE:
          $ref: '#/components/schemas/SoccerScore'
        ETTotal:
          $ref: '#/components/schemas/SoccerScore'
        Total:
          $ref: '#/components/schemas/SoccerScore'
    SoccerCondition:
      title: SoccerCondition
      description: Union of SoccerWeather and SoccerPitchCondition
      type: string
    SoccerUpdateReference:
      title: SoccerUpdateReference
      type: object
      properties:
        Clock:
          $ref: '#/components/schemas/SoccerFixtureClock'
        FreeKickType:
          $ref: '#/components/schemas/FreeKickType'
        GoalType:
          $ref: '#/components/schemas/GoalType'
        Minutes:
          type: integer
          format: int32
        Outcome:
          description: >-
            A string representing either a ShotOutcome, SoccerPenaltyOutcome, or
            InjuryOutcome
          type: string
        PlayerId:
          type: integer
          format: int32
        PlayerInId:
          type: integer
          format: int32
        PlayerOutId:
          type: integer
          format: int32
        ThrowInType:
          $ref: '#/components/schemas/ThrowInType'
        Type:
          type: string
    GoalType:
      title: GoalType
      oneOf:
        - $ref: '#/components/schemas/Head'
        - $ref: '#/components/schemas/Other'
        - $ref: '#/components/schemas/OwnGoal'
        - $ref: '#/components/schemas/Shot'
    SoccerVenueType:
      title: SoccerVenueType
      oneOf:
        - $ref: '#/components/schemas/Away'
        - $ref: '#/components/schemas/Home'
        - $ref: '#/components/schemas/Neutral'
    PlayerLineupData:
      title: PlayerLineupData
      type: object
      required:
        - fixturePlayerId
        - statusId
        - positionId
        - unitId
        - rosterNumber
        - starter
        - starred
        - player
      properties:
        fixturePlayerId:
          type: integer
          format: int32
        statusId:
          type: integer
          format: int32
        positionId:
          type: integer
          format: int32
        unitId:
          type: integer
          format: int32
        rosterNumber:
          type: string
        starter:
          type: boolean
        starred:
          type: boolean
        player:
          $ref: '#/components/schemas/PlayerData'
    AttackPossession:
      title: AttackPossession
      type: object
    DangerPossession:
      title: DangerPossession
      type: object
    HighDangerPossession:
      title: HighDangerPossession
      type: object
    SafePossession:
      title: SafePossession
      type: object
    SoccerPossiblePartiEvent:
      title: SoccerPossiblePartiEvent
      type: object
      required:
        - Goal
        - Penalty
        - Corner
      properties:
        Goal:
          type: boolean
        Penalty:
          type: boolean
        Corner:
          type: boolean
    UsFootballPossiblePartiEvent:
      title: UsFootballPossiblePartiEvent
      type: object
      required:
        - touchdown
        - fieldGoal
        - safety
        - 4thDownConversion
        - 2ptConversionAttempt
        - 1stDown
        - bigPlay
        - punt
      properties:
        touchdown:
          type: boolean
        fieldGoal:
          type: boolean
        safety:
          type: boolean
        4thDownConversion:
          type: boolean
        2ptConversionAttempt:
          type: boolean
        1stDown:
          type: boolean
        bigPlay:
          type: boolean
        punt:
          type: boolean
    Parti1:
      title: Parti1
      type: object
    Parti2:
      title: Parti2
      type: object
    Defensive:
      title: Defensive
      type: object
    Offensive:
      title: Offensive
      type: object
    Blocked:
      title: Blocked
      type: object
    Downed:
      title: Downed
      type: object
    FairCatch:
      title: FairCatch
      type: object
    FieldGoalMissed:
      title: FieldGoalMissed
      type: object
    FieldGoalSuccessful:
      title: FieldGoalSuccessful
      type: object
    Fumble:
      title: Fumble
      type: object
    OutOfBounds:
      title: OutOfBounds
      type: object
    PassComplete:
      title: PassComplete
      type: object
    PassIncomplete:
      title: PassIncomplete
      type: object
    PassIntercepted:
      title: PassIntercepted
      type: object
    PassSack:
      title: PassSack
      type: object
    Recovered:
      title: Recovered
      type: object
    Return:
      title: Return
      type: object
    RushComplete:
      title: RushComplete
      type: object
    Touchback:
      title: Touchback
      type: object
    Onside:
      title: Onside
      type: object
    Regular:
      title: Regular
      type: object
    ConversionSafety:
      title: ConversionSafety
      type: object
    DefensiveConversion:
      title: DefensiveConversion
      type: object
    Safety1Pt:
      title: Safety1Pt
      type: object
    Safety2Pt:
      title: Safety2Pt
      type: object
    UsFootballScore:
      title: UsFootballScore
      type: object
      required:
        - Score
        - Touchdown
        - Safety
        - 1ptSafety
        - 1ptConversion
        - 2ptConversion
        - FieldGoal
        - Defensive2ptConversion
      properties:
        Score:
          type: integer
          format: int32
        Touchdown:
          type: integer
          format: int32
        Safety:
          type: integer
          format: int32
        1ptSafety:
          type: integer
          format: int32
        1ptConversion:
          type: integer
          format: int32
        2ptConversion:
          type: integer
          format: int32
        FieldGoal:
          type: integer
          format: int32
        Defensive2ptConversion:
          type: integer
          format: int32
    Map_UsFootballScore:
      title: Map_UsFootballScore
      type: object
      additionalProperties:
        $ref: '#/components/schemas/UsFootballScore'
    PassOutcome:
      title: PassOutcome
      oneOf:
        - $ref: '#/components/schemas/Complete'
        - $ref: '#/components/schemas/Incomplete'
        - $ref: '#/components/schemas/Intercepted'
        - $ref: '#/components/schemas/Sack'
    Map_BasketballScore:
      title: Map_BasketballScore
      type: object
      additionalProperties:
        $ref: '#/components/schemas/BasketballScore'
    BasketballScore:
      title: BasketballScore
      type: object
      required:
        - Score
        - Fouls
        - PersonalFouls
        - Blocks
        - Rebounds
        - FreeThrows_made
        - 2pts_made
        - 3pts_made
        - FreeThrows_missed
        - 2pts_missed
        - 3pts_missed
        - FreeThrows_attempts
        - 2pts_attempts
        - 3pts_attempts
        - Assists
        - Turnovers
        - Steals
        - UsedTimeouts
      properties:
        Score:
          type: integer
          format: int32
        Fouls:
          type: integer
          format: int32
        PersonalFouls:
          type: integer
          format: int32
        Blocks:
          type: integer
          format: int32
        Rebounds:
          type: integer
          format: int32
        FreeThrows_made:
          type: integer
          format: int32
        2pts_made:
          type: integer
          format: int32
        3pts_made:
          type: integer
          format: int32
        FreeThrows_missed:
          type: integer
          format: int32
        2pts_missed:
          type: integer
          format: int32
        3pts_missed:
          type: integer
          format: int32
        FreeThrows_attempts:
          type: integer
          format: int32
        2pts_attempts:
          type: integer
          format: int32
        3pts_attempts:
          type: integer
          format: int32
        Assists:
          type: integer
          format: int32
        Turnovers:
          type: integer
          format: int32
        Steals:
          type: integer
          format: int32
        UsedTimeouts:
          type: integer
          format: int32
    SoccerScore:
      title: SoccerScore
      type: object
      required:
        - Goals
        - YellowCards
        - RedCards
        - Corners
      properties:
        Goals:
          type: integer
          format: int32
        YellowCards:
          type: integer
          format: int32
        RedCards:
          type: integer
          format: int32
        Corners:
          type: integer
          format: int32
    SoccerFixtureClock:
      title: SoccerFixtureClock
      type: object
      required:
        - running
        - seconds
      properties:
        running:
          type: boolean
        seconds:
          type: integer
          format: int32
    FreeKickType:
      title: FreeKickType
      oneOf:
        - $ref: '#/components/schemas/Attack'
        - $ref: '#/components/schemas/Danger'
        - $ref: '#/components/schemas/HighDanger'
        - $ref: '#/components/schemas/Offside'
        - $ref: '#/components/schemas/Safe'
    ThrowInType:
      title: ThrowInType
      oneOf:
        - $ref: '#/components/schemas/Attack'
        - $ref: '#/components/schemas/Danger'
        - $ref: '#/components/schemas/Safe'
    Head:
      title: Head
      type: object
    Other:
      title: Other
      type: object
    OwnGoal:
      title: OwnGoal
      type: object
    Shot:
      title: Shot
      type: object
    Away:
      title: Away
      type: object
    Home:
      title: Home
      type: object
    Neutral:
      title: Neutral
      type: object
    PlayerData:
      title: PlayerData
      type: object
      required:
        - id
        - normativeId
        - country
        - team
        - dateOfBirth
        - gender
        - preferredName
        - updateDateMillis
      properties:
        id:
          type: string
        normativeId:
          type: integer
          format: int32
        country:
          type: string
        team:
          type: string
        dateOfBirth:
          type: string
        gender:
          type: string
        preferredName:
          type: string
        updateDateMillis:
          type: integer
          format: int64
    Complete:
      title: Complete
      type: object
    Incomplete:
      title: Incomplete
      type: object
    Intercepted:
      title: Intercepted
      type: object
    Sack:
      title: Sack
      type: object
    Attack:
      title: Attack
      type: object
    Danger:
      title: Danger
      type: object
    HighDanger:
      title: HighDanger
      type: object
    Offside:
      title: Offside
      type: object
    Safe:
      title: Safe
      type: object
  securitySchemes:
    httpAuth:
      type: http
      description: User's session JWT.
      scheme: bearer
    apiKeyAuth:
      type: apiKey
      description: The user's long-lived API token, obtained from the activation endpoint.
      name: X-Api-Token
      in: header

````