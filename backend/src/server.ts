import express from "express";
import cors from "cors";
import { ethers } from "ethers";
import { config } from "./config";
import { Store } from "./store";
import { WalletMonitor } from "./monitor";

const app = express();
app.use(cors());
app.use(express.json());
const store = new Store(config.DATABASE_PATH);
const monitor = new WalletMonitor(store);
const address = ethers.getAddress;

app.get("/health", (_req, res) => res.json({ ok: true, service: "allowance-monitor" }));
app.get("/api/wallets", (_req, res) => res.json(store.listWallets()));
app.post("/api/wallets", (req, res) => {
  const raw = String(req.body?.address ?? "");
  try {
    const wallet = store.register({ address: address(raw), receiver: req.body?.receiver === 2 ? 2 : 1, active: true, createdAt: new Date().toISOString() });
    void monitor.scanWallet(wallet.address);
    res.status(201).json(wallet);
  } catch { res.status(400).json({ error: "A valid wallet address is required" }); }
});
app.delete("/api/wallets/:address", (req, res) => {
  try { const wallet = store.remove(address(req.params.address)); if (!wallet) return res.status(404).json({ error: "Wallet not registered" }); res.json(wallet); }
  catch { res.status(400).json({ error: "Invalid wallet address" }); }
});
app.get("/api/wallets/:address/status", (req, res) => {
  try { const wallet = store.getWallet(address(req.params.address)); if (!wallet) return res.status(404).json({ error: "Wallet not registered" }); res.json(wallet); }
  catch { res.status(400).json({ error: "Invalid wallet address" }); }
});
app.get("/api/history", (req, res) => res.json(store.history(typeof req.query.wallet === "string" ? req.query.wallet : undefined)));

const server = app.listen(config.BACKEND_PORT, () => console.log(`API listening on http://localhost:${config.BACKEND_PORT}`));
monitor.start().catch((error) => { console.error("Monitor failed to start:", error); server.close(); process.exitCode = 1; });
process.on("SIGTERM", () => { monitor.stop(); server.close(); });