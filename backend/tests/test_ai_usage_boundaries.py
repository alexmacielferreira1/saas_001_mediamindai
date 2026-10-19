# ruff: noqa: F811

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
from app.api.v1.ai_usage import cost_for, guard_budget, read_policy, record_usage
from app.core.errors import PublicError
from app.models.identity import TenantRecord
from test_permission_groups_api import login, permission_client  # noqa: F401

PRICE = {
    "provider": "Compatible",
    "model": "Model-A",
    "input_per_million_usd": 2.0,
    "output_per_million_usd": 4.0,
    "per_image_usd": 0.5,
}


def save_policy(session, tenant_id, **values):
    session.add(TenantRecord(tenant_id=tenant_id, entity_type="AIUsagePolicy", data=values))
    session.commit()


def test_cost_is_based_on_token_and_image_prices_case_insensitively():
    cost, basis = cost_for(
        {"prices": [PRICE]}, "compatible", "model-a", 1_000_000, 500_000, images=3
    )
    assert cost == 5.5
    assert basis == "configured_estimate"


def test_unknown_model_is_unpriced_instead_of_zero_cost():
    assert cost_for({"prices": [PRICE]}, "compatible", "other-model", 100, 50) == (
        None,
        "unpriced",
    )


def test_policy_is_isolated_between_companies(permission_client):
    _, ids = permission_client
    with ids["session_factory"]() as session:
        save_policy(session, ids["tenant"], enabled=False)
        assert read_policy(session, ids["tenant"])["enabled"] is False
        assert read_policy(session, ids["other"])["enabled"] is True


@pytest.mark.parametrize(
    ("policy", "expected_code", "expected_status"),
    [
        ({"enabled": False}, "AI_DISABLED", 403),
        ({"per_request_limit_usd": 1.0}, "AI_PRICE_REQUIRED", 409),
        ({"per_request_limit_usd": 0.5, "prices": [PRICE]}, "AI_REQUEST_BUDGET", 429),
    ],
)
def test_budget_rejects_disabled_unpriced_or_over_limit_calls(
    permission_client, policy, expected_code, expected_status
):
    _, ids = permission_client
    with ids["session_factory"]() as session:
        save_policy(session, ids["tenant"], **policy)
        with pytest.raises(PublicError) as error:
            guard_budget(session, ids["tenant"], "compatible", "model-a", max_tokens=1_000_000)
        assert error.value.code == expected_code
        assert error.value.status == expected_status


def test_budget_allows_estimate_equal_to_request_limit(permission_client):
    _, ids = permission_client
    with ids["session_factory"]() as session:
        save_policy(session, ids["tenant"], per_request_limit_usd=4.0, prices=[PRICE])
        policy = guard_budget(session, ids["tenant"], "compatible", "model-a", max_tokens=1_000_000)
        assert policy["per_request_limit_usd"] == 4.0


def test_unknown_successful_usage_blocks_an_enforced_daily_budget(permission_client):
    _, ids = permission_client
    with ids["session_factory"]() as session:
        save_policy(session, ids["tenant"], daily_limit_usd=10.0)
        record_usage(
            session,
            ids["tenant"],
            None,
            provider="compatible",
            model="model-a",
            feature="test",
            usage_known=False,
        )
        with pytest.raises(PublicError) as error:
            guard_budget(session, ids["tenant"], "compatible", "model-a")
        assert error.value.code == "AI_COST_INCOMPLETE"


@pytest.mark.parametrize(
    ("limits", "event_time", "expected_code"),
    [
        ({"daily_limit_usd": 2}, datetime.now(UTC), "AI_DAILY_LIMIT"),
        ({"monthly_limit_usd": 2}, datetime.now(UTC), "AI_MONTHLY_LIMIT"),
    ],
)
def test_spending_limit_blocks_when_accumulated_cost_reaches_limit(
    permission_client, monkeypatch, limits, event_time, expected_code
):
    _, ids = permission_client
    with ids["session_factory"]() as session:
        save_policy(session, ids["tenant"], **limits)
        events = [SimpleNamespace(created_at=event_time, data={"status": "ok", "cost_usd": 2})]
        monkeypatch.setattr("app.api.v1.ai_usage._events", lambda *_args: events)
        with pytest.raises(PublicError) as error:
            guard_budget(session, ids["tenant"], "compatible", "model-a")
        assert error.value.code == expected_code
        assert error.value.status == 429


def test_spending_before_current_day_does_not_exhaust_daily_limit(permission_client, monkeypatch):
    _, ids = permission_client
    with ids["session_factory"]() as session:
        save_policy(session, ids["tenant"], daily_limit_usd=2)
        yesterday = datetime.now(UTC) - timedelta(days=1)
        events = [SimpleNamespace(created_at=yesterday, data={"status": "ok", "cost_usd": 10})]
        monkeypatch.setattr("app.api.v1.ai_usage._events", lambda *_args: events)
        assert guard_budget(session, ids["tenant"], "compatible", "model-a")["enabled"] is True


def test_usage_report_and_csv_are_scoped_to_the_current_company(permission_client):
    client, ids = permission_client
    with ids["session_factory"]() as session:
        record_usage(
            session,
            ids["tenant"],
            None,
            provider="own-provider",
            model="m",
            feature="own-feature",
            input_tokens=10,
            usage_known=False,
        )
        record_usage(
            session,
            ids["other"],
            None,
            provider="other-provider",
            model="m",
            feature="other-feature",
            input_tokens=900,
            usage_known=False,
        )
    login(client)
    report = client.get("/api/v1/ai/usage/report")
    export = client.get("/api/v1/ai/usage/export.csv")
    assert report.status_code == 200
    assert report.json()["totals"]["calls"] == 1
    assert report.json()["totals"]["input_tokens"] == 10
    assert "own-feature" in report.text and "other-feature" not in report.text
    assert export.status_code == 200
    assert "own-provider" in export.text and "other-provider" not in export.text


def test_viewer_cannot_read_or_update_ai_usage_policy(permission_client):
    client, _ = permission_client
    login(client, "viewer@mediamind.ai")
    assert client.get("/api/v1/ai/usage/policy").status_code == 403
    assert client.put("/api/v1/ai/usage/policy", json={"enabled": False}).status_code == 403


def test_administrator_can_save_and_replace_policy_without_affecting_other_company(
    permission_client,
):
    client, ids = permission_client
    login(client)
    saved = client.put(
        "/api/v1/ai/usage/policy",
        json={"daily_limit_usd": 5, "prices": [PRICE]},
    )
    assert saved.status_code == 200
    assert saved.json()["daily_limit_usd"] == 5
    assert saved.json()["prices"][0]["model"] == "Model-A"
    updated = client.put("/api/v1/ai/usage/policy", json={"enabled": False})
    assert updated.status_code == 200
    assert updated.json()["enabled"] is False
    with ids["session_factory"]() as session:
        assert read_policy(session, ids["other"])["enabled"] is True


def test_policy_rejects_negative_limits_and_report_rejects_invalid_period(permission_client):
    client, _ = permission_client
    login(client)
    assert client.put("/api/v1/ai/usage/policy", json={"daily_limit_usd": -1}).status_code == 422
    assert client.get("/api/v1/ai/usage/report?days=32").status_code == 422
    assert client.get("/api/v1/ai/usage/export.csv?days=0").status_code == 422


def test_report_separates_priced_success_from_error_without_provider_usage(permission_client):
    client, ids = permission_client
    with ids["session_factory"]() as session:
        save_policy(session, ids["tenant"], prices=[PRICE])
        record_usage(
            session,
            ids["tenant"],
            None,
            provider="compatible",
            model="model-a",
            feature="generation",
            input_tokens=1_000_000,
            output_tokens=500_000,
        )
        record_usage(
            session,
            ids["tenant"],
            None,
            provider="compatible",
            model="model-a",
            feature="generation",
            status="error",
            error_code="PROVIDER_UNAVAILABLE",
            usage_known=False,
        )
    login(client)
    response = client.get("/api/v1/ai/usage/report")
    assert response.status_code == 200
    totals = response.json()["totals"]
    assert totals["calls"] == 2
    assert totals["ok"] == 1
    assert totals["errors"] == 1
    assert totals["priced_usd"] == 4
    assert totals["unpriced_calls"] == 1
    assert "não são faturas" in response.json()["basis"]
