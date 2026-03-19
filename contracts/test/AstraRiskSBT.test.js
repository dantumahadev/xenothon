const { expect } = require("chai");
const { ethers } = require("hardhat");
const fc = require("fast-check");

describe("AstraRiskSBT", function () {
  let sbt;
  let owner;
  let addr1;
  let addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    const SBT = await ethers.getContractFactory("AstraRiskSBT");
    sbt = await SBT.deploy();
    await sbt.waitForDeployment();
  });

  // ─── Unit Tests ───────────────────────────────────────────────────────────

  describe("mint", function () {
    it("owner can mint to a new address with correct score stored", async function () {
      const score = 75;
      await expect(sbt.mint(addr1.address, score))
        .to.emit(sbt, "Minted")
        .withArgs(addr1.address, score);

      expect(await sbt.hasMinted(addr1.address)).to.equal(true);
      expect(await sbt.getScore(addr1.address)).to.equal(score);
    });

    it("second mint to same address reverts", async function () {
      await sbt.mint(addr1.address, 75);
      await expect(sbt.mint(addr1.address, 80)).to.be.revertedWith(
        "User already has an identity SBT"
      );
    });
  });

  describe("getScore", function () {
    it("returns the stored score after mint", async function () {
      const score = 88;
      await sbt.mint(addr1.address, score);
      expect(await sbt.getScore(addr1.address)).to.equal(score);
    });
  });

  describe("updateScore", function () {
    it("owner can update score for existing SBT holder", async function () {
      await sbt.mint(addr1.address, 60);
      const newScore = 90;
      await expect(sbt.updateScore(addr1.address, newScore))
        .to.emit(sbt, "ScoreUpdated")
        .withArgs(addr1.address, newScore);

      expect(await sbt.getScore(addr1.address)).to.equal(newScore);
    });

    it("non-owner cannot call updateScore", async function () {
      await sbt.mint(addr1.address, 60);
      await expect(
        sbt.connect(addr2).updateScore(addr1.address, 90)
      ).to.be.revertedWithCustomError(sbt, "OwnableUnauthorizedAccount");
    });
  });

  // ─── Property Tests ───────────────────────────────────────────────────────

  // Feature: astrarisk-credit-infrastructure, Property 8: SBT transfer always reverts
  describe("Property 8: SBT is non-transferable", function () {
    it("transferFrom always reverts for any two non-zero addresses", async function () {
      // Mint an SBT to addr1 so there is a token to attempt transferring
      await sbt.mint(addr1.address, 75);
      const tokenId = 1n;

      await fc.assert(
        fc.asyncProperty(fc.nat({ max: 49 }), async (_seed) => {
          // Generate a fresh random wallet as the "to" address
          const toWallet = ethers.Wallet.createRandom();
          const toAddress = toWallet.address;

          await expect(
            sbt.connect(addr1).transferFrom(addr1.address, toAddress, tokenId)
          ).to.be.revertedWith("SBT: Transfer not allowed");
        }),
        { numRuns: 20 }
      );
    });
  });

  // Feature: astrarisk-credit-infrastructure, Property 9: second mint always reverts
  describe("Property 9: SBT mint is idempotent per address", function () {
    it("second mint for any already-minted address always reverts", async function () {
      await fc.assert(
        fc.asyncProperty(fc.nat({ max: 49 }), async (_seed) => {
          // Use a fresh wallet per run so each run is independent
          const wallet = ethers.Wallet.createRandom();
          const target = wallet.address;

          // First mint must succeed
          await sbt.mint(target, 50);

          // Second mint must revert
          await expect(sbt.mint(target, 80)).to.be.revertedWith(
            "User already has an identity SBT"
          );

          // Score must remain unchanged
          expect(await sbt.getScore(target)).to.equal(50n);
        }),
        { numRuns: 20 }
      );
    });
  });
});
