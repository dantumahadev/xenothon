# AstraRisk – Proof-of-Hustle Credit Protocol

AstraRisk is a decentralized credit scoring system that uses AI to analyze developer contributions (GitHub) and wallet activity to generate trust scores. These scores are then minted into Soulbound Tokens (SBTs) to allow under-collateralized lending.

## Features
- **AI-Powered Trust Engine**: Uses Random Forest to compute creditworthiness from real GitHub data.
- **Soulbound Identity**: Mints non-transferable credit identities on-chain.
- **Under-Collateralized Lending**: Dynamic collateral (as low as 50%) and interest rates (as low as 5%) based on trust score.
- **Premium UI/UX**: Full glassmorphism design with sleek animations and wallet integration.

---

## Tech Stack
- **Frontend**: React.js, Tailwind CSS, Framer Motion, Ethers.js
- **Backend**: FastAPI, Scikit-learn, NetworkX, GitHub API
- **Web3**: Solidity, Hardhat, Polygon/Base Sepolia

---

## Getting Started

### 1. Backend Setup
1. Navigate to `backend/`.
2. Install dependencies: `pip install -r requirements.txt`
3. Start the server: `python main.py`
4. The API will be available at `http://localhost:8000`.

### 2. Frontend Setup
1. Navigate to `frontend/`.
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`
4. Access the app at `http://localhost:3000`.
5. Connect your MetaMask wallet (Mumbai or Sepolia testnets recommended).

### 3. Smart Contracts (Optional Deployment)
1. Navigate to `contracts/`.
2. Check `contracts/AstraRiskSBT.sol` and `contracts/AstraRiskLending.sol`.
3. To deploy, configure your private key in `hardhat.config.js` and run deployment scripts.

---

## Demo Flow
1. **Connect Wallet**: Securely link your MetaMask to the protocol.
2. **GitHub Profiling**: Enter your GitHub username. The engine fetches real repo data, commit history, and star counts.
3. **AI Analysis**: The system analyzes patterns and detects potential fraud using graph analysis (NetworkX) and a Random Forest model.
4. **Result Generation**: View your Trust Score (0-100) and risk level.
5. **Mint Identity**: Mint your AstraRisk SBT on-chain to solidify your credit identity.
6. **Access Funds**: Borrow capital with reduced collateral based on your high Trust Score.

---

**Built with <3 for the Proof-of-Hustle Credit Protocol**
