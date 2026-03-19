const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Deploy SBT
  const SBT = await ethers.getContractFactory("AstraRiskSBT");
  const sbt = await SBT.deploy();
  await sbt.waitForDeployment();
  const sbtAddress = await sbt.getAddress();
  console.log("AstraRiskSBT deployed to:", sbtAddress);

  // Deploy Lending with SBT address
  const Lending = await ethers.getContractFactory("AstraRiskLending");
  const lending = await Lending.deploy(sbtAddress);
  await lending.waitForDeployment();
  const lendingAddress = await lending.getAddress();
  console.log("AstraRiskLending deployed to:", lendingAddress);

  console.log("\n--- Copy these into your frontend ---");
  console.log(`SBT_ADDRESS=${sbtAddress}`);
  console.log(`LENDING_ADDRESS=${lendingAddress}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
