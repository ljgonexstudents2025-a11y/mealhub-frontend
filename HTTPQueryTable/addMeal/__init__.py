import logging
import os
import json
import re
import base64

import azure.functions as func
from azure.data.tables import TableClient
from azure.storage.queue import QueueClient


def slugify(text: str) -> str:
    """Make a URL-safe slug from text (similar to your JS version)."""
    text = str(text).lower().strip()
    # Replace non-alphanumeric with hyphens
    text = re.sub(r"[^a-z0-9]+", "-", text)
    # Remove leading/trailing hyphens
    text = re.sub(r"(^-|-$)", "", text)
    return text or "meal"

def get_queue_client() -> QueueClient | None:
    """Get a QueueClient for logging invalid requests."""
    # Uses the same connection string you already use for tables
    conn = os.getenv("group5five_STORAGE")
    if not conn:
        logging.warning("No group5five_STORAGE connection string – cannot log to queue")
        return None

    queue_name = os.getenv("INVALID_REQUESTS_QUEUE", "invalid-meal-requests")
    try:
        client = QueueClient.from_connection_string(conn, queue_name)
        # Create the queue if it doesn't exist
        try:
            client.create_queue()
        except Exception:
            # Already exists or cannot create – ignore
            pass
        return client
    except Exception as e:
        logging.error("Failed to create QueueClient: %s", e)
        return None


def log_invalid_request(payload: dict, reason: str) -> bool:
    """Send an invalid request to the queue as a Base64 JSON message. Returns True if enqueued."""
    client = get_queue_client()
    if client is None:
        return False  # cannot log

    message = {
        "reason": reason,
        "payload": payload,
    }

    try:
        encoded = base64.b64encode(
            json.dumps(message).encode("utf-8")
        ).decode("ascii")
        client.send_message(encoded)
        return True
    except Exception as e:
        logging.error("Failed to send queue message: %s", e)
        return False

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("addMeal function triggered")

    # CORS headers (for browser / frontend)
    cors_headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }

    # Handle preflight
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers=cors_headers)

    try:
        try:
            body = req.get_json()
        except ValueError:
            return func.HttpResponse(
                json.dumps({"error": "Invalid JSON body"}),
                status_code=400,
                mimetype="application/json",
                headers=cors_headers,
            )

        restaurant = body.get("restaurant")
        name = body.get("name")
        description = body.get("description") or ""
        prep = body.get("prep")
        price = body.get("price")
        area = body.get("area")

        missing = [
            field
            for field, value in [
                ("restaurant", restaurant),
                ("name", name),
                ("prep", prep),
                ("price", price),
                ("area", area),
            ]
            if value in (None, "")
        ]
        if missing:
            logged = log_invalid_request(body, f"missing fields: {', '.join(missing)}")

            return func.HttpResponse(
                json.dumps(
                    {
                        "error": "Missing required fields",
                        "missing": missing,
                        "queueLogged": logged
                    }
                ),
                status_code=400,
                mimetype="application/json",
                headers=cors_headers,
            )

        
        # Convert numeric fields
        try:
            prep_minutes = int(prep)
            price_value = float(price)
        except (TypeError, ValueError):
            logged = log_invalid_request(body, "invalid prep or price format")

            return func.HttpResponse(
                json.dumps({"error": "Invalid prep or price format", "queueLogged": logged}),
                status_code=400,
                mimetype="application/json",
                headers=cors_headers,
            )

        # Connection details
        connection_string = os.getenv("group5five_STORAGE")
        table_name = os.getenv("TABLE_MEALS", "meals1")

        if not connection_string:
            return func.HttpResponse(
                json.dumps(
                    {"error": "AZURE_STORAGE_CONNECTION_STRING is not set"}
                ),
                status_code=500,
                mimetype="application/json",
                headers=cors_headers,
            )

        table_client = TableClient.from_connection_string(
            conn_str=connection_string, table_name=table_name
        )

        # Entity: I’m aligning names with your Python read function:
        # Restaurant, Name, Description, PrepMinutes, Price, ImageBlobName (optional)
        row_key = slugify(name)

        entity = {
            "PartitionKey": str(area),
            "RowKey": row_key,
            "restaurantRowKey": str(restaurant),
            "dishName": str(name),
            "description": str(description),
            "prepMinutes": prep_minutes,
            "price": price_value,
        }

        try:
            # Upsert entity (insert or replace)
            table_client.upsert_entity(entity)
        except Exception as table_error:
            logging.error("Table operation error: %s", table_error)
            return func.HttpResponse(
                json.dumps(
                    {
                        "error": "Failed to write to meals table",
                        "details": str(table_error),
                    }
                ),
                status_code=500,
                mimetype="application/json",
                headers=cors_headers,
            )

        # Success
        return func.HttpResponse(
            json.dumps(
                {
                    "success": True,
                    "message": "Meal saved successfully",
                    "entity": entity,
                }
            ),
            status_code=200,
            mimetype="application/json",
            headers=cors_headers,
        )

    except Exception as e:
        logging.error("Unexpected error in addMeal: %s", e)
        return func.HttpResponse(
            json.dumps({"error": "Internal server error", "details": str(e)}),
            status_code=500,
            mimetype="application/json",
            headers=cors_headers,
        )
