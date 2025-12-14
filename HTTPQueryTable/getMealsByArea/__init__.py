import logging
import os
import json

import azure.functions as func
from azure.data.tables import TableServiceClient


def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("getMealsByArea function triggered")

    # 1) Read ?area=... from URL
    area = req.params.get("area")
    if not area:
        return func.HttpResponse(
            json.dumps({"error": "Area parameter is required"}),
            status_code=400,
            mimetype="application/json"
        )

    # 2) Get connection string & table name from settings
    #    Keep same env var names as your JS code
    connection_string = os.getenv("group5five_STORAGE")
    table_name = os.getenv("TABLE_MEALS", "meals1")

    if not connection_string:
        return func.HttpResponse(
            json.dumps({"error": "AZURE_STORAGE_CONNECTION_STRING is not set"}),
            status_code=500,
            mimetype="application/json"
        )

    try:
        # 3) Create client
        service = TableServiceClient.from_connection_string(connection_string)
        client = service.get_table_client(table_name)

        # 4) Build filter: PartitionKey == area
        safe_area = area.replace("'", "''")  # escape quotes for OData
        filter_expr = f"PartitionKey eq '{safe_area}'"

        meals = []

        # 5) Query entities
        for entity in client.query_entities(query_filter=filter_expr):
            # Timestamp is a datetime; convert to string if present
            ts = entity.get("Timestamp")
            if ts is not None:
                try:
                    ts = ts.isoformat()
                except Exception:
                    ts = str(ts)

            meals.append({
                "PartitionKey": entity["PartitionKey"],
                "RowKey": entity["RowKey"],
                "Restaurant": entity.get("restaurantRowKey"),
                "Name": entity.get("dishName"),
                "Description": entity.get("description") or "",
                "PrepMinutes": entity.get("prepMinutes"),
                "Price": entity.get("price"),
                "Timestamp": entity.get("Timestamp")
            })

        # 6) Return JSON
        return func.HttpResponse(
            json.dumps(meals),
            status_code=200,
            mimetype="application/json"
        )

    except Exception as e:
        logging.error("Error querying meals table: %s", e)
        return func.HttpResponse(
            json.dumps({"error": "Failed to query meals table", "details": str(e)}),
            status_code=500,
            mimetype="application/json"
        )