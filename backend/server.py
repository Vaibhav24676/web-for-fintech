from fastapi import FastAPI, APIRouter, HTTPException, Body
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
from cryptography.fernet import Fernet
import base64
import hashlib
import json
from sklearn.ensemble import IsolationForest
import numpy as np
import pandas as pd

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI(title="Customer Data Portal", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Encryption utilities
def generate_key_from_id(user_id: str) -> bytes:
    """Generate encryption key from user ID"""
    key = hashlib.sha256(user_id.encode()).digest()
    return base64.urlsafe_b64encode(key)

def encrypt_data(data: str, user_id: str) -> str:
    """Encrypt data using user-specific key"""
    key = generate_key_from_id(user_id)
    f = Fernet(key)
    encrypted = f.encrypt(data.encode())
    return base64.urlsafe_b64encode(encrypted).decode()

def decrypt_data(encrypted_data: str, user_id: str) -> str:
    """Decrypt data using user-specific key"""
    key = generate_key_from_id(user_id)
    f = Fernet(key)
    encrypted_bytes = base64.urlsafe_b64decode(encrypted_data.encode())
    decrypted = f.decrypt(encrypted_bytes)
    return decrypted.decode()

# Blockchain implementation
class BlockchainBlock(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    index: int
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    data: Dict[str, Any]
    previous_hash: str
    hash: str

def calculate_hash(block_data: Dict[str, Any]) -> str:
    """Calculate hash for blockchain block"""
    block_string = json.dumps(block_data, sort_keys=True, default=str)
    return hashlib.sha256(block_string.encode()).hexdigest()

# Pydantic Models
class CustomerData(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    full_name: str
    aadhaar_number: str  # Will be encrypted
    pan_number: str      # Will be encrypted
    mobile_number: str   # Will be encrypted
    email: str
    address: str         # Will be encrypted
    district: str
    state: str
    pin_code: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class CustomerDataCreate(BaseModel):
    full_name: str
    aadhaar_number: str
    pan_number: str
    mobile_number: str
    email: str
    address: str
    district: str
    state: str
    pin_code: str

class ConsentData(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customer_id: str
    partner_id: str
    partner_name: str
    data_types: List[str]
    purpose: str
    duration_days: int
    granted_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime
    is_active: bool = True
    revoked_at: Optional[datetime] = None

class ConsentCreate(BaseModel):
    customer_id: str
    partner_id: str
    partner_name: str
    data_types: List[str]
    purpose: str
    duration_days: int

class AuditLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customer_id: str
    action: str
    details: Dict[str, Any]
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    ip_address: Optional[str] = None

class DataTransferRequest(BaseModel):
    customer_id: str
    partner_id: str
    consent_id: str

class Partner(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    type: str
    description: str
    is_active: bool = True

# Initialize sample partners
SAMPLE_PARTNERS = [
    {"id": "partner_1", "name": "HDFC Bank", "type": "bank", "description": "Housing loans and credit cards"},
    {"id": "partner_2", "name": "ICICI Bank", "type": "bank", "description": "Personal loans and investments"},
    {"id": "partner_3", "name": "Bajaj Finance", "type": "nbfc", "description": "Consumer finance and loans"},
    {"id": "partner_4", "name": "SBI Cards", "type": "fintech", "description": "Credit card services"},
    {"id": "partner_5", "name": "Paytm", "type": "fintech", "description": "Digital payments and lending"}
]

# Customer Data APIs
@api_router.post("/submit-customer-data", response_model=CustomerData)
async def submit_customer_data(data: CustomerDataCreate):
    """Submit and encrypt customer KYC data"""
    try:
        # Create customer data object
        customer_data = CustomerData(**data.dict())
        
        # Encrypt sensitive fields
        customer_data.aadhaar_number = encrypt_data(customer_data.aadhaar_number, customer_data.id)
        customer_data.pan_number = encrypt_data(customer_data.pan_number, customer_data.id)
        customer_data.mobile_number = encrypt_data(customer_data.mobile_number, customer_data.id)
        customer_data.address = encrypt_data(customer_data.address, customer_data.id)
        
        # Store in database
        await db.customer_data.insert_one(customer_data.dict())
        
        # Create audit log
        audit_log = AuditLog(
            customer_id=customer_data.id,
            action="customer_data_submitted",
            details={"fields": ["full_name", "aadhaar_number", "pan_number", "mobile_number", "email", "address"]}
        )
        await db.audit_logs.insert_one(audit_log.dict())
        
        # Create blockchain entry
        await create_blockchain_entry(customer_data.id, "customer_data_submitted", {"action": "data_submitted"})
        
        return customer_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/user-data/{customer_id}")
async def get_user_data(customer_id: str):
    """Get decrypted user data for Data Inventory"""
    try:
        customer_data = await db.customer_data.find_one({"id": customer_id})
        if not customer_data:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        # Remove MongoDB ObjectId
        if "_id" in customer_data:
            del customer_data["_id"]
        
        # Decrypt sensitive fields
        customer_data["aadhaar_number"] = decrypt_data(customer_data["aadhaar_number"], customer_id)
        customer_data["pan_number"] = decrypt_data(customer_data["pan_number"], customer_id)
        customer_data["mobile_number"] = decrypt_data(customer_data["mobile_number"], customer_id)
        customer_data["address"] = decrypt_data(customer_data["address"], customer_id)
        
        return customer_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Consent APIs
@api_router.post("/consents", response_model=ConsentData)
async def create_consent(consent: ConsentCreate):
    """Create a new consent"""
    try:
        # Calculate expiry date
        expires_at = datetime.utcnow() + timedelta(days=consent.duration_days)
        
        consent_data = ConsentData(
            **consent.dict(),
            expires_at=expires_at
        )
        
        await db.consents.insert_one(consent_data.dict())
        
        # Create audit log
        audit_log = AuditLog(
            customer_id=consent.customer_id,
            action="consent_granted",
            details={
                "consent_id": consent_data.id,
                "partner_name": consent.partner_name,
                "data_types": consent.data_types,
                "purpose": consent.purpose,
                "duration_days": consent.duration_days
            }
        )
        await db.audit_logs.insert_one(audit_log.dict())
        
        # Create blockchain entry
        await create_blockchain_entry(consent.customer_id, "consent_granted", {
            "consent_id": consent_data.id,
            "partner_id": consent.partner_id,
            "data_types": consent.data_types
        })
        
        return consent_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.patch("/consents/{consent_id}/revoke")
async def revoke_consent(consent_id: str):
    """Revoke an active consent"""
    try:
        consent = await db.consents.find_one({"id": consent_id})
        if not consent:
            raise HTTPException(status_code=404, detail="Consent not found")
        
        # Update consent
        await db.consents.update_one(
            {"id": consent_id},
            {"$set": {"is_active": False, "revoked_at": datetime.utcnow()}}
        )
        
        # Create audit log
        audit_log = AuditLog(
            customer_id=consent["customer_id"],
            action="consent_revoked",
            details={"consent_id": consent_id}
        )
        await db.audit_logs.insert_one(audit_log.dict())
        
        # Create blockchain entry
        await create_blockchain_entry(consent["customer_id"], "consent_revoked", {
            "consent_id": consent_id
        })
        
        return {"message": "Consent revoked successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/consents/{customer_id}")
async def get_consents(customer_id: str):
    """Get all consents for a customer"""
    try:
        consents = await db.consents.find({"customer_id": customer_id}).to_list(1000)
        
        # Remove MongoDB ObjectIds
        for consent in consents:
            if "_id" in consent:
                del consent["_id"]
        
        return consents
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Data Transfer API
@api_router.post("/data-transfer")
async def transfer_data(transfer_request: DataTransferRequest):
    """Transfer customer data to partner if valid consent exists"""
    try:
        # Check if consent is valid and active
        consent = await db.consents.find_one({
            "id": transfer_request.consent_id,
            "customer_id": transfer_request.customer_id,
            "partner_id": transfer_request.partner_id,
            "is_active": True
        })
        
        if not consent:
            raise HTTPException(status_code=403, detail="Invalid or expired consent")
        
        # Check if consent is not expired
        if datetime.utcnow() > consent["expires_at"]:
            raise HTTPException(status_code=403, detail="Consent has expired")
        
        # Get customer data
        customer_data = await db.customer_data.find_one({"id": transfer_request.customer_id})
        if not customer_data:
            raise HTTPException(status_code=404, detail="Customer data not found")
        
        # Decrypt only the data types specified in consent
        transfer_data = {}
        for data_type in consent["data_types"]:
            if data_type in customer_data:
                if data_type in ["aadhaar_number", "pan_number", "mobile_number", "address"]:
                    transfer_data[data_type] = decrypt_data(customer_data[data_type], transfer_request.customer_id)
                else:
                    transfer_data[data_type] = customer_data[data_type]
        
        # Create audit log
        audit_log = AuditLog(
            customer_id=transfer_request.customer_id,
            action="data_transferred",
            details={
                "partner_id": transfer_request.partner_id,
                "consent_id": transfer_request.consent_id,
                "data_types": consent["data_types"]
            }
        )
        await db.audit_logs.insert_one(audit_log.dict())
        
        # Create blockchain entry
        await create_blockchain_entry(transfer_request.customer_id, "data_transferred", {
            "partner_id": transfer_request.partner_id,
            "consent_id": transfer_request.consent_id,
            "data_types": consent["data_types"]
        })
        
        return {
            "message": "Data transferred successfully",
            "transfer_data": transfer_data,
            "partner_id": transfer_request.partner_id
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Blockchain APIs
async def create_blockchain_entry(customer_id: str, action: str, data: Dict[str, Any]):
    """Create an immutable blockchain entry"""
    try:
        # Get the latest block
        latest_block = await db.blockchain.find_one(sort=[("index", -1)])
        
        index = 0 if not latest_block else latest_block["index"] + 1
        previous_hash = "0" if not latest_block else latest_block["hash"]
        
        # Create block data
        block_data = {
            "index": index,
            "timestamp": datetime.utcnow(),
            "customer_id": customer_id,
            "action": action,
            "data": data,
            "previous_hash": previous_hash
        }
        
        # Calculate hash
        block_hash = calculate_hash(block_data)
        
        # Create blockchain block
        blockchain_block = BlockchainBlock(
            index=index,
            data=block_data,
            previous_hash=previous_hash,
            hash=block_hash
        )
        
        await db.blockchain.insert_one(blockchain_block.dict())
        
        return blockchain_block
        
    except Exception as e:
        print(f"Blockchain error: {e}")
        return None

@api_router.get("/blockchain/verify")
async def verify_blockchain():
    """Verify blockchain integrity"""
    try:
        blocks = await db.blockchain.find().sort("index", 1).to_list(1000)
        
        if not blocks:
            return {"valid": True, "message": "No blocks found"}
        
        for i, block in enumerate(blocks):
            if i == 0:
                continue
                
            previous_block = blocks[i-1]
            if block["previous_hash"] != previous_block["hash"]:
                return {"valid": False, "message": f"Invalid chain at block {i}"}
        
        return {"valid": True, "message": "Blockchain is valid"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Audit & Monitoring
@api_router.get("/audit-log/{customer_id}")
async def get_audit_log(customer_id: str):
    """Get audit logs for a customer"""
    try:
        audit_logs = await db.audit_logs.find({"customer_id": customer_id}).sort("timestamp", -1).to_list(1000)
        
        # Remove MongoDB ObjectIds
        for log in audit_logs:
            if "_id" in log:
                del log["_id"]
        
        return audit_logs
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Partners API
@api_router.get("/partners")
async def get_partners():
    """Get all available partners"""
    try:
        # Initialize sample partners if not exists
        partner_count = await db.partners.count_documents({})
        if partner_count == 0:
            for partner in SAMPLE_PARTNERS:
                await db.partners.insert_one(partner)
        
        partners = await db.partners.find({"is_active": True}).to_list(1000)
        
        # Remove MongoDB ObjectIds
        for partner in partners:
            if "_id" in partner:
                del partner["_id"]
        
        return partners
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Anomaly Detection
@api_router.post("/analyze-anomalies/{customer_id}")
async def analyze_anomalies(customer_id: str):
    """Detect anomalous behavior in customer consent patterns"""
    try:
        # Get customer's consent history
        consents = await db.consents.find({"customer_id": customer_id}).to_list(1000)
        
        if len(consents) < 3:
            return {"anomalies": [], "message": "Not enough data for analysis"}
        
        # Create features for anomaly detection
        features = []
        for consent in consents:
            # Feature engineering
            hour_granted = consent["granted_at"].hour
            day_of_week = consent["granted_at"].weekday()
            duration_days = consent["duration_days"]
            num_data_types = len(consent["data_types"])
            
            features.append([hour_granted, day_of_week, duration_days, num_data_types])
        
        # Apply Isolation Forest
        features_array = np.array(features)
        iso_forest = IsolationForest(contamination=0.1, random_state=42)
        anomalies = iso_forest.fit_predict(features_array)
        
        # Identify anomalous consents
        anomalous_consents = []
        for i, is_anomaly in enumerate(anomalies):
            if is_anomaly == -1:  # -1 indicates anomaly
                anomalous_consents.append({
                    "consent_id": consents[i]["id"],
                    "granted_at": consents[i]["granted_at"],
                    "partner_name": consents[i]["partner_name"],
                    "reason": "Unusual consent pattern detected"
                })
        
        return {
            "anomalies": anomalous_consents,
            "total_consents": len(consents),
            "anomaly_count": len(anomalous_consents)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Data Export and Deletion (DPDP Act compliance)
@api_router.get("/export-data/{customer_id}")
async def export_customer_data(customer_id: str):
    """Export all customer data for portability"""
    try:
        # Get customer data
        customer_data = await db.customer_data.find_one({"id": customer_id})
        if not customer_data:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        # Get consents
        consents = await db.consents.find({"customer_id": customer_id}).to_list(1000)
        
        # Get audit logs
        audit_logs = await db.audit_logs.find({"customer_id": customer_id}).to_list(1000)
        
        # Decrypt sensitive data
        customer_data["aadhaar_number"] = decrypt_data(customer_data["aadhaar_number"], customer_id)
        customer_data["pan_number"] = decrypt_data(customer_data["pan_number"], customer_id)
        customer_data["mobile_number"] = decrypt_data(customer_data["mobile_number"], customer_id)
        customer_data["address"] = decrypt_data(customer_data["address"], customer_id)
        
        export_data = {
            "customer_data": customer_data,
            "consents": consents,
            "audit_logs": audit_logs,
            "export_timestamp": datetime.utcnow()
        }
        
        # Create audit log for export
        audit_log = AuditLog(
            customer_id=customer_id,
            action="data_exported",
            details={"export_type": "full_data_export"}
        )
        await db.audit_logs.insert_one(audit_log.dict())
        
        return export_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/delete-data/{customer_id}")
async def delete_customer_data(customer_id: str):
    """Delete all customer data (Right to Erasure)"""
    try:
        # Delete customer data
        await db.customer_data.delete_many({"id": customer_id})
        
        # Revoke all active consents
        await db.consents.update_many(
            {"customer_id": customer_id, "is_active": True},
            {"$set": {"is_active": False, "revoked_at": datetime.utcnow()}}
        )
        
        # Create audit log for deletion
        audit_log = AuditLog(
            customer_id=customer_id,
            action="data_deleted",
            details={"deletion_type": "right_to_erasure"}
        )
        await db.audit_logs.insert_one(audit_log.dict())
        
        # Create blockchain entry
        await create_blockchain_entry(customer_id, "data_deleted", {
            "action": "right_to_erasure",
            "timestamp": datetime.utcnow()
        })
        
        return {"message": "Customer data deleted successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Test endpoint
@api_router.get("/")
async def root():
    return {"message": "Customer Data Portal API", "version": "1.0.0"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()