#!/usr/bin/env python

import requests
import time
import threading
from concurrent.futures import ThreadPoolExecutor

# Configuration
backend_url = "http://localhost:5001"
frontend_url = "http://localhost:3001"

# Results
results = {
    "requests": 0,
    "success": 0,
    "failures": 0,
    "latency": []
}

# Worker function
def perform_request(endpoint):
    try:
        start_time = time.time()
        response = requests.get(endpoint)
        latency = time.time() - start_time
        if response.status_code == 200:
            results["success"] += 1
        else:
            results["failures"] += 1
        results["latency"].append(latency)
    except requests.exceptions.RequestException:
        results["failures"] += 1
    finally:
        results["requests"] += 1

# Perform load test
def load_test(endpoint, num_requests=100, concurrency=10):
    print(f"Starting load test on {endpoint} with {num_requests} requests at {concurrency} concurrency")
    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        for _ in range(num_requests):
            executor.submit(perform_request, endpoint)

# Print results
def print_results():
    average_latency = sum(results["latency"]) / len(results["latency"]) if results["latency"] else 0
    print("\nLoad Test Results")
    print("=================")
    print(f"Total Requests: {results['requests']}")
    print(f"Successful Requests: {results['success']}")
    print(f"Failed Requests: {results['failures']}")
    print(f"Average Latency: {average_latency:.4f} seconds")

# Start load tests
if __name__ == "__main__":
    backend_thread = threading.Thread(target=load_test, args=(f"{backend_url}/health", 500, 50))
    frontend_thread = threading.Thread(target=load_test, args=(f"{frontend_url}", 500, 50))
    backend_thread.start()
    frontend_thread.start()
    backend_thread.join()
    frontend_thread.join()

    print_results()

