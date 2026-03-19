"""
Tests for AstraRisk backend — Data Aggregation Layer (Task 1), Reputation Graph Engine (Task 2),
and AI Trust Score Engine (Task 3).
"""
import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from main import (
    compute_commit_score,
    compute_repo_quality,
    analyze_reputation_graph,
    compute_trust_score,
    get_risk_level,
    get_loan_terms,
)


# ---------------------------------------------------------------------------
# Property 1: commit_score is bounded
# Feature: astrarisk-credit-infrastructure, Property 1: commit_score always in [0, 100]
# Validates: Requirements 1.3
# ---------------------------------------------------------------------------

@settings(max_examples=100)
@given(
    public_repos=st.integers(min_value=0, max_value=10_000),
    followers=st.integers(min_value=0, max_value=10_000),
)
def test_commit_score_bounded(public_repos: int, followers: int):
    """Property 1: For any non-negative public_repos and followers, commit_score is in [0, 100]."""
    # Feature: astrarisk-credit-infrastructure, Property 1: commit_score always in [0, 100]
    score = compute_commit_score(public_repos, followers)
    assert 0 <= score <= 100, f"commit_score {score} out of bounds for repos={public_repos}, followers={followers}"


# ---------------------------------------------------------------------------
# Property 2: repo_quality is bounded
# Feature: astrarisk-credit-infrastructure, Property 2: repo_quality always in [0, 100]
# Validates: Requirements 1.4
# ---------------------------------------------------------------------------

repo_strategy = st.lists(
    st.fixed_dictionaries({
        "stargazers_count": st.integers(min_value=0, max_value=100_000),
        "forks_count": st.integers(min_value=0, max_value=100_000),
    }),
    min_size=0,
    max_size=500,
)


@settings(max_examples=100)
@given(repos_data=repo_strategy)
def test_repo_quality_bounded(repos_data: list):
    """Property 2: For any list of repos with non-negative star/fork counts, repo_quality is in [0, 100]."""
    # Feature: astrarisk-credit-infrastructure, Property 2: repo_quality always in [0, 100]
    score, _ = compute_repo_quality(repos_data)
    assert 0 <= score <= 100, f"repo_quality {score} out of bounds for repos_data={repos_data}"


# ---------------------------------------------------------------------------
# Property 3: Fraud score covers all cases
# Feature: astrarisk-credit-infrastructure, Property 3: fraud_score correct for all repo list lengths
# Validates: Requirements 2.2, 2.3, 2.4
# ---------------------------------------------------------------------------

# Strategy: generate a list of minimal repo dicts with the fields analyze_reputation_graph uses
_repo_entry_strategy = st.fixed_dictionaries({
    "name": st.text(min_size=1, max_size=50),
    "stargazers_count": st.integers(min_value=0, max_value=100_000),
    "forks_count": st.integers(min_value=0, max_value=100_000),
})


@settings(max_examples=100)
@given(repos_data=st.lists(_repo_entry_strategy, min_size=0, max_size=200))
def test_fraud_score_covers_all_cases(repos_data: list):
    """Property 3: For any repo list of length N, analyze_reputation_graph returns the correct fraud score."""
    # Feature: astrarisk-credit-infrastructure, Property 3: fraud_score correct for all repo list lengths
    # Validates: Requirements 2.2, 2.3, 2.4
    n = len(repos_data)
    result = analyze_reputation_graph("test_user", repos_data)

    if n > 3:
        assert result == 0.01, f"Expected 0.01 for N={n}, got {result}"
    elif n == 0:
        assert result == 0.9, f"Expected 0.9 for N=0, got {result}"
    else:
        assert result == 0.1, f"Expected 0.1 for N={n}, got {result}"


# ---------------------------------------------------------------------------
# Property 4: TrustGraph Score is bounded
# Feature: astrarisk-credit-infrastructure, Property 4: trust_score always in [0, 100]
# Validates: Requirements 3.3
# ---------------------------------------------------------------------------

_feature_strategy = st.fixed_dictionaries({
    "commit_score": st.integers(min_value=0, max_value=100),
    "repo_quality": st.integers(min_value=0, max_value=100),
    "wallet_flow": st.integers(min_value=0, max_value=100),
    "fraud_score": st.floats(min_value=0.0, max_value=1.0, allow_nan=False),
})


@settings(max_examples=100)
@given(features=_feature_strategy)
def test_trust_score_bounded(features: dict):
    """Property 4: For any valid feature vector, compute_trust_score returns an integer in [0, 100]."""
    # Feature: astrarisk-credit-infrastructure, Property 4: trust_score always in [0, 100]
    # Validates: Requirements 3.3
    score = compute_trust_score([
        features["commit_score"],
        features["repo_quality"],
        features["wallet_flow"],
        features["fraud_score"],
    ])
    assert isinstance(score, int), f"Expected int, got {type(score)}"
    assert 0 <= score <= 100, f"trust_score {score} out of bounds"


# ---------------------------------------------------------------------------
# Property 5: Risk level assignment is total and consistent
# Feature: astrarisk-credit-infrastructure, Property 5: risk_level consistent with thresholds
# Validates: Requirements 3.4
# ---------------------------------------------------------------------------

@settings(max_examples=100)
@given(score=st.integers(min_value=0, max_value=100))
def test_risk_level_consistent(score: int):
    """Property 5: For any score in [0, 100], get_risk_level returns exactly one valid level matching thresholds."""
    # Feature: astrarisk-credit-infrastructure, Property 5: risk_level consistent with thresholds
    # Validates: Requirements 3.4
    level = get_risk_level(score)
    assert level in {"LOW", "MEDIUM", "HIGH"}, f"Unexpected risk level '{level}' for score={score}"
    if score >= 75:
        assert level == "LOW", f"Expected LOW for score={score}, got {level}"
    elif score >= 40:
        assert level == "MEDIUM", f"Expected MEDIUM for score={score}, got {level}"
    else:
        assert level == "HIGH", f"Expected HIGH for score={score}, got {level}"


# ---------------------------------------------------------------------------
# Property 6: Loan terms are monotonically favorable with higher scores
# Feature: astrarisk-credit-infrastructure, Property 6: loan terms monotonically improve with score
# Validates: Requirements 3.5, 3.6, 3.7, 3.8
# ---------------------------------------------------------------------------

@settings(max_examples=100)
@given(
    score_a=st.integers(min_value=0, max_value=100),
    score_b=st.integers(min_value=0, max_value=100),
)
def test_loan_terms_monotonic(score_a: int, score_b: int):
    """Property 6: For any A > B, get_loan_terms(A) has collateral_ratio <= and interest_rate <= that of B."""
    # Feature: astrarisk-credit-infrastructure, Property 6: loan terms monotonically improve with score
    # Validates: Requirements 3.5, 3.6, 3.7, 3.8
    if score_a <= score_b:
        return  # only test when A > B
    terms_a = get_loan_terms(score_a)
    terms_b = get_loan_terms(score_b)
    assert terms_a["collateral_ratio"] <= terms_b["collateral_ratio"], (
        f"collateral_ratio not monotonic: score {score_a} → {terms_a['collateral_ratio']}, "
        f"score {score_b} → {terms_b['collateral_ratio']}"
    )
    assert terms_a["interest_rate"] <= terms_b["interest_rate"], (
        f"interest_rate not monotonic: score {score_a} → {terms_a['interest_rate']}, "
        f"score {score_b} → {terms_b['interest_rate']}"
    )


# ---------------------------------------------------------------------------
# Property 7: Max loan is proportional to score
# Feature: astrarisk-credit-infrastructure, Property 7: max_loan == score * 10
# Validates: Requirements 3.9
# ---------------------------------------------------------------------------

@settings(max_examples=100)
@given(score=st.integers(min_value=0, max_value=100))
def test_max_loan_proportional(score: int):
    """Property 7: For any score S in [0, 100], get_loan_terms(S)['max_loan'] == S * 10."""
    # Feature: astrarisk-credit-infrastructure, Property 7: max_loan == score * 10
    # Validates: Requirements 3.9
    terms = get_loan_terms(score)
    assert terms["max_loan"] == score * 10, (
        f"max_loan {terms['max_loan']} != {score * 10} for score={score}"
    )


# ---------------------------------------------------------------------------
# Property 11: Score generation response contains all required fields
# Feature: astrarisk-credit-infrastructure, Property 11: /generate-score response always has all required fields
# Validates: Requirements 4.2
# ---------------------------------------------------------------------------

from unittest.mock import patch
import httpx
from hypothesis import given, settings
from hypothesis import strategies as st

from main import app

_REQUIRED_TOP_LEVEL = {"status", "wallet", "github", "trust_score", "risk_level", "breakdown", "loan_eligibility"}
_REQUIRED_BREAKDOWN = {"github_commit_score", "github_repo_quality", "wallet_consistency", "fraud_risk"}
_REQUIRED_LOAN = {"max_loan", "collateral", "interest_rate"}

_username_strategy = st.text(
    alphabet=st.characters(whitelist_categories=("Ll", "Lu", "Nd"), whitelist_characters="-"),
    min_size=1,
    max_size=30,
)
_wallet_strategy = st.text(
    alphabet="0123456789abcdefABCDEF",
    min_size=10,
    max_size=42,
).map(lambda s: "0x" + s)


@settings(max_examples=20)
@given(
    github_username=_username_strategy,
    wallet_address=_wallet_strategy,
)
def test_generate_score_response_has_all_required_fields(github_username: str, wallet_address: str):
    """Property 11: For any valid username/wallet pair, /generate-score response contains all required fields."""
    # Feature: astrarisk-credit-infrastructure, Property 11: /generate-score response always has all required fields
    # Validates: Requirements 4.2

    import anyio

    mock_github_data = {
        "commit_score": 50,
        "repo_quality": 40,
        "repos_data": [
            {"name": "repo1", "stargazers_count": 5, "forks_count": 2},
            {"name": "repo2", "stargazers_count": 3, "forks_count": 1},
            {"name": "repo3", "stargazers_count": 1, "forks_count": 0},
            {"name": "repo4", "stargazers_count": 0, "forks_count": 0},
        ],
    }

    async def _call():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            return await client.post(
                "/generate-score",
                json={"github_username": github_username, "wallet_address": wallet_address},
            )

    with patch("main.get_github_data", return_value=mock_github_data):
        response = anyio.run(_call)

    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    body = response.json()

    assert _REQUIRED_TOP_LEVEL <= body.keys(), (
        f"Missing top-level fields: {_REQUIRED_TOP_LEVEL - body.keys()}"
    )
    assert _REQUIRED_BREAKDOWN <= body["breakdown"].keys(), (
        f"Missing breakdown fields: {_REQUIRED_BREAKDOWN - body['breakdown'].keys()}"
    )
    assert _REQUIRED_LOAN <= body["loan_eligibility"].keys(), (
        f"Missing loan_eligibility fields: {_REQUIRED_LOAN - body['loan_eligibility'].keys()}"
    )
