# Allowance Spending DApp

Non-custodial BEP-20 USDT allowance execution for BNB Smart Chain. This is not a subscription product and contains no recurring payment logic. Users connect MetaMask, call the standard USDT `approve()` function for `AllowanceSpender`, and keep funds in their own wallet until an authorized executor submits a validated execution.

## Architecture

- `hardhat/`: Solidity `^0.8.20` contract using OpenZeppelin `Ownable`, `ReentrancyGuard`, and `SafeERC20`.
- `backend/`: Express + ethers v6 monitor. It stores public wallet registrations and history, reads `EXECUTOR_PRIVATE_KEY` only from environment, and calls only `executeToReceiver1` or `executeToReceiver2`.
- `frontend/`: Next.js migration of the supplied layout with MetaMask connection, BNB chain detection, approval, and notifications.

## Deploy

1. Copy `.env.example` to `.env` and fill RPC URLs, deployer key, receiver wallets, and the executor key. Never commit `.env`.
2. Install and compile: `npm install && npm run compile`.
3. Deploy: `npm run deploy:testnet` (use `deploy:mainnet` only after review). Record the deployed address in `ALLOWANCE_SPENDER_ADDRESS` and `NEXT_PUBLIC_ALLOWANCE_SPENDER_ADDRESS`.
4. Add the executor wallet with the owner account: call `addExecutor(EXECUTOR_ADDRESS)` using the deployed contract. The backend refuses to start if its executor is not authorized.
5. Build and run: `npm run build`, then `npm run start --workspace backend` and `npm run start --workspace frontend`.

## Operational notes

The monitor polls every 30 seconds. At a balance of at least 5 USDT and sufficient allowance, it submits the wallet's entire current USDT balance to the registered receiver through the contract. Reverts are captured in history. Use a dedicated executor key with only the required gas balance, protect environment secrets with a secret manager in production, and review receiver addresses before mainnet deployment.