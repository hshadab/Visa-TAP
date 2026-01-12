/**
 * Arc Testnet Wallet Client
 *
 * Pre-funded wallet for demo transactions.
 * Uses USDC for gas (Arc's native gas token).
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  formatUnits,
  parseUnits,
  type Address,
  type Hash,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

// Arc Testnet chain definition
export const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network'] },
  },
  blockExplorers: {
    default: { name: 'Arcscan', url: 'https://testnet.arcscan.app' },
  },
} as const

// Contract addresses on Arc Testnet
export const CONTRACTS = {
  usdc: '0x1Fb62895099b7931FFaBEa1AdF92e20Df7F29213' as Address,
  proofAttestation: '0xBE9a5DF7C551324CB872584C6E5bF56799787952' as Address,
  spendingGate: '0x6A47D13593c00359a1c5Fc6f9716926aF184d138' as Address,
  demoMerchant: '0x8ba1f109551bD432803012645Ac136ddd64DBA72' as Address,
}

// Demo wallet (pre-funded with testnet USDC)
const DEMO_PRIVATE_KEY = '0x7a92caeb1cedc29b903a35ff29f7e2bc8717cde4c205a07bafe6b0aeea4537ad'
export const demoAccount = privateKeyToAccount(DEMO_PRIVATE_KEY)

// Public client for reading
export const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(),
})

// Wallet client for writing
export const walletClient = createWalletClient({
  account: demoAccount,
  chain: arcTestnet,
  transport: http(),
})

// ERC20 ABI (minimal for transfer)
const erc20Abi = [
  {
    name: 'transfer',
    type: 'function',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

// ProofAttestation ABI (with agent identity)
const proofAttestationAbi = [
  {
    name: 'attestProofWithAgent',
    type: 'function',
    inputs: [
      { name: 'agentId', type: 'bytes32' },
      { name: 'proofHash', type: 'bytes32' },
      { name: 'modelHash', type: 'bytes32' },
      { name: 'inputHash', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    name: 'attestProof',
    type: 'function',
    inputs: [
      { name: 'proofHash', type: 'bytes32' },
      { name: 'modelHash', type: 'bytes32' },
      { name: 'inputHash', type: 'bytes32' },
    ],
    outputs: [],
  },
] as const

/**
 * Get USDC balance of demo wallet
 */
export async function getBalance(): Promise<string> {
  const balance = await publicClient.readContract({
    address: CONTRACTS.usdc,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [demoAccount.address],
  })
  return formatUnits(balance, 6)
}

/**
 * Transfer USDC to merchant
 * Default: 0.01 USDC ($0.01)
 */
export async function transferUsdc(
  to: Address = CONTRACTS.demoMerchant,
  amountUsdc: number = 0.01
): Promise<{ hash: Hash; explorerUrl: string }> {
  const amount = parseUnits(amountUsdc.toString(), 6)

  const hash = await walletClient.writeContract({
    address: CONTRACTS.usdc,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [to, amount],
  })

  return {
    hash,
    explorerUrl: `https://testnet.arcscan.app/tx/${hash}`,
  }
}

/**
 * Attest proof on-chain with agent identity
 * Anchors: WHO (agentId) + WHAT (inputHash) + HOW (proofHash, modelHash)
 */
export async function attestProof(
  proofHash: string,
  modelHash: string,
  inputHash: string,
  agentId?: string
): Promise<{ hash: Hash; explorerUrl: string }> {
  // Ensure hashes are bytes32 format
  const formatHash = (h: string): `0x${string}` => {
    const clean = h.startsWith('0x') ? h.slice(2) : h
    return `0x${clean.padStart(64, '0')}` as `0x${string}`
  }

  // Convert agent ID string to bytes32 (hash of the agent ID)
  const agentIdHash = agentId
    ? formatHash(Buffer.from(agentId).toString('hex'))
    : null

  let hash: Hash

  if (agentIdHash) {
    // Use attestProofWithAgent if agent ID provided
    hash = await walletClient.writeContract({
      address: CONTRACTS.proofAttestation,
      abi: proofAttestationAbi,
      functionName: 'attestProofWithAgent',
      args: [agentIdHash, formatHash(proofHash), formatHash(modelHash), formatHash(inputHash)],
    })
  } else {
    // Fallback to basic attestProof
    hash = await walletClient.writeContract({
      address: CONTRACTS.proofAttestation,
      abi: proofAttestationAbi,
      functionName: 'attestProof',
      args: [formatHash(proofHash), formatHash(modelHash), formatHash(inputHash)],
    })
  }

  return {
    hash,
    explorerUrl: `https://testnet.arcscan.app/tx/${hash}`,
  }
}

/** TAP Agent ID for this demo */
export const TAP_AGENT_ID = 'agent_visa_b2b_settlement_001'

/**
 * Wait for transaction confirmation
 */
export async function waitForTransaction(hash: Hash): Promise<boolean> {
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  return receipt.status === 'success'
}

/**
 * Get explorer URL for transaction
 */
export function getExplorerUrl(hash: Hash): string {
  return `https://testnet.arcscan.app/tx/${hash}`
}

/**
 * Get explorer URL for address
 */
export function getAddressUrl(address: Address): string {
  return `https://testnet.arcscan.app/address/${address}`
}
