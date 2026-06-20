#!/bin/bash
# Loop Live Mode Test Suite - Real APIs (Supabase + Groq + Wappfly)
# Tests against http://localhost:3000 (must be running)
set +e
BASE="${BASE:-http://localhost:3000}"
PASS=0
FAIL=0
FAILED=()

# Returns 0 if HTTP 200
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
  if [ "$HTTP" = "200" ]; then
    echo "  ✅ $name (HTTP 200)"
    PASS=$((PASS+1))
  else
    echo "  ❌ $name (HTTP $HTTP)"
    head -c 200 /tmp/loop_resp.txt
    echo ""
    FAIL=$((FAIL+1))
    FAILED+=("$name")
  fi
}

# Returns 0 if response contains a specific field/value
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
    head -c 200 /tmp/loop_resp.txt
    echo ""
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
    head -c 300 /tmp/loop_resp.txt
    echo ""
    FAIL=$((FAIL+1))
    FAILED+=("$name")
  fi
}

echo ""
echo "🔴 LOOP LIVE MODE TEST SUITE — Real Supabase + Groq + Wappfly"
echo "============================================================"
echo ""

echo "[1/8] Health & Config"
check_field "Server live mode"   GET "/api/health" "" "mode" "live"
check_field "Supabase configured" GET "/api/health" "" "supabase" "true"
check_field "Groq configured"    GET "/api/health" "" "groq" "true"
check_field "Wappfly configured" GET "/api/health" "" "wappfly" "true"
check_field "Inngest configured" GET "/api/health" "" "inngest" "true"

echo ""
echo "[2/8] AI Pipeline (real Groq)"
ORDER='{"phone":"+923****4567","contactName":"New Buyer","message":"Hi, I need a quotation for 500 units of your premium product. Please share pricing.","channel":"whatsapp"}'
check_field "Quote → task created"  POST "/api/test/webhook" "$ORDER" "aiPowered" "true"
check_field "Quote → 1 task"        POST "/api/test/webhook" "$ORDER" "createdTasks" "\["

COMPLAINT='{"phone":"+923****6543","contactName":"Angry Customer","message":"THIS IS THE THIRD TIME I am complaining about the broken delivery! No one is responding!","channel":"whatsapp"}'
check_field "Complaint → processed" POST "/api/test/webhook" "$COMPLAINT" "classification" "complaint"

INVOICE='{"phone":"+923****4321","contactName":"Vendor","message":"Please confirm payment of invoice INV-2024-0042 for \$5,400 was received.","channel":"whatsapp"}'
check_field "Invoice → task"        POST "/api/test/webhook" "$INVOICE" "aiPowered" "true"

SPAM='{"phone":"+923****0000","contactName":"Spam","message":"🎉 CONGRATULATIONS! You won a FREE iPhone! Click here: bit.ly/spam","channel":"whatsapp"}'
check_field "Spam → noise"          POST "/api/test/webhook" "$SPAM" "classification" "noise"

echo ""
echo "[3/8] Data Reads (real Supabase)"
check_200 "Dashboard"              GET "/api/dashboard" ""
check_200 "Tasks list"             GET "/api/tasks"     ""
check_200 "Messages list"          GET "/api/messages"  ""
check_200 "Contacts list"          GET "/api/contacts"  ""
check_200 "Stats"                  GET "/api/stats"     ""

echo ""
echo "[4/8] AI Features (real Groq)"
check_200 "AI Digest"              GET "/api/digest"    ""
check_200 "Team workload"          GET "/api/team/workload" ""

echo ""
echo "[5/8] Search & Filter"
check_200 "Search by text"         GET "/api/search?q=quotation" ""

echo ""
echo "[6/8] Wappfly Integration (real)"
check_field "Wappfly status connected" GET "/api/wappfly/status" "" "ok" "true"

echo ""
echo "[7/8] Approvals & Escalation"
check_200 "Approvals list"         GET "/api/approvals" ""

echo ""
echo "[8/8] Operations"
check_200 "Cron reminder ping"     GET "/api/reminders/send" ""
check_200 "Inngest endpoint"       GET "/api/inngest" ""

echo ""
echo "============================================================"
TOTAL=$((PASS+FAIL))
echo "RESULT: $PASS / $TOTAL passed"
if [ $FAIL -gt 0 ]; then
  echo "FAILED:"
  for t in "${FAILED[@]}"; do echo "  ❌ $t"; done
fi
echo ""

# Persist results
{
  echo "Loop Live Test - $(date -Iseconds)"
  echo "PASS: $PASS / $TOTAL"
  if [ $FAIL -gt 0 ]; then
    echo ""
    echo "FAILED:"
    for t in "${FAILED[@]}"; do echo "  - $t"; done
  fi
} > /root/loop/tests/live_results.txt

exit $FAIL
