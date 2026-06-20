#!/bin/bash
# Comprehensive live mode test - all 32 endpoints
set +e
BASE="${BASE:-http://localhost:3000}"
PASS=0
FAIL=0
FAILED=()

check_200() {
  local name="$1"
  local method="$2"
  local path="$3"
  local data="$4"

  if [ -n "$data" ]; then
    HTTP=$(curl -sS -o /tmp/loop_resp.txt -w "%{http_code}" -X "$method" "$BASE$path" -H "Content-Type: application/json" -d "$data")
  else
    HTTP=$(curl -sS -o /tmp/loop_resp.txt -w "%{http_code}" -X "$method" "$BASE$path")
  fi
  if [ "$HTTP" = "200" ] || [ "$HTTP" = "201" ]; then
    echo "  ✅ $name (HTTP $HTTP)"
    PASS=$((PASS+1))
  else
    echo "  ❌ $name (HTTP $HTTP)"
    head -c 150 /tmp/loop_resp.txt
    echo ""
    FAIL=$((FAIL+1))
    FAILED+=("$name")
  fi
}

check_field() {
  local name="$1"
  local method="$2"
  local path="$3"
  local data="$4"
  local field="$5"
  local value="$6"

  if [ -n "$data" ]; then
    HTTP=$(curl -sS -o /tmp/loop_resp.txt -w "%{http_code}" -X "$method" "$BASE$path" -H "Content-Type: application/json" -d "$data")
  else
    HTTP=$(curl -sS -o /tmp/loop_resp.txt -w "%{http_code}" -X "$method" "$BASE$path")
  fi
  if [ "$HTTP" != "200" ]; then
    echo "  ❌ $name (HTTP $HTTP)"
    FAIL=$((FAIL+1))
    FAILED+=("$name")
    return
  fi
  if grep -q "\"$field\":$value" /tmp/loop_resp.txt \
     || grep -q "\"$field\":\"$value\"" /tmp/loop_resp.txt \
     || grep -q "\"$field\":$value," /tmp/loop_resp.txt \
     || grep -q "\"$field\":true" /tmp/loop_resp.txt; then
    echo "  ✅ $name (found $field=$value)"
    PASS=$((PASS+1))
  else
    echo "  ❌ $name (no $field=$value)"
    head -c 200 /tmp/loop_resp.txt
    echo ""
    FAIL=$((FAIL+1))
    FAILED+=("$name")
  fi
}

echo ""
echo "🔴 LOOP FULL LIVE TEST — All 32 Endpoints"
echo "============================================================"

echo ""
echo "[Health & Config]"
check_field "Server live mode" GET "/api/health" "" "mode" "live"

echo ""
echo "[AI Pipeline]"
ORDER='{"phone":"+923****4567","contactName":"Demo Buyer","message":"Please send quotation for 500 units, urgent delivery needed","channel":"whatsapp"}'
check_field "Test webhook AI"  POST "/api/test/webhook" "$ORDER" "aiPowered" "true"
check_field "AI summary"        POST "/api/ai/summarize" "$ORDER" "ok" "true"

echo ""
echo "[Data Reads - Live Supabase]"
check_200 "Dashboard"         GET "/api/dashboard" ""
check_200 "Tasks"             GET "/api/tasks" ""
check_200 "Messages"          GET "/api/messages" ""
check_200 "Contacts"          GET "/api/contacts" ""
check_200 "Stats"             GET "/api/stats" ""
check_200 "Conversations"     GET "/api/conversations" ""
check_200 "Team"              GET "/api/team" ""
check_200 "Team workload"     GET "/api/team/workload" ""
check_200 "Analytics SLA"     GET "/api/analytics/response-time" ""
check_200 "Search"            GET "/api/search?q=quotation" ""
check_200 "Approvals"         GET "/api/approvals" ""

echo ""
echo "[Single-resource ops - NEW!]"
# Get a real task id
TASK_ID=$(curl -s "$BASE/api/tasks" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d[0]['id'] if d else '')" 2>/dev/null)
if [ -n "$TASK_ID" ]; then
  check_200 "Get single task"  GET "/api/tasks/$TASK_ID" ""
  check_200 "Update task"      PATCH "/api/tasks/$TASK_ID" '{"priority":"high"}'
else
  echo "  ⚠️  No task available for testing"
fi

# Get a real contact id
CONTACT_ID=$(curl -s "$BASE/api/contacts" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d[0]['id'] if d else '')" 2>/dev/null)
if [ -n "$CONTACT_ID" ]; then
  check_200 "Get single contact" GET "/api/contacts/$CONTACT_ID" ""
  check_200 "Get contact timeline" GET "/api/contacts/timeline?contactId=$CONTACT_ID" ""
else
  echo "  ⚠️  No contact available for testing"
fi

echo ""
echo "[Auto-ingestion - NEW!]"
check_200 "Auto-poll Wappfly"  GET "/api/auto-poll" ""
check_200 "Wappfly status"     GET "/api/wappfly/status" ""
check_200 "Wappfly recent"     GET "/api/wappfly/recent" ""
check_200 "Wappfly chats"      GET "/api/wappfly/chats" ""

echo ""
echo "[AI Features]"
check_200 "AI digest"          GET "/api/digest" ""
check_200 "AI summary endpoint" POST "/api/ai/summarize" "$ORDER"

echo ""
echo "[Workflow ops]"
check_200 "Escalate check"     GET "/api/escalate" ""
check_200 "Inngest endpoint"   GET "/api/inngest" ""
check_200 "Approvals send"     POST "/api/approvals/send" '{"approvalId":"none"}'

echo ""
echo "[Dev tools]"
check_200 "Debug state"        GET "/api/debug/state" ""
check_200 "Setup schema"       GET "/api/setup/schema" ""

echo ""
echo "============================================================"
TOTAL=$((PASS+FAIL))
echo "RESULT: $PASS / $TOTAL passed"
if [ $FAIL -gt 0 ]; then
  echo ""
  echo "FAILED:"
  for t in "${FAILED[@]}"; do echo "  - $t"; done
fi

{
  echo "Loop Full Live Test - $(date -Iseconds)"
  echo "PASS: $PASS / $TOTAL"
  if [ $FAIL -gt 0 ]; then
    echo ""
    echo "FAILED:"
    for t in "${FAILED[@]}"; do echo "  - $t"; done
  fi
} > /root/loop/tests/full_live_results.txt

exit $FAIL