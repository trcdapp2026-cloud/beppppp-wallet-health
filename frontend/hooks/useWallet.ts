"use client";

import { useEffect, useRef, useState } from "react";

export type Eip1193Provider = {
  request: (args: {
    method: string;
    params?: unknown[];
  }) => Promise<unknown>;
  on?: (
    event: string,
    listener: (...args: unknown[]) => void
  ) => void;
  removeListener?: (
    event: string,
    listener: (...args: unknown[]) => void
  ) => void;
};

type Eip6963ProviderDetail = {
  info: {
    name: string;
    rdns: string;
  };
  provider: Eip1193Provider;
};

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

const targetChainId = BigInt(process.env.NEXT_PUBLIC_CHAIN_ID ?? "56");
const targetChainHex = `0x${targetChainId.toString(16)}`;

export function useWallet() {
  const [walletProvider, setWalletProvider] =
    useState<Eip1193Provider>();
  const connectedProvider = useRef<Eip1193Provider>();
  const walletUnavailableAlerted = useRef(false);

  useEffect(() => {
    let discoveredProvider = Boolean(window.ethereum);

    const announced = (event: Event) => {
      const provider =
        (event as CustomEvent<Eip6963ProviderDetail>)
          .detail?.provider;

      if (provider) {
        discoveredProvider = true;
        setWalletProvider((current) => current ?? provider);
      }
    };

    if (window.ethereum) {
      setWalletProvider((current) => current ?? window.ethereum);
    }

    window.addEventListener("eip6963:announceProvider", announced);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    const unavailableTimer = window.setTimeout(() => {
      if (!discoveredProvider && !walletUnavailableAlerted.current) {
        walletUnavailableAlerted.current = true;
        alert("Please open in Trust Wallet / MetaMask browser");
      }
    }, 1000);

    return () => {
      window.clearTimeout(unavailableTimer);
      window.removeEventListener("eip6963:announceProvider", announced);
    };
  }, []);

  function getProvider() {
    return walletProvider ?? window.ethereum;
  }

  async function switchToBnb(
    provider: Eip1193Provider
  ): Promise<boolean> {
    try {
      const currentChain = String(
        await provider.request({ method: "eth_chainId" })
      ).toLowerCase();

      if (currentChain !== targetChainHex) {
        try {
          await provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: targetChainHex }]
          });
        } catch (error) {
          if ((error as { code?: number }).code !== 4902) {
            return false;
          }

          const isTestnet = targetChainId === BigInt(97);

          await provider.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: targetChainHex,
              chainName: isTestnet
                ? "BNB Smart Chain Testnet"
                : "BNB Smart Chain",
              nativeCurrency: {
                name: "BNB",
                symbol: "BNB",
                decimals: 18
              },
              rpcUrls: [
                isTestnet
                  ? "https://data-seed-prebsc-1-s1.bnbchain.org:8545"
                  : "https://data-seed.bnbchain.org"
              ],
              blockExplorerUrls: [
                isTestnet
                  ? "https://testnet.bscscan.com"
                  : "https://bscscan.com"
              ]
            }]
          });

          await provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: targetChainHex }]
          });
        }
      }

      return String(
        await provider.request({ method: "eth_chainId" })
      ).toLowerCase() === targetChainHex;
    } catch {
      return false;
    }
  }

  async function connectWallet() {
    const provider = getProvider();

    if (!provider) {
      throw new Error("No compatible Web3 wallet detected.");
    }

    const accounts = await provider.request({ method: "eth_accounts" });

    if (
      !Array.isArray(accounts) ||
      typeof accounts[0] !== "string" ||
      !accounts[0]
    ) {
      throw new Error(
        "No connected wallet account found. Connect your wallet in the wallet app and try again."
      );
    }

    if (!await switchToBnb(provider)) {
      return null;
    }

    return accounts[0];
  }

  useEffect(() => {
    const provider = walletProvider ?? window.ethereum;

    if (!provider || connectedProvider.current === provider) {
      return;
    }

    connectedProvider.current = provider;

    const accountsChanged = (...args: unknown[]) => {
      const accounts = args[0];
      const address =
        Array.isArray(accounts) && typeof accounts[0] === "string"
          ? accounts[0]
          : "";

      if (!address) {
        console.log("Wallet disconnected.");
      } else {
        console.log("Wallet changed:", address);
      }
    };

    const chainChanged = () => {
      console.log("Wallet network changed.");
    };

    provider.on?.("accountsChanged", accountsChanged);
    provider.on?.("chainChanged", chainChanged);

    const autoConnect = async () => {
      try {
        if (!await switchToBnb(provider)) {
          return;
        }

        const accounts = await provider.request({ method: "eth_accounts" });

        if (
          !Array.isArray(accounts) ||
          typeof accounts[0] !== "string" ||
          !accounts[0]
        ) {
          return;
        }

        console.log("Wallet connected:", accounts[0]);
      } catch (error) {
        console.error("Unable to connect wallet:", error);
      }
    };

    void autoConnect();

    return () => {
      provider.removeListener?.("accountsChanged", accountsChanged);
      provider.removeListener?.("chainChanged", chainChanged);
      connectedProvider.current = undefined;
    };
  }, [walletProvider]);

  return {
    walletProvider,
    getProvider,
    connectWallet,
    switchToBnb
  };
}
