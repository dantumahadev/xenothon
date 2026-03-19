import logging
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import networkx as nx
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
import requests
from bs4 import BeautifulSoup
import re
from dotenv import load_dotenv

load_dotenv()
ETHERSCAN_API_KEY = os.getenv("ETHERSCAN_API_KEY", "")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")

logger = logging.getLogger(__name__)

app = FastAPI(title="AstraRisk – Proof-of-Hustle Credit Protocol")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class UserRequest(BaseModel):
    github_username: str
    wallet_address: str
    linkedin_url: str = ""
    linkedin_connections: int = 0
    linkedin_years_experience: int = 0
    linkedin_verified: bool = False

# In-memory score store keyed by wallet_address: {"score": int, "risk": str, "max_loan": int}
# In production this would be backed by a PostgreSQL `scores` table:
#   (wallet_address TEXT PRIMARY KEY, score INT, risk_level TEXT, max_loan INT, created_at TIMESTAMP)
score_store: dict = {}

# Realistic synthetic training data for the RandomForest model.
# Labels are derived from weighted signal rules that mirror real creditworthiness:
#   - High commit_score + high repo_quality + high wallet_flow + low fraud → creditworthy (1)
#   - Low signals or high fraud → not creditworthy (0)
np.random.seed(42)
N = 500
commit_scores  = np.random.randint(0, 100, N)
repo_qualities = np.random.randint(0, 100, N)
wallet_flows   = np.random.randint(0, 100, N)
fraud_scores   = np.random.uniform(0, 1, N)

# Weighted composite: higher = more creditworthy
composite = (
    0.35 * commit_scores +
    0.25 * repo_qualities +
    0.25 * wallet_flows +
    0.15 * (1 - fraud_scores) * 100
)
# Label 1 if composite > 50, with small noise to avoid perfect separation
noise = np.random.normal(0, 5, N)
targets = ((composite + noise) > 50).astype(int)

_train_df = pd.DataFrame({
    'commit_score': commit_scores,
    'repo_quality': repo_qualities,
    'wallet_flow': wallet_flows,
    'fraud_score': fraud_scores,
    'target': targets,
})

X = _train_df[['commit_score', 'repo_quality', 'wallet_flow', 'fraud_score']]
y = _train_df['target']
clf = RandomForestClassifier(n_estimators=100, random_state=42)
clf.fit(X, y)

def get_wallet_data(wallet_address: str) -> dict:
    """Fetch real wallet activity from Etherscan API.
    Returns wallet_flow score (0-100) and analysis dict.
    Raises ValueError if API key is not configured.
    """
    if not ETHERSCAN_API_KEY or ETHERSCAN_API_KEY == "your_api_key_here":
        raise ValueError("Etherscan API key not configured. Set ETHERSCAN_API_KEY in .env")

    result = {
        "wallet_flow": 0,
        "tx_count": 0,
        "unique_senders": 0,
        "incoming_tx": 0,
        "outgoing_tx": 0,
        "eth_received": 0.0,
        "first_tx_days_ago": 0,
        "defi_interactions": 0,
        "source": "etherscan",
        "error": None,
    }

    base = "https://api.etherscan.io/api"

    # Fetch normal transactions (last 100)
    tx_resp = requests.get(base, params={
        "module": "account",
        "action": "txlist",
        "address": wallet_address,
        "startblock": 0,
        "endblock": 99999999,
        "page": 1,
        "offset": 100,
        "sort": "desc",
        "apikey": ETHERSCAN_API_KEY,
    }, timeout=10)
    tx_resp.raise_for_status()
    tx_data = tx_resp.json()

    if tx_data.get("status") != "1":
        # No transactions found is not an error — wallet just has no history
        result["error"] = tx_data.get("message", "No transactions found")
        return result

    txs = tx_data.get("result", [])
    result["tx_count"] = len(txs)

    # Incoming vs outgoing
    incoming = [t for t in txs if t.get("to", "").lower() == wallet_address.lower()]
    outgoing = [t for t in txs if t.get("from", "").lower() == wallet_address.lower()]
    result["incoming_tx"] = len(incoming)
    result["outgoing_tx"] = len(outgoing)

    # Unique senders (diversity of income sources)
    senders = set(t.get("from", "").lower() for t in incoming)
    result["unique_senders"] = len(senders)

    # ETH received (in ETH)
    eth_received = sum(int(t.get("value", 0)) for t in incoming) / 1e18
    result["eth_received"] = round(eth_received, 4)

    # Account age from first tx
    if txs:
        from datetime import datetime, timezone
        oldest_ts = min(int(t.get("timeStamp", 0)) for t in txs)
        if oldest_ts:
            age_days = (datetime.now(timezone.utc).timestamp() - oldest_ts) / 86400
            result["first_tx_days_ago"] = int(age_days)

    # DeFi interactions — txs with non-empty input data (contract calls)
    result["defi_interactions"] = sum(1 for t in txs if t.get("input", "0x") != "0x")

    # Compute wallet_flow score
    score = 0
    score += min(30, result["tx_count"])                    # up to 30 pts for tx volume
    score += min(20, result["unique_senders"] * 2)          # up to 20 pts for diverse income
    score += min(20, int(result["first_tx_days_ago"] / 30)) # up to 20 pts for account age
    score += min(15, result["defi_interactions"])            # up to 15 pts for DeFi activity
    score += min(15, int(eth_received * 10))                 # up to 15 pts for ETH received
    result["wallet_flow"] = min(100, score)

    return result


def scrape_linkedin(profile_url: str) -> dict:
    """Scrape a public LinkedIn profile page for basic signals.
    Returns dict with connections, years_experience, verified, headline, name.
    Falls back to zeros if blocked or unavailable.
    """
    result = {
        "name": "",
        "headline": "",
        "connections": 0,
        "years_experience": 0,
        "verified": False,
        "scraped": False,
        "error": None,
    }
    if not profile_url:
        return result

    # Normalize URL
    if not profile_url.startswith("http"):
        profile_url = "https://" + profile_url

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }

    try:
        resp = requests.get(profile_url, headers=headers, timeout=10)
        if resp.status_code != 200:
            result["error"] = f"HTTP {resp.status_code} — LinkedIn may be blocking the request"
            return result

        soup = BeautifulSoup(resp.text, "html.parser")

        # Name — og:title or h1
        og_title = soup.find("meta", property="og:title")
        if og_title:
            result["name"] = og_title.get("content", "").split("|")[0].strip()
        else:
            h1 = soup.find("h1")
            if h1:
                result["name"] = h1.get_text(strip=True)

        # Headline — og:description
        og_desc = soup.find("meta", property="og:description")
        if og_desc:
            result["headline"] = og_desc.get("content", "")[:120]

        # Connections — look for "500+ connections" or "X followers" pattern
        page_text = soup.get_text()
        conn_match = re.search(r'(\d[\d,]*)\+?\s*connections', page_text, re.IGNORECASE)
        if conn_match:
            result["connections"] = int(conn_match.group(1).replace(",", ""))
        elif "500+" in page_text:
            result["connections"] = 500

        # Experience — count experience section entries by looking for date ranges
        date_ranges = re.findall(r'\b(19|20)\d{2}\b', page_text)
        if date_ranges:
            years = [int(y) for y in date_ranges]
            span = max(years) - min(years)
            result["years_experience"] = min(span, 30)

        # Verified signal — "Open to work" or recommendations mentioned
        if "recommendations" in page_text.lower() or "verified" in page_text.lower():
            result["verified"] = True

        result["scraped"] = True

    except requests.exceptions.Timeout:
        result["error"] = "Request timed out — LinkedIn may be slow or blocking"
    except Exception as e:
        result["error"] = str(e)

    return result


def compute_commit_score(public_repos: int, followers: int) -> int:
    """Compute commit score from public repo count and follower count, capped at 100."""
    return min(100, public_repos * 10 + followers * 5)


def compute_linkedin_score(connections: int, years_experience: int, verified: bool) -> int:
    """Compute LinkedIn credibility score (0-100).
    connections: 500+ is strong signal, years_experience adds weight, verified profile boosts."""
    score = 0
    # Connections: cap at 500 for full points (40 pts max)
    score += min(40, int((connections / 500) * 40))
    # Years experience: cap at 10 years (40 pts max)
    score += min(40, years_experience * 4)
    # Verified profile bonus (20 pts)
    if verified:
        score += 20
    return min(100, score)


def compute_repo_quality(repos_data: list) -> tuple:
    """Compute repo quality score from star and fork counts across all repos, capped at 100.
    Returns (score, reasons) where reasons explains why the score is low."""
    stars = sum(repo.get('stargazers_count', 0) for repo in repos_data)
    forks = sum(repo.get('forks_count', 0) for repo in repos_data)
    score = min(100, stars * 5 + forks * 3)

    reasons = []
    if score < 50:
        if stars == 0:
            reasons.append("No stars on any repository")
        elif stars < 5:
            reasons.append(f"Very few stars across all repos ({stars} total)")
        if forks == 0:
            reasons.append("No forks on any repository")
        elif forks < 3:
            reasons.append(f"Very few forks across all repos ({forks} total)")
        original = sum(1 for r in repos_data if not r.get('fork', False))
        if original == 0:
            reasons.append("All repositories are forks — no original work")
        elif original < 3:
            reasons.append(f"Only {original} original repo(s) found")

    return score, reasons


def _safe_get(url: str) -> dict | list | None:
    """GET a GitHub API URL, return parsed JSON or None on error.
    Uses GITHUB_TOKEN if set, otherwise falls back to unauthenticated (60 req/hr limit).
    """
    headers = {"Accept": "application/vnd.github+json"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    try:
        res = requests.get(url, headers=headers, timeout=10)
        if res.status_code == 200:
            return res.json()
        logger.warning("GitHub API %s returned %d", url, res.status_code)
        return None
    except Exception as e:
        logger.warning("Request failed for %s: %s", url, e)
        return None


def get_github_data(github_username: str):
    """Fetch GitHub user profile and repos with detailed analysis.
    Returns enriched dict or None on error.
    """
    try:
        user_data = _safe_get(f"https://api.github.com/users/{github_username}")
        if not user_data:
            logger.error("GitHub API returned non-200 for user '%s'", github_username)
            return None

        repos_data = _safe_get(
            f"https://api.github.com/users/{github_username}/repos?per_page=100&sort=updated"
        ) or []

        public_repos = user_data.get('public_repos', 0)
        followers    = user_data.get('followers', 0)
        following    = user_data.get('following', 0)
        created_at   = user_data.get('created_at', '')

        # Account age in days
        account_age_days = 0
        if created_at:
            from datetime import datetime, timezone
            created = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            account_age_days = (datetime.now(timezone.utc) - created).days

        # Aggregate repo-level signals
        total_stars   = sum(r.get('stargazers_count', 0) for r in repos_data)
        total_forks   = sum(r.get('forks_count', 0) for r in repos_data)
        total_watchers = sum(r.get('watchers_count', 0) for r in repos_data)
        forked_repos  = sum(1 for r in repos_data if r.get('fork', False))
        original_repos = len(repos_data) - forked_repos

        # Language diversity
        languages = [r.get('language') for r in repos_data if r.get('language')]
        unique_languages = list(set(languages))
        top_language = max(set(languages), key=languages.count) if languages else None

        # Recent activity: repos updated in last 90 days
        from datetime import datetime, timezone, timedelta
        cutoff = datetime.now(timezone.utc) - timedelta(days=90)
        recently_active = sum(
            1 for r in repos_data
            if r.get('pushed_at') and
            datetime.fromisoformat(r['pushed_at'].replace('Z', '+00:00')) > cutoff
        )

        # Commit activity from the most active original repo (avoid rate limits)
        recent_commits = 0
        suspicious_flags = []
        most_starred = sorted(
            [r for r in repos_data if not r.get('fork', False)],
            key=lambda r: r.get('stargazers_count', 0),
            reverse=True
        )
        if most_starred:
            commits_data = _safe_get(
                f"https://api.github.com/repos/{github_username}/{most_starred[0]['name']}"
                f"/commits?per_page=100&author={github_username}"
            )
            if isinstance(commits_data, list):
                recent_commits = len(commits_data)

                # False commit detection
                # 1. Burst commits: >10 commits within same hour
                from collections import Counter
                commit_hours = []
                for c in commits_data:
                    ts = (c.get('commit', {})
                           .get('author', {})
                           .get('date', ''))
                    if ts:
                        try:
                            dt = datetime.fromisoformat(ts.replace('Z', '+00:00'))
                            commit_hours.append(dt.strftime('%Y-%m-%d %H'))
                        except Exception:
                            pass
                hour_counts = Counter(commit_hours)
                burst_hours = [h for h, cnt in hour_counts.items() if cnt > 10]
                if burst_hours:
                    suspicious_flags.append(
                        f"Burst commits detected: {len(burst_hours)} hour(s) with >10 commits"
                    )

                # 2. Empty/trivial commit messages
                trivial_msgs = ['update', 'fix', 'test', 'commit', 'wip', 'misc', 'changes', '.']
                trivial_count = sum(
                    1 for c in commits_data
                    if c.get('commit', {}).get('message', '').strip().lower() in trivial_msgs
                )
                if trivial_count > recent_commits * 0.5 and recent_commits > 5:
                    suspicious_flags.append(
                        f"High trivial commit ratio: {trivial_count}/{recent_commits} commits"
                    )

        # 3. High forked repo ratio (padding with forks)
        if len(repos_data) > 0 and forked_repos / len(repos_data) > 0.7:
            suspicious_flags.append(
                f"High fork ratio: {forked_repos}/{len(repos_data)} repos are forks"
            )

        # 4. New account with many repos (possible fake inflation)
        if account_age_days < 180 and public_repos > 20:
            suspicious_flags.append(
                f"New account ({account_age_days}d old) with {public_repos} repos"
            )

        # 5. Zero stars + zero followers but many repos
        if total_stars == 0 and followers == 0 and public_repos > 5:
            suspicious_flags.append("No stars or followers despite multiple repos")

        false_commit_risk = "HIGH" if len(suspicious_flags) >= 3 else \
                            "MEDIUM" if len(suspicious_flags) >= 1 else "LOW"

        commit_score  = compute_commit_score(public_repos, followers)
        repo_quality, repo_quality_reasons = compute_repo_quality(repos_data)

        return {
            "commit_score": commit_score,
            "repo_quality": repo_quality,
            "repos_data": repos_data,
            "analysis": {
                "public_repos": public_repos,
                "original_repos": original_repos,
                "forked_repos": forked_repos,
                "followers": followers,
                "following": following,
                "total_stars": total_stars,
                "total_forks": total_forks,
                "total_watchers": total_watchers,
                "account_age_days": account_age_days,
                "recently_active_repos": recently_active,
                "recent_commits_top_repo": recent_commits,
                "languages": unique_languages,
                "top_language": top_language,
                "language_diversity": len(unique_languages),
                "false_commit_risk": false_commit_risk,
                "suspicious_flags": suspicious_flags,
                "repo_quality_reasons": repo_quality_reasons,
            },
        }
    except requests.exceptions.RequestException as e:
        logger.error("Network exception fetching GitHub data for '%s': %s", github_username, e)
        return None
    except Exception as e:
        logger.error("Unexpected error fetching GitHub data for '%s': %s", github_username, e)
        return None

def compute_trust_score(features: list) -> int:
    """Compute TrustGraph Score from a feature vector using the global RandomForest classifier.

    Blends RF probability with a direct weighted signal to produce stable 0-100 scores.

    Args:
        features: [commit_score, repo_quality, wallet_flow, fraud_score]

    Returns:
        Integer TrustGraph Score clamped to [0, 100].
    """
    commit_score, repo_quality, wallet_flow, fraud_score = features
    # RF probability component (0-100)
    prob = clf.predict_proba([features])[0][1]
    rf_component = prob * 100
    # Direct weighted signal component (mirrors training labels)
    signal_component = (
        0.35 * commit_score +
        0.25 * repo_quality +
        0.25 * wallet_flow +
        0.15 * (1 - fraud_score) * 100
    )
    # Blend 50/50 for stability
    score = int(0.5 * rf_component + 0.5 * signal_component)
    return max(0, min(100, score))


def get_risk_level(score: int) -> str:
    """Return risk level string for a given TrustGraph Score.

    Thresholds:
        score >= 75  → "LOW"
        40 <= score <= 74 → "MEDIUM"
        score < 40   → "HIGH"
    """
    if score >= 75:
        return "LOW"
    elif score >= 40:
        return "MEDIUM"
    else:
        return "HIGH"


def get_loan_terms(score: int) -> dict:
    """Return loan terms dict for a given TrustGraph Score.

    Tiers:
        score > 90  → collateral_ratio=50, interest_rate=5,  max_loan=score*10
        81–90       → collateral_ratio=50, interest_rate=8,  max_loan=score*10
        score <= 80 → collateral_ratio=100, interest_rate=12, max_loan=score*10

    Returns:
        {"collateral_ratio": int, "interest_rate": int, "max_loan": int}
    """
    if score > 90:
        collateral_ratio = 50
        interest_rate = 5
    elif score >= 81:
        collateral_ratio = 50
        interest_rate = 8
    else:
        collateral_ratio = 100
        interest_rate = 12
    return {
        "collateral_ratio": collateral_ratio,
        "interest_rate": interest_rate,
        "max_loan": score * 10,
    }


def analyze_reputation_graph(github_username: str, repos_data: list) -> float:
    """Compute a fraud score from graph topology derived from the provided repository list.

    Returns:
        0.01 — low risk  (more than 3 repositories)
        0.9  — high risk (zero repositories)
        0.1  — default   (1–3 repositories)

    No external API calls are made; only the supplied repos_data list is used.
    """
    G = nx.Graph()
    G.add_node(github_username, type='user')

    for repo in repos_data:
        repo_name = repo.get('name', '')
        G.add_node(repo_name, type='repo', stars=repo.get('stargazers_count', 0))
        G.add_edge(github_username, repo_name)

    n = len(repos_data)
    if n > 3:
        return 0.01   # low risk: established contributor
    elif n == 0:
        return 0.9    # high risk: no public activity
    else:
        return 0.1    # default: limited activity (1–3 repos)

@app.get("/api/github-rate-limit")
async def github_rate_limit():
    """Check current GitHub API rate limit status."""
    data = _safe_get("https://api.github.com/rate_limit")
    if not data:
        return {"error": "Could not reach GitHub API"}
    core = data.get("resources", {}).get("core", {})
    return {
        "limit": core.get("limit"),
        "remaining": core.get("remaining"),
        "reset_at": core.get("reset"),
        "authenticated": bool(GITHUB_TOKEN),
    }

@app.post("/generate-score")
async def generate_score(req: UserRequest):
    github_info = get_github_data(req.github_username)
    if not github_info:
        raise HTTPException(status_code=404, detail="GitHub user not found")
    
    fraud_score = analyze_reputation_graph(req.github_username, github_info['repos_data'])
    
    # LinkedIn — scrape if URL provided, else use manual fields
    if req.linkedin_url:
        li = scrape_linkedin(req.linkedin_url)
        linkedin_connections = li["connections"]
        linkedin_years = li["years_experience"]
        linkedin_verified = li["verified"]
        linkedin_meta = li
    else:
        linkedin_connections = req.linkedin_connections
        linkedin_years = req.linkedin_years_experience
        linkedin_verified = req.linkedin_verified
        linkedin_meta = {"scraped": False, "name": "", "headline": "", "error": None}

    linkedin_score = compute_linkedin_score(linkedin_connections, linkedin_years, linkedin_verified)

    # Real wallet analysis via Etherscan
    try:
        wallet_info = get_wallet_data(req.wallet_address)
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Etherscan error: {str(e)}")
    wallet_flow = wallet_info["wallet_flow"]
    
    features = [
        github_info['commit_score'],
        github_info['repo_quality'],
        wallet_flow,
        fraud_score,
    ]
    trust_score = compute_trust_score(features)
    # Boost trust score slightly based on LinkedIn (up to +10 pts)
    linkedin_boost = int(linkedin_score * 0.1)
    trust_score = min(100, trust_score + linkedin_boost)
    risk_level = get_risk_level(trust_score)
    loan_terms = get_loan_terms(trust_score)

    # Persist to in-memory store (production: INSERT/UPDATE into PostgreSQL scores table)
    score_store[req.wallet_address] = {
        "score": trust_score,
        "risk": risk_level,
        "max_loan": loan_terms["max_loan"],
    }

    return {
        "status": "success",
        "wallet": req.wallet_address,
        "github": req.github_username,
        "trust_score": trust_score,
        "risk_level": risk_level,
        "breakdown": {
            "github_commit_score": github_info['commit_score'],
            "github_repo_quality": github_info['repo_quality'],
            "wallet_consistency": wallet_flow,
            "fraud_risk": fraud_score,
            "linkedin_score": linkedin_score,
        },
        "github_analysis": github_info.get('analysis', {}),
        "wallet_analysis": {
            "tx_count": wallet_info["tx_count"],
            "incoming_tx": wallet_info["incoming_tx"],
            "outgoing_tx": wallet_info["outgoing_tx"],
            "unique_senders": wallet_info["unique_senders"],
            "eth_received": wallet_info["eth_received"],
            "first_tx_days_ago": wallet_info["first_tx_days_ago"],
            "defi_interactions": wallet_info["defi_interactions"],
            "wallet_flow_score": wallet_flow,
            "source": wallet_info["source"],
            "error": wallet_info.get("error"),
        },
        "linkedin_analysis": {
            "score": linkedin_score,
            "connections": linkedin_connections,
            "years_experience": linkedin_years,
            "verified": linkedin_verified,
            "name": linkedin_meta.get("name", ""),
            "headline": linkedin_meta.get("headline", ""),
            "scraped": linkedin_meta.get("scraped", False),
            "error": linkedin_meta.get("error"),
        },
        "loan_eligibility": {
            "max_loan": loan_terms["max_loan"],
            "collateral": f"{loan_terms['collateral_ratio']}%",
            "interest_rate": f"{loan_terms['interest_rate']}%",
        },
    }

@app.get("/trust-score")
async def get_trust_score(wallet: str):
    # Look up from in-memory store (production: SELECT from PostgreSQL scores table)
    # Return default response if wallet not found, per Requirement 5.3
    entry = score_store.get(wallet)
    if entry:
        return {"score": entry["score"], "risk": entry["risk"], "max_loan": entry["max_loan"]}
    return {"score": 0, "risk": "HIGH", "max_loan": 0}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
