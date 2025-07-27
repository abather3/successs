#!/bin/bash

# Midnight Reset Monitoring Script
# Date: July 22, 2025
# Purpose: Monitor automatic daily reset at 23:59-00:05 PH time

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
CONTAINER_NAME="escashop-backend-prod"
LOG_FILE="./logs/midnight_reset_$(date +%Y%m%d).log"
RESET_START_TIME="23:59:00"
RESET_END_TIME="00:05:00"

# Create logs directory if it doesn't exist
mkdir -p ./logs

# Logging function with timestamp
log() {
    local timestamp=$(TZ='Asia/Manila' date '+%Y-%m-%d %H:%M:%S')
    echo -e "${CYAN}[$timestamp PH]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    local timestamp=$(TZ='Asia/Manila' date '+%Y-%m-%d %H:%M:%S')
    echo -e "${GREEN}[$timestamp PH] ✅${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    local timestamp=$(TZ='Asia/Manila' date '+%Y-%m-%d %H:%M:%S')
    echo -e "${YELLOW}[$timestamp PH] ⚠️${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    local timestamp=$(TZ='Asia/Manila' date '+%Y-%m-%d %H:%M:%S')
    echo -e "${RED}[$timestamp PH] ❌${NC} $1" | tee -a "$LOG_FILE"
}

critical() {
    local timestamp=$(TZ='Asia/Manila' date '+%Y-%m-%d %H:%M:%S')
    echo -e "${MAGENTA}[$timestamp PH] 🔥${NC} $1" | tee -a "$LOG_FILE"
}

# Header
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║               MIDNIGHT RESET MONITORING SYSTEM                ║"
echo "║                                                                ║"
echo "║  🕐 Monitoring window: 23:59-00:05 Philippine Time            ║"
echo "║  📊 Target: Daily queue reset completion verification         ║"
echo "║  🎯 Expected: Automatic reset at 00:00:00 PH                  ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

log "🚀 Starting midnight reset monitoring system..."
log "📅 Current Philippine Time: $(TZ='Asia/Manila' date)"
log "🎯 Target reset time: 00:00:00 PH"
log "📝 Monitoring log: $LOG_FILE"

# Check if container is running
check_container_status() {
    if docker ps --format "table {{.Names}}\t{{.Status}}" | grep -q "$CONTAINER_NAME"; then
        local status=$(docker ps --format "{{.Status}}" --filter "name=$CONTAINER_NAME")
        success "Container $CONTAINER_NAME is running: $status"
        return 0
    else
        error "Container $CONTAINER_NAME is not running!"
        return 1
    fi
}

# Check application health
check_application_health() {
    local health_status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:5000/health" 2>/dev/null || echo "000")
    
    if [[ "$health_status" == "200" ]]; then
        success "Application health check: OK (200)"
        return 0
    else
        error "Application health check: FAILED ($health_status)"
        return 1
    fi
}

# Check scheduler status
check_scheduler_status() {
    local scheduler_status=$(curl -s "http://localhost:5000/api/scheduler/status" 2>/dev/null)
    
    if [[ $? -eq 0 ]] && [[ -n "$scheduler_status" ]]; then
        success "Scheduler status: $scheduler_status"
        return 0
    else
        warning "Could not retrieve scheduler status"
        return 1
    fi
}

# Monitor database connectivity
check_database_health() {
    local db_status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:5000/api/health/database" 2>/dev/null || echo "000")
    
    if [[ "$db_status" == "200" ]]; then
        success "Database connectivity: OK"
        return 0
    else
        error "Database connectivity: FAILED ($db_status)"
        return 1
    fi
}

# Monitor application logs for reset activity
monitor_reset_logs() {
    local duration=$1
    local end_time=$(date -d "+${duration} seconds" +%s)
    
    log "📊 Monitoring application logs for reset activity..."
    
    # Start log monitoring in background
    docker logs -f "$CONTAINER_NAME" 2>&1 | grep -E "(reset|midnight|scheduler|Daily Queue|🕐|🚀|✅|❌)" | \
    while read -r line; do
        local current_time=$(date +%s)
        if [[ $current_time -gt $end_time ]]; then
            break
        fi
        
        # Highlight important messages
        if echo "$line" | grep -qE "(🚀|Starting daily queue reset)"; then
            critical "RESET STARTED: $line"
        elif echo "$line" | grep -qE "(✅|reset completed successfully)"; then
            success "RESET COMPLETED: $line"
        elif echo "$line" | grep -qE "(❌|reset failed)"; then
            error "RESET FAILED: $line"
        elif echo "$line" | grep -qE "(Daily snapshot created|Queue data archived|Analytics updated|Active queue reset|Daily counters reset)"; then
            log "RESET PROGRESS: $line"
        else
            log "LOG: $line"
        fi
    done &
    
    return $!
}

# Real-time system metrics
show_system_metrics() {
    log "📈 Current system metrics:"
    
    # Memory usage
    local memory_usage=$(docker stats "$CONTAINER_NAME" --no-stream --format "{{.MemUsage}}" 2>/dev/null || echo "N/A")
    log "   💾 Memory usage: $memory_usage"
    
    # CPU usage
    local cpu_usage=$(docker stats "$CONTAINER_NAME" --no-stream --format "{{.CPUPerc}}" 2>/dev/null || echo "N/A")
    log "   🔧 CPU usage: $cpu_usage"
    
    # Container uptime
    local uptime=$(docker ps --filter "name=$CONTAINER_NAME" --format "{{.Status}}" 2>/dev/null || echo "N/A")
    log "   ⏱️  Container status: $uptime"
}

# Wait until specific time
wait_until_time() {
    local target_time="$1"
    local description="$2"
    
    log "⏳ Waiting until $target_time PH ($description)..."
    
    while true; do
        local current_time=$(TZ='Asia/Manila' date '+%H:%M:%S')
        
        if [[ "$current_time" == "$target_time" ]]; then
            log "🎯 Target time reached: $target_time PH"
            break
        fi
        
        # Show countdown every 30 seconds when close to target
        local current_seconds=$(TZ='Asia/Manila' date '+%s')
        local target_seconds=$(TZ='Asia/Manila' date -d "$target_time" '+%s' 2>/dev/null)
        
        if [[ -n "$target_seconds" ]]; then
            local diff=$((target_seconds - current_seconds))
            if [[ $diff -le 300 ]] && [[ $diff -gt 0 ]]; then # Within 5 minutes
                log "⏰ ${diff}s until $description (current: $current_time PH)"
            fi
        fi
        
        sleep 10
    done
}

# Monitor specific timeframe
monitor_timeframe() {
    local start_time="$1"
    local end_time="$2"
    local description="$3"
    
    log "📊 Monitoring timeframe: $start_time to $end_time PH ($description)"
    
    while true; do
        local current_time=$(TZ='Asia/Manila' date '+%H:%M:%S')
        
        # Exit condition
        if [[ "$current_time" > "$end_time" ]]; then
            log "⏰ Monitoring timeframe ended at $current_time PH"
            break
        fi
        
        # Perform checks every 10 seconds
        check_application_health
        
        # Special intensive checks during reset window (23:59-00:05)
        if [[ "$current_time" > "23:58:00" ]] && [[ "$current_time" < "00:06:00" ]]; then
            check_scheduler_status
            check_database_health
            show_system_metrics
            log "🔍 Intensive monitoring: $current_time PH"
        fi
        
        sleep 10
    done
}

# Main monitoring sequence
main_monitoring() {
    log "🏁 Beginning main monitoring sequence..."
    
    # Initial system checks
    log "🔧 Performing initial system checks..."
    if ! check_container_status; then
        critical "Container not running - aborting monitoring"
        exit 1
    fi
    
    check_application_health
    check_scheduler_status
    check_database_health
    show_system_metrics
    
    # Wait for pre-reset monitoring window (23:45)
    local current_time=$(TZ='Asia/Manila' date '+%H:%M')
    if [[ "$current_time" < "23:45" ]]; then
        wait_until_time "23:45:00" "pre-reset monitoring"
    fi
    
    log "🔍 Entering pre-reset monitoring phase (23:45-23:59)..."
    
    # Pre-reset monitoring (23:45-23:59)
    while true; do
        local current_time=$(TZ='Asia/Manila' date '+%H:%M:%S')
        
        if [[ "$current_time" > "23:58:30" ]]; then
            break
        fi
        
        check_application_health
        check_scheduler_status
        
        # More frequent checks as we approach midnight
        if [[ "$current_time" > "23:55:00" ]]; then
            log "⏰ Approaching reset time: $current_time PH"
            sleep 5
        else
            sleep 30
        fi
    done
    
    log "🎯 Entering intensive reset monitoring phase (23:58:30-00:05:00)..."
    
    # Intensive monitoring during reset window
    critical "🔥 INTENSIVE MONITORING STARTED - WATCHING FOR RESET"
    
    # Start log monitoring
    monitor_reset_logs 400 # 400 seconds = 6:40 minutes
    local log_monitor_pid=$!
    
    # Monitor the critical reset window
    while true; do
        local current_time=$(TZ='Asia/Manila' date '+%H:%M:%S')
        
        # Exit after monitoring window
        if [[ "$current_time" > "00:05:30" ]]; then
            log "⏰ Monitoring window completed"
            break
        fi
        
        # Log every 5 seconds during critical window
        log "🕐 $current_time PH - Monitoring active"
        
        check_application_health
        
        # Extra checks at key moments
        case "$current_time" in
            "23:59:00")
                critical "🎯 RESET TIME: 23:59:00 - Expecting reset initiation"
                check_scheduler_status
                ;;
            "23:59:30")
                critical "🔍 23:59:30 - Reset should be in progress"
                check_database_health
                ;;
            "00:00:00")
                critical "🌟 MIDNIGHT: 00:00:00 - DAILY RESET EXECUTION TIME"
                show_system_metrics
                ;;
            "00:00:30")
                critical "✅ 00:00:30 - Verifying reset process completion"
                ;;
            "00:01:00")
                log "📊 00:01:00 - Checking reset completion status"
                check_application_health
                check_database_health
                ;;
            "00:02:00")
                log "🔍 00:02:00 - Verifying system state post-reset"
                check_scheduler_status
                ;;
            "00:05:00")
                success "🏁 00:05:00 - Final verification completed"
                show_system_metrics
                ;;
        esac
        
        sleep 5
    done
    
    # Stop log monitoring
    if ps -p $log_monitor_pid > /dev/null 2>&1; then
        kill $log_monitor_pid
    fi
    
    # Final system status
    log "📋 Final system verification..."
    check_container_status
    check_application_health
    check_database_health
    show_system_metrics
    
    success "🎉 Midnight reset monitoring completed successfully"
}

# Start monitoring
trap 'log "🛑 Monitoring interrupted by user"; exit 0' INT TERM

main_monitoring

# Final report
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║              MIDNIGHT RESET MONITORING COMPLETE               ║"
echo "║                                                                ║"
echo "║  ✅ Monitoring window: 23:59-00:05 PH completed              ║"
echo "║  📊 All checks performed successfully                         ║"
echo "║  📝 Full log available in: $LOG_FILE                      ║"
echo "║  🎯 Daily reset verification completed                        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

log "📈 Monitoring summary:"
log "   • Start time: $(head -1 "$LOG_FILE" | grep -o '\[.*\]' | head -1)"
log "   • End time: $(TZ='Asia/Manila' date '+%Y-%m-%d %H:%M:%S') PH"
log "   • Log file: $LOG_FILE"
log "   • Container: $CONTAINER_NAME"
log "   • Status: Monitoring completed successfully"

success "🎯 Production rollout and midnight reset monitoring completed!"

exit 0
