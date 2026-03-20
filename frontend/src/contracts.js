// Contract addresses — update these after deploying with:
// npx hardhat run scripts/deploy.js --network <network>
export const CONTRACT_ADDRESSES = {
  SBT:     import.meta.env.VITE_SBT_ADDRESS     || '',
  LENDING: import.meta.env.VITE_LENDING_ADDRESS || '',
};

export const SBT_ABI = [
  "function mint(address to, uint256 score) public",
  "function hasMinted(address) public view returns (bool)",
  "function getScore(address user) public view returns (uint256)",
];

export const LENDING_ABI = [
  "function requestLoan(uint256 amount) external payable",
  "function repayLoan() external payable",
  "function calculateLoanTerms(address user) public view returns (uint256 collateralRatio, uint256 interestRate)",
  "function userLoans(address) public view returns (uint256 amount, uint256 collateral, uint256 interestRate, uint256 timestamp, bool isActive)",
];
