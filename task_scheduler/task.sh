BROKER_URL="http://192.168.56.10:8080/schedule"  
LOG_FILE="results/results_$(date +%Y%m%d_%H%M%S).log"

mkdir -p "results"

echo "Running 50 requests to $BROKER_URL"
echo "Logging output to $LOG_FILE"

for i in $(seq 1 50)
do
  echo "[$i] Sending request..." | tee -a "$LOG_FILE"
  curl -s -X POST "$BROKER_URL" >> "$LOG_FILE"
  echo -e "\n----------------------------------------\n" >> "$LOG_FILE"
done

echo "Done. Output saved in $LOG_FILE"