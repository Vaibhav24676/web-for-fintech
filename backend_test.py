import requests
import json
import time
import sys
from datetime import datetime

class CustomerDataPortalTester:
    def __init__(self, base_url="https://242f9ffd-f0ad-4707-900a-1f91385340ca.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.customer_id = None
        self.consent_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        print(f"Using API URL: {self.api_url}")

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PATCH':
                response = requests.patch(url, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)
            
            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                result = {"name": name, "status": "PASSED", "response_code": response.status_code}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                result = {"name": name, "status": "FAILED", "response_code": response.status_code, 
                          "expected": expected_status}
            
            try:
                response_data = response.json()
                result["response"] = response_data
                return success, response_data
            except:
                result["response"] = response.text
                return success, response.text
                
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            result = {"name": name, "status": "ERROR", "error": str(e)}
            self.test_results.append(result)
            return False, None
        finally:
            self.test_results.append(result)

    def test_api_root(self):
        """Test the root API endpoint"""
        return self.run_test(
            "API Root Endpoint",
            "GET",
            "",
            200
        )

    def test_get_partners(self):
        """Test getting partners list"""
        return self.run_test(
            "Get Partners",
            "GET",
            "partners",
            200
        )

    def test_submit_customer_data(self):
        """Test customer data submission"""
        # Generate unique test data
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        test_data = {
            "full_name": f"Test User {timestamp}",
            "aadhaar_number": "1234-5678-9012",
            "pan_number": "ABCDE1234F",
            "mobile_number": "9876543210",
            "email": f"test{timestamp}@example.com",
            "address": "123 Test Street, Test Area",
            "district": "Test District",
            "state": "Test State",
            "pin_code": "110001"
        }
        
        success, response = self.run_test(
            "Submit Customer Data",
            "POST",
            "submit-customer-data",
            200,
            data=test_data
        )
        
        if success and 'id' in response:
            self.customer_id = response['id']
            print(f"Customer ID: {self.customer_id}")
        
        return success, response

    def test_get_user_data(self):
        """Test retrieving user data"""
        if not self.customer_id:
            print("❌ Cannot test user data retrieval without customer ID")
            return False, None
        
        return self.run_test(
            "Get User Data",
            "GET",
            f"user-data/{self.customer_id}",
            200
        )

    def test_create_consent(self):
        """Test creating consent"""
        if not self.customer_id:
            print("❌ Cannot test consent creation without customer ID")
            return False, None
        
        # First get partners
        success, partners = self.test_get_partners()
        if not success or not partners:
            print("❌ Cannot test consent creation without partners")
            return False, None
        
        partner = partners[0]
        
        consent_data = {
            "customer_id": self.customer_id,
            "partner_id": partner["id"],
            "partner_name": partner["name"],
            "data_types": ["full_name", "email", "mobile_number"],
            "purpose": "Test consent",
            "duration_days": 30
        }
        
        success, response = self.run_test(
            "Create Consent",
            "POST",
            "consents",
            200,
            data=consent_data
        )
        
        if success and 'id' in response:
            self.consent_id = response['id']
            print(f"Consent ID: {self.consent_id}")
        
        return success, response

    def test_get_consents(self):
        """Test retrieving consents"""
        if not self.customer_id:
            print("❌ Cannot test consent retrieval without customer ID")
            return False, None
        
        return self.run_test(
            "Get Consents",
            "GET",
            f"consents/{self.customer_id}",
            200
        )

    def test_revoke_consent(self):
        """Test revoking consent"""
        if not self.consent_id:
            print("❌ Cannot test consent revocation without consent ID")
            return False, None
        
        return self.run_test(
            "Revoke Consent",
            "PATCH",
            f"consents/{self.consent_id}/revoke",
            200
        )

    def test_data_transfer(self):
        """Test data transfer with consent"""
        if not self.customer_id or not self.consent_id:
            print("❌ Cannot test data transfer without customer ID and consent ID")
            return False, None
        
        # First get partners
        success, partners = self.test_get_partners()
        if not success or not partners:
            print("❌ Cannot test data transfer without partners")
            return False, None
        
        partner = partners[0]
        
        transfer_data = {
            "customer_id": self.customer_id,
            "partner_id": partner["id"],
            "consent_id": self.consent_id
        }
        
        return self.run_test(
            "Data Transfer",
            "POST",
            "data-transfer",
            200,
            data=transfer_data
        )

    def test_audit_log(self):
        """Test retrieving audit logs"""
        if not self.customer_id:
            print("❌ Cannot test audit log retrieval without customer ID")
            return False, None
        
        return self.run_test(
            "Get Audit Log",
            "GET",
            f"audit-log/{self.customer_id}",
            200
        )

    def test_blockchain_verify(self):
        """Test blockchain verification"""
        return self.run_test(
            "Verify Blockchain",
            "GET",
            "blockchain/verify",
            200
        )

    def test_export_data(self):
        """Test data export"""
        if not self.customer_id:
            print("❌ Cannot test data export without customer ID")
            return False, None
        
        return self.run_test(
            "Export Data",
            "GET",
            f"export-data/{self.customer_id}",
            200
        )

    def test_delete_data(self):
        """Test data deletion"""
        if not self.customer_id:
            print("❌ Cannot test data deletion without customer ID")
            return False, None
        
        return self.run_test(
            "Delete Data",
            "DELETE",
            f"delete-data/{self.customer_id}",
            200
        )

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Customer Data Portal API Tests")
        
        # Basic connectivity tests
        self.test_api_root()
        self.test_get_partners()
        
        # Customer data flow
        self.test_submit_customer_data()
        self.test_get_user_data()
        
        # Consent management
        self.test_create_consent()
        self.test_get_consents()
        
        # Data transfer
        self.test_data_transfer()
        
        # Audit and blockchain
        self.test_audit_log()
        self.test_blockchain_verify()
        
        # Compliance features
        self.test_export_data()
        
        # Consent revocation
        self.test_revoke_consent()
        
        # Data deletion (should be last)
        self.test_delete_data()
        
        # Print summary
        print("\n📊 Test Summary:")
        print(f"Tests passed: {self.tests_passed}/{self.tests_run} ({self.tests_passed/self.tests_run*100:.1f}%)")
        
        return self.tests_passed == self.tests_run

def main():
    # Get backend URL from environment or use default
    tester = CustomerDataPortalTester()
    success = tester.run_all_tests()
    
    # Write test results to file
    with open('backend_test_results.json', 'w') as f:
        json.dump(tester.test_results, f, indent=2)
    
    print(f"\n💾 Test results saved to backend_test_results.json")
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())