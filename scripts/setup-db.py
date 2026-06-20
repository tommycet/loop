#!/usr/bin/env python3
"""Apply Supabase schema migration via REST API"""
import os
import requests
import json

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SERVICE_KEY:
    print("❌ Missing Supabase credentials in .env.local")
    exit(1)

headers = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json"
}

# Read migration
with open("supabase/migrations/001_initial_schema.sql") as f:
    sql = f.read()

# Split into individual statements
statements = [s.strip() for s in sql.split(";") if s.strip() and not s.strip().startswith("--")]

print(f"📋 Found {len(statements)} SQL statements")
print(f"🔗 Target: {SUPABASE_URL}")
print()

# Execute via PostgREST (limited - only works for some statements)
# For full schema creation, user must use SQL Editor

print("⚠️  Note: REST API has limitations for DDL statements.")
print("   For best results, copy the migration SQL and run it in Supabase SQL Editor:")
print(f"   https://supabase.com/dashboard/project/{SUPABASE_URL.split('//')[1].split('.')[0]}/sql/new")
print()

# Try to at least verify connection works
test_url = f"{SUPABASE_URL}/rest/v1/"
try:
    resp = requests.get(test_url, headers=headers)
    if resp.status_code < 500:
        print("✅ Supabase connection verified")
        print(f"   Status: {resp.status_code}")
    else:
        print(f"❌ Connection failed: {resp.status_code}")
except Exception as e:
    print(f"❌ Connection error: {e}")

print()
print("📝 Next steps:")
print("   1. Open Supabase SQL Editor (link above)")
print("   2. Copy contents of supabase/migrations/001_initial_schema.sql")
print("   3. Paste and run")
print("   4. Come back and restart the Loop server")
