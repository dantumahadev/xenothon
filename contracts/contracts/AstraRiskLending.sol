// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./AstraRiskSBT.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AstraRiskLending is Ownable {
    AstraRiskSBT public sbtContract;
    
    struct Loan {
        uint256 amount;
        uint256 collateral;
        uint256 interestRate;
        uint256 timestamp;
        bool isActive;
    }
    
    mapping(address => Loan) public userLoans;

    constructor(address sbtAddress) Ownable(msg.sender) {
        sbtContract = AstraRiskSBT(sbtAddress);
    }

    function calculateLoanTerms(address user) public view returns (uint256 collateralRatio, uint256 interestRate) {
        uint256 score = sbtContract.getScore(user);
        require(score > 0, "User must have a credit identity SBT");

        // Collateral logic: 50% for >80, else 100%
        if (score > 80) {
            collateralRatio = 50; 
        } else {
            collateralRatio = 100;
        }

        // Interest rate logic: >90 -> 5%, >80 -> 8%, else 12%
        if (score > 90) {
            interestRate = 5;
        } else if (score > 80) {
            interestRate = 8;
        } else {
            interestRate = 12;
        }
    }

    function requestLoan(uint256 amount) external payable {
        require(amount > 0, "Loan amount must be greater than 0");
        require(!userLoans[msg.sender].isActive, "A loan is already active");

        (uint256 collateralRatio, uint256 interestRate) = calculateLoanTerms(msg.sender);
        
        uint256 requiredCollateral = (amount * collateralRatio) / 100;
        require(msg.value >= requiredCollateral, "Insufficient collateral deposited");

        userLoans[msg.sender] = Loan({
            amount: amount,
            collateral: msg.value,
            interestRate: interestRate,
            timestamp: block.timestamp,
            isActive: true
        });

        // Simple mock of transfering funds to user
        // (In production, would have a pool of assets)
        payable(msg.sender).transfer(amount / 10); // Mock loan payout (limited by contract balance)
    }

    function repayLoan() external payable {
        Loan storage loan = userLoans[msg.sender];
        require(loan.isActive, "No active loan found");
        
        uint256 totalRepay = loan.amount + (loan.amount * loan.interestRate / 100);
        require(msg.value >= totalRepay, "Insufficient repayment amount");

        loan.isActive = false;
        payable(msg.sender).transfer(loan.collateral); // Release collateral
    }

    // Allow contract to receive funds for lending pool
    receive() external payable {}
}
