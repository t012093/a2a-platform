import json
import os
import urllib.error
import urllib.request

BASE_URL = os.environ.get("A2A_PLATFORM_BASE", "http://localhost:8081")
AGENT_CARD_URL = os.environ.get(
    "A2A_AGENT_CARD_URL", "http://localhost:4000/.well-known/agent-card.json"
)


def post(path: str, payload: dict, token: str) -> dict:
    req = urllib.request.Request(
        BASE_URL + path,
        data=json.dumps(payload).encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
    )
    try:
        return json.loads(urllib.request.urlopen(req).read().decode())
    except urllib.error.HTTPError as err:
        body = err.read().decode() if err.fp else ""
        raise SystemExit(
            f"HTTP {err.code} on {path}\nResponse: {body or '(empty)'}"
        ) from err


def main() -> None:
    token = os.environ.get("TOKEN")
    org_id = os.environ.get("ORG_ID")

    if not token or not org_id:
        raise SystemExit("TOKEN と ORG_ID を環境変数で設定してください")

    card = json.load(urllib.request.urlopen(AGENT_CARD_URL))

    agent = post(
        "/agents",
        {
            "orgId": org_id,
            "name": "Demo Offer Agent",
            "providerOrg": "DemoOrg",
            "agentCardJson": card,
            "skills": {"tags": ["lp", "offer", "demo"]},
            "defaultInputModes": ["text", "data"],
            "defaultOutputModes": ["text", "data"],
        },
        token,
    )

    rfp = post(
        "/rfps",
        {
            "clientOrgId": org_id,
            "title": "LP制作テスト",
            "requirementsJson": {"goal": "LP制作", "budget": 50000},
        },
        token,
    )

    dispatch = post(
        f"/rfps/{rfp['id']}/dispatch",
        {"agentIds": [agent["id"]]},
        token,
    )

    print("agentId:", agent["id"])
    print("rfpId:", rfp["id"])
    print("negotiationId:", dispatch["negotiations"][0]["id"])


if __name__ == "__main__":
    main()
