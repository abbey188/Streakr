import type { TxlineProvider } from "./types";
import { mockTxlineProvider } from "./mock-provider";
import { realTxlineProvider } from "./real-provider";
import { txlineClient } from "./client";

export * from "./types";

/**
 * Returns the active TxLINE data source: the real client (server-side, live
 * World Cup data) when TXLINE_API_TOKEN is configured, otherwise the mock.
 * This single decision is the entire mock → real swap.
 */
export function getTxlineProvider(): TxlineProvider {
  return txlineClient.isConfigured() ? realTxlineProvider : mockTxlineProvider;
}
