import logging
import os
import json

import azure.functions as func
from azure.data.tables import TableServiceClient


def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("HTTPQueryTable function triggered")

    # 1) Read ?area=... from URL
    area = req.params.get("area")
    if not area:
        return func.HttpResponse(
            json.dumps({"error": "Missing 'area' query parameter"}),
            status_code=400,
            mimetype="application/json"
        )

    # 2) Get connection string & table name from settings
    connection_string = os.getenv("group5five_STORAGE")
    table_name = os.getenv("TABLE_RESTAURANTS", "Restaurants")

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
        safe_area = area.replace("'", "''")
        filter_expr = f"PartitionKey eq '{safe_area}'"

        restaurants = []

        # ✅ Correct call to query_entities
        for entity in client.query_entities(query_filter=filter_expr):
            restaurants.append({
                "PartitionKey": entity["PartitionKey"],
                "RowKey": entity["RowKey"],
                "ImageBlobName": entity.get("ImageBlobName"),
                "logoUrl": entity.get("logoUrl"),
            })

        # 5) Return JSON
        return func.HttpResponse(
            json.dumps(restaurants),
            status_code=200,
            mimetype="application/json"
        )

    except Exception as e:
        logging.error("Error querying table: %s", e)
        return func.HttpResponse(
            json.dumps({"error": "Failed to query table", "details": str(e)}),
            status_code=500,
            mimetype="application/json"
        )
