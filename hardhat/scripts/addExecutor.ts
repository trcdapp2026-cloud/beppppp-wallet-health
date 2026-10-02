import { ethers } from "hardhat";

const CONTRACT_ADDRESS = "0xD8446C23b0C82AA17Ced649855BE58bc1d5C873D";
const EXECUTOR_ADDRESS = "0x060f05ec7c8fbd0883316fd8ccdf90362ea44e5c";

async function main(): Promise<void> {
  const [owner] = await ethers.getSigners();
  const allowanceSpender = await ethers.getContractAt(
    "AllowanceSpender",
    CONTRACT_ADDRESS,
    owner
  );

  const transaction = await allowanceSpender.addExecutor(EXECUTOR_ADDRESS);
  await transaction.wait();

  console.log(`Owner address: ${owner.address}`);
  console.log(`Contract address: ${CONTRACT_ADDRESS}`);
  console.log(`Executor address: ${EXECUTOR_ADDRESS}`);
  console.log(`Transaction hash: ${transaction.hash}`);
  console.log("Executor added successfully!");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
