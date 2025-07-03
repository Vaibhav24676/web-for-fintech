#!/usr/bin/env python3
import requests
import json

# Test the partners endpoint
url = "https://242f9ffd-f0ad-4707-900a-1f91385340ca.preview.emergentagent.com/api/partners"
headers = {'Content-Type': 'application/json'}

print("Testing partners endpoint...")

# Make the request
response = requests.get(url, headers=headers)

print(f"Status code: {response.status_code}")
print(f"Response: {response.json()}")

# Check if partners were created
if response.status_code == 200:
    partners = response.json()
    print(f"Number of partners: {len(partners)}")
    if partners:
        print("Partners found:")
        for partner in partners:
            print(f"  - {partner['name']}")
    else:
        print("No partners found - this indicates an issue with partner initialization")
else:
    print(f"Error: {response.text}")