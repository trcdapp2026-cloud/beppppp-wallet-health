import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  BNB_MAINNET_RPC_URL: z.string().url(),
  EXECUTOR_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  ALLOWANCE_SPENDER_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  USDT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  BACKEND_PORT: z.coerce.number().default(4000),
  DATABASE_PATH: z.string().default("./data/allowance-monitor.json")
});
export const config = schema.parse(process.env);