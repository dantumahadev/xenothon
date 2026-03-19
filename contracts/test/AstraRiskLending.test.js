const { expect } = require("chai");
const { ethers } = require("hardhat");
const fc = require("fast-check");

describe("AstraRiskLending", function () {
  let sbt;
  let lending;
  let owner;
  let borrower;
  let addr2;

  beforeEach(async function () {
    [owner, borrower, addr2] = await ethers.getSigners();

    // Deploy SBT
    const SBT = await ethers.getContractFactory("AstraRiskSBT");
    sbt = await SBT.deploy();
    await sbt.waitForDeployment();

    // Deploy Lending with SBT address
    const Lending = await ethers.getContractFactory("AstraRiskLending");
    lending = await Lending.deploy(await sbt.getAddress());
    await lending.waitForDeployment();

    // Fund the lending contract so it can pay out mock loans
    await owner.sendTransaction({
      to: await lending.getAddress(),
      value: ethers.parseEther("10"),
    });
  });

  // ─── Unit Tests ───────────────────────────────────────────────────────────

  describe("requestLoan", function () {
    it("reverts when borrower has no SBT", async function () {
      const loanAmount = ethers.parseEther("1");
      // borrower has no SBT — getScore returns 0, calculateLoanTerms reverts
      await expect(
        lending.connect(borrower).requestLoan(loanAmount, { value: loanAmount })
      ).to.be.revertedWith("User must have a credit identity SBT");
    });

    it("reverts when collateral is insufficient", async function () {
      // Mint SBT with score 50 → collateralRatio = 100%
      await sbt.mint(borrower.address, 50);

      const loanAmount = ethers.parseEther("1");
      // Required collateral = 100% of 1 ETH = 1 ETH; send only 0.5 ETH
      const insufficientCollateral = ethers.parseEther("0.5");

      await expect(
        lending
          .connect(borrower)
          .requestLoan(loanAmount, { value: insufficientCollateral })
      ).to.be.revertedWith("Insufficient collateral deposited");
    });

    it("creates a loan successfully with sufficient collateral", async function () {
      // Mint SBT with score 85 → collateralRatio = 50%, interestRate = 8%
      await sbt.mint(borrower.address, 85);

      const loanAmount = ethers.parseEther("1");
      // Required collateral = 50% of 1 ETH = 0.5 ETH
      const collateral = ethers.parseEther("0.5");

      await lending
        .connect(borrower)
        .requestLoan(loanAmount, { value: collateral });

      const loan = await lending.userLoans(borrower.address);
      expect(loan.amount).to.equal(loanAmount);
      expect(loan.collateral).to.equal(collateral);
      expect(loan.interestRate).to.equal(8n);
      expect(loan.isActive).to.equal(true);
    });

    it("reverts when borrower already has an active loan", async function () {
      // Mint SBT with score 85 → collateralRatio = 50%
      await sbt.mint(borrower.address, 85);

      const loanAmount = ethers.parseEther("1");
      const collateral = ethers.parseEther("0.5");

      // First loan succeeds
      await lending
        .connect(borrower)
        .requestLoan(loanAmount, { value: collateral });

      // Second loan must revert
      await expect(
        lending
          .connect(borrower)
          .requestLoan(loanAmount, { value: collateral })
      ).to.be.revertedWith("A loan is already active");
    });
  });

  describe("repayLoan", function () {
    it("releases collateral and marks loan inactive on full repayment", async function () {
      // Mint SBT with score 85 → collateralRatio = 50%, interestRate = 8%
      await sbt.mint(borrower.address, 85);

      const loanAmount = ethers.parseEther("1");
      const collateral = ethers.parseEther("0.5");

      await lending
        .connect(borrower)
        .requestLoan(loanAmount, { value: collateral });

      // totalRepay = 1 ETH + (1 ETH * 8 / 100) = 1.08 ETH
      const totalRepay = loanAmount + (loanAmount * 8n) / 100n;

      const balanceBefore = await ethers.provider.getBalance(borrower.address);

      const tx = await lending
        .connect(borrower)
        .repayLoan({ value: totalRepay });
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(borrower.address);

      // Loan should be inactive
      const loan = await lending.userLoans(borrower.address);
      expect(loan.isActive).to.equal(false);

      // Borrower should have received collateral back (net: paid totalRepay, got collateral back)
      // balanceAfter ≈ balanceBefore - totalRepay - gas + collateral
      const expectedBalance = balanceBefore - totalRepay - gasUsed + collateral;
      expect(balanceAfter).to.be.closeTo(expectedBalance, ethers.parseEther("0.001"));
    });

    it("reverts when repayment amount is insufficient", async function () {
      // Mint SBT with score 85 → interestRate = 8%
      await sbt.mint(borrower.address, 85);

      const loanAmount = ethers.parseEther("1");
      const collateral = ethers.parseEther("0.5");

      await lending
        .connect(borrower)
        .requestLoan(loanAmount, { value: collateral });

      // totalRepay = 1.08 ETH; send only 1 ETH (missing interest)
      await expect(
        lending.connect(borrower).repayLoan({ value: loanAmount })
      ).to.be.revertedWith("Insufficient repayment amount");
    });
  });

  // ─── Property Tests ───────────────────────────────────────────────────────

  // Feature: astrarisk-credit-infrastructure, Property 10: calculateLoanTerms correct for all scores
  describe("Property 10: Lending collateral requirement matches SBT score", function () {
    it("calculateLoanTerms returns correct tiers for any score in [1, 100]", async function () {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: 100 }), async (score) => {
          // Use a fresh wallet per run so each run is independent
          const wallet = ethers.Wallet.createRandom();
          const target = wallet.address;

          // Mint SBT with the given score
          await sbt.mint(target, score);

          const [collateralRatio, interestRate] =
            await lending.calculateLoanTerms(target);

          // Collateral ratio: 50 when score > 80, else 100
          const expectedCollateral = score > 80 ? 50n : 100n;
          expect(collateralRatio).to.equal(expectedCollateral);

          // Interest rate: 5 when score > 90, 8 when 81–90, 12 when <= 80
          let expectedInterest;
          if (score > 90) {
            expectedInterest = 5n;
          } else if (score > 80) {
            expectedInterest = 8n;
          } else {
            expectedInterest = 12n;
          }
          expect(interestRate).to.equal(expectedInterest);
        }),
        { numRuns: 100 }
      );
    });
  });

  // Feature: astrarisk-credit-infrastructure, Property: insufficient collateral always reverts
  describe("Property 7.3: Insufficient collateral always reverts", function () {
    it("requestLoan always reverts when msg.value < required collateral", async function () {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }), // score
          fc.bigInt({ min: 2n, max: ethers.parseEther("0.01") }), // loanAmount in wei (small to stay within balance)
          async (score, loanAmount) => {
            const wallet = ethers.Wallet.createRandom();
            const target = wallet.address;

            // Mint SBT with the given score
            await sbt.mint(target, score);

            const collateralRatio = score > 80 ? 50n : 100n;
            const requiredCollateral = (loanAmount * collateralRatio) / 100n;

            // Send strictly less than required (at least 1 wei less)
            const insufficient =
              requiredCollateral > 0n ? requiredCollateral - 1n : 0n;

            // Fund the target wallet via owner so it can send a tx
            // We use owner to call requestLoan on behalf of target via impersonation isn't
            // straightforward — instead we test via a known signer (borrower) with a fresh SBT
            // We re-mint for borrower each iteration using updateScore trick:
            // Since borrower may already have a loan, use addr2 as a proxy signer.
            // For simplicity, use the owner signer with a fresh address each time.
            // We verify the revert by calling calculateLoanTerms + checking the math,
            // and by using a funded signer (addr2) with a freshly minted SBT.

            // Re-mint for addr2 if not already minted
            if (!(await sbt.hasMinted(addr2.address))) {
              await sbt.mint(addr2.address, score);
            } else {
              await sbt.updateScore(addr2.address, score);
            }

            const addr2CollateralRatio = score > 80 ? 50n : 100n;
            const addr2Required = (loanAmount * addr2CollateralRatio) / 100n;
            const addr2Insufficient =
              addr2Required > 0n ? addr2Required - 1n : 0n;

            await expect(
              lending
                .connect(addr2)
                .requestLoan(loanAmount, { value: addr2Insufficient })
            ).to.be.revertedWith("Insufficient collateral deposited");
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
