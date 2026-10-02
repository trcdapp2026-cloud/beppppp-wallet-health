import fs from "node:fs";
import path from "node:path";

export type WalletRecord = { address: string; receiver: 1 | 2; active: boolean; createdAt: string; lastCheckedAt?: string; lastError?: string };
export type HistoryRecord = { id: string; wallet: string; receiver: 1 | 2; amount: string; txHash?: string; status: "submitted" | "confirmed" | "failed"; error?: string; createdAt: string };
type Database = { wallets: WalletRecord[]; history: HistoryRecord[] };

export class Store {
  private readonly file: string;
  private data: Database;
  constructor(file: string) {
    this.file = path.resolve(file);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    this.data = fs.existsSync(this.file) ? JSON.parse(fs.readFileSync(this.file, "utf8")) : { wallets: [], history: [] };
  }
  private save() { const temp = `${this.file}.tmp`; fs.writeFileSync(temp, JSON.stringify(this.data, null, 2)); fs.renameSync(temp, this.file); }
  listWallets() { return this.data.wallets; }
  getWallet(address: string) { return this.data.wallets.find((wallet) => wallet.address.toLowerCase() === address.toLowerCase()); }
  register(wallet: WalletRecord) { this.data.wallets = this.data.wallets.filter((item) => item.address.toLowerCase() !== wallet.address.toLowerCase()); this.data.wallets.push(wallet); this.save(); return wallet; }
  remove(address: string) { const wallet = this.getWallet(address); if (wallet) { wallet.active = false; this.save(); } return wallet; }
  update(address: string, update: Partial<WalletRecord>) { const wallet = this.getWallet(address); if (wallet) { Object.assign(wallet, update); this.save(); } return wallet; }
  addHistory(record: HistoryRecord) { this.data.history.unshift(record); this.data.history = this.data.history.slice(0, 1000); this.save(); return record; }
  history(wallet?: string) { return wallet ? this.data.history.filter((item) => item.wallet.toLowerCase() === wallet.toLowerCase()) : this.data.history; }
}