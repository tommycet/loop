#!/usr/bin/env python3
"""Apply Supabase migrations via direct Postgres connection."""
import os
import re
import sys
import psycopg2

DB_URL_PAT = re.compile(r"postgres(?:ql)?://(.*)@(.*?):(\d+)/(.*)")

def main():
    url = os.getenv("SUPABASE_DB_URL")
    if not url:
        print("❌ SUPABASE_DB_URL is not set. Set it in env to run migrations.")
        sys.exit(1)

    migration_path = sys.argv[1] if len(sys.argv) > 1 else "supabase/migrations/002_commitments.sql"
    with open(migration_path) as f:
        sql = f.read()

    print(f"📋 Applying migration: {migration_path}")
    conn = psycopg2.connect(url)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(sql)
    print("✅ Migration applied.")
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()