#!/bin/bash

BROKER_HOST="http://192.168.56.10:8080"
SCHEDULE_URL="$BROKER_HOST/schedule"
RESET_URL="$BROKER_HOST/reset"
LOG_FILE="results/results_$(date +%Y%m%d_%H%M%S).log"

mkdir -p "results"

echo "Resetting state via $RESET_URL"
curl -s -X POST "$RESET_URL"
echo "Reset complete."

echo "Running 50 requests to $SCHEDULE_URL"
echo "Logging output to $LOG_FILE"

for i in $(seq 1 50)
do
  echo "[$i] Sending request..." | tee -a "$LOG_FILE"
  curl -s -X POST "$SCHEDULE_URL" >> "$LOG_FILE"
  echo -e "\n----------------------------------------\n" >> "$LOG_FILE"
done

echo "Done. Output saved in $LOG_FILE"
