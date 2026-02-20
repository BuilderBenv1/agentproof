"""
Fix descriptions that incorrectly reference Avalanche for non-Avalanche agents.
Uses Supabase REST API to patch affected rows.
"""

import requests

SUPABASE_URL = "https://oztrefgbigvtzncodcys.supabase.co"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96dHJlZmdiaWd2dHpuY29kY3lzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQyMzEzMSwiZXhwIjoyMDg1OTk5MTMxfQ.6d31ozweP62Yy1M-tld-At8Hgj6Nauz-rfRRCEqyGKM"

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

REST_URL = f"{SUPABASE_URL}/rest/v1/agents"

# Replacement map: old text -> new text
REPLACEMENTS = [
    ("on Avalanche network", "with on-chain reputation"),
    ("operating on Avalanche", "with verified identity"),
    ("on Avalanche", "across chains"),
    ("for Avalanche", "for cross-chain"),
]


def fix_descriptions():
    # Fetch all non-Avalanche agents whose description mentions Avalanche
    url = (
        f"{REST_URL}?source_chain=neq.avalanche"
        f"&description=ilike.*Avalanche*"
        f"&select=agent_id,description,source_chain"
    )
    resp = requests.get(url, headers=HEADERS)
    if resp.status_code != 200:
        print(f"Error fetching agents: {resp.status_code} - {resp.text}")
        return

    agents = resp.json()
    print(f"Found {len(agents)} non-Avalanche agents with 'Avalanche' in description")

    fixed = 0
    for agent in agents:
        desc = agent["description"]
        new_desc = desc
        for old, new in REPLACEMENTS:
            new_desc = new_desc.replace(old, new)

        if new_desc != desc:
            patch_url = f"{REST_URL}?agent_id=eq.{agent['agent_id']}"
            patch_headers = dict(HEADERS)
            patch_headers["Prefer"] = "return=minimal"
            r = requests.patch(patch_url, headers=patch_headers, json={"description": new_desc})
            if r.status_code in (200, 204):
                fixed += 1
                print(f"  Fixed agent_id={agent['agent_id']} ({agent['source_chain']}): {desc[:60]}... -> {new_desc[:60]}...")
            else:
                print(f"  FAILED agent_id={agent['agent_id']}: {r.status_code}")

    print(f"\nDone: fixed {fixed}/{len(agents)} agents")


if __name__ == "__main__":
    fix_descriptions()
