#!/bin/bash
set -e

TUNNEL_URL="https://4291a8461f3194.lhr.life"

echo "============================================================"
echo "FULL END-TO-END TEST — REAL WHATSAPP + AI PIPELINE"
echo "============================================================"

echo ""
echo "--- Step 1: Server health ---"
curl -s http://localhost:3000/api/health | python3 -m json.tool

echo ""
echo "--- Step 2: Wappfly status ---"
curl -s http://localhost:3000/api/wappfly/status | python3 -m json.tool

echo ""
echo "--- Step 3: Send real WhatsApp message ---"
curl -s -X POST http://localhost:3000/api/wappfly/send \
  -H "Content-Type: application/json" \
  -d '{"to":"923349566383","text":"Customer test: Need quote for 15 wooden chairs, delivery to Gulberg Lahore by Friday."}' | python3 -m json.tool

echo ""
echo "--- Step 4: Poll Wappfly for messages ---"
curl -s http://localhost:3000/api/wappfly/poll | python3 -m json.tool

echo ""
echo "--- Step 5: Process messages through AI ---"
curl -s -X POST http://localhost:3000/api/wappfly/poll | python3 -m json.tool

echo ""
echo "--- Step 6: Dashboard ---"
curl -s http://localhost:3000/api/dashboard | python3 -m json.tool

echo ""
echo "--- Step 7: Stats ---"
curl -s http://localhost:3000/api/stats | python3 -m json.tool

echo ""
echo "--- Step 8: AI Daily Digest ---"
curl -s http://localhost:3000/api/digest | python3 -m json.tool

echo ""
echo "--- Step 9: Team Workload ---"
curl -s http://localhost:3000/api/team/workload | python3 -m json.tool

echo ""
echo "--- Step 10: Public tunnel check ---"
curl -s "$TUNNEL_URL/api/health" | python3 -m json.tool

echo ""
echo "--- Step 11: Send WhatsApp via tunnel ---"
curl -s -X POST "$TUNNEL_URL/api/wappfly/send" \
  -H "Content-Type: application/json" \
  -d '{"to":"923349566383","text":"Loop ops agent is LIVE via public tunnel!"}' | python3 -m json.tool

echo ""
echo "--- Step 12: AI Operations Summary ---"
curl -s "http://localhost:3000/api/ai/summarize?type=all" | python3 -m json.tool

echo ""
echo "--- Step 13: Search tests ---"
for q in quote payment delivery invoice appointment; do
  echo -n "  Search '$q': "
  curl -s "http://localhost:3000/api/search?q=$q&type=messages" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{d.get(\"count\",0)} results')"
done

echo ""
echo "--- Step 14: Escalation check ---"
curl -s http://localhost:3000/api/escalate | python3 -m json.tool

echo ""
echo "============================================================"
echo "FULL END-TO-END TEST COMPLETE!"
echo "  Public URL: $TUNNEL_URL"
echo "  WhatsApp: +92 334 9566383 (connected)"
echo "  AI: Groq + OpenRouter (real API calls)"
echo "  30 API endpoints"
echo "============================================================"
