/**
 * Configuration for Visa TAP zkML Demo
 */

type Address = `0x${string}`;

/**
 * Arc Testnet Chain Configuration
 */
export const ARC_CHAIN = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrl: 'https://rpc.testnet.arc.network',
  explorerUrl: 'https://testnet.arcscan.app',
} as const;

/**
 * Contract Addresses on Arc Testnet
 */
export const ADDRESSES = {
  usdc: '0x1Fb62895099b7931FFaBEa1AdF92e20Df7F29213' as Address,
  proofAttestation: '0xBE9a5DF7C551324CB872584C6E5bF56799787952' as Address,
  spendingGate: '0x6A47D13593c00359a1c5Fc6f9716926aF184d138' as Address,
  arcAgent: '0x982Cd9663EBce3eB8Ab7eF511a6249621C79E384' as Address,
  demoMerchant: '0x8ba1f109551bD432803012645Ac136ddd64DBA72' as Address,
} as const;

/**
 * Prover Configuration
 */
export const PROVER_CONFIG = {
  // Default to the deployed prover on Render, fallback to localhost for local dev
  url: import.meta.env.VITE_PROVER_URL || 'https://spendingproofs-prover.onrender.com',
  localUrl: 'http://localhost:3001',
  timeoutMs: 120000, // 2 minutes for proof generation
} as const;

/**
 * Get explorer URL for a transaction
 */
export function getExplorerTxUrl(txHash: string): string {
  return `${ARC_CHAIN.explorerUrl}/tx/${txHash}`;
}

/**
 * Get explorer URL for an address
 */
export function getExplorerAddressUrl(address: string): string {
  return `${ARC_CHAIN.explorerUrl}/address/${address}`;
}
