# MealHub Azure Functions

This directory contains Azure Functions that serve as the API layer between the frontend and Azure Table Storage/Blob Storage.

## Functions Overview

### 1. getMealsByArea
- **Type**: HTTP GET
- **Route**: `/api/getMealsByArea?area={area}`
- **Description**: Retrieves all meals for a specific area (Salamanca, Chamberi, or Chamartin)
- **Returns**: JSON array of meal entities

### 2. getRestaurantsByArea
- **Type**: HTTP GET
- **Route**: `/api/getRestaurantsByArea?area={area}`
- **Description**: Retrieves all restaurants for a specific area
- **Returns**: JSON array of restaurant entities

### 3. addMeal
- **Type**: HTTP POST
- **Route**: `/api/addMeal`
- **Description**: Adds or updates a meal in the meals1 table
- **Request Body**:
```json
{
  "restaurant": "Restaurant Name",
  "name": "Dish Name",
  "description": "Description",
  "prep": "30",
  "price": "12.99",
  "area": "Salamanca",
  "imageBlobName": "optional-blob-name.jpg"
}
```
- **Returns**: Success confirmation with entity data

### 4. uploadImage
- **Type**: HTTP POST
- **Route**: `/api/uploadImage`
- **Description**: Uploads meal image to Azure Blob Storage
- **Request**: FormData with 'image' file and 'mealName' text
- **Returns**: Blob name and URL

## Environment Variables

Required environment variables in `local.settings.json`:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AZURE_STORAGE_CONNECTION_STRING": "DefaultEndpointsProtocol=https;AccountName=group5five;AccountKey=YOUR_KEY;EndpointSuffix=core.windows.net",
    "TABLE_MEALS": "meals1",
    "TABLE_RESTAURANTS": "Restaurants",
    "BLOB_CONTAINER": "mealimages"
  }
}
```

## Development Setup

1. **Install dependencies**:
```bash
cd azure-functions
npm install
```

2. **Update connection strings**:
   - Edit `local.settings.json`
   - Replace `YOUR_KEY` with actual Azure Storage account key

3. **Run locally**:
```bash
npm start
```

This will start the Azure Functions runtime locally on http://localhost:7071

## Testing Locally

### Test getMealsByArea:
```bash
curl "http://localhost:7071/api/getMealsByArea?area=Salamanca"
```

### Test getRestaurantsByArea:
```bash
curl "http://localhost:7071/api/getRestaurantsByArea?area=Chamberi"
```

### Test addMeal:
```bash
curl -X POST http://localhost:7071/api/addMeal \
  -H "Content-Type: application/json" \
  -d '{
    "restaurant": "Test Restaurant",
    "name": "Test Dish",
    "description": "Delicious test meal",
    "prep": "25",
    "price": "15.99",
    "area": "Salamanca"
  }'
```

### Test uploadImage:
```bash
curl -X POST http://localhost:7071/api/uploadImage \
  -F "image=@/path/to/image.jpg" \
  -F "mealName=Test Dish"
```

## Deployment to Azure

### Using Azure CLI:

1. **Login to Azure**:
```bash
az login
```

2. **Create a Function App** (if not already created):
```bash
az functionapp create \
  --resource-group <your-resource-group> \
  --consumption-plan-location westeurope \
  --runtime node \
  --runtime-version 18 \
  --functions-version 4 \
  --name <your-function-app-name> \
  --storage-account group5five
```

3. **Deploy**:
```bash
cd azure-functions
func azure functionapp publish <your-function-app-name>
```

### Configure Application Settings:

After deployment, set environment variables in Azure:

```bash
az functionapp config appsettings set \
  --name <your-function-app-name> \
  --resource-group <your-resource-group> \
  --settings \
    AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=group5five;AccountKey=YOUR_KEY;EndpointSuffix=core.windows.net" \
    TABLE_MEALS="meals1" \
    TABLE_RESTAURANTS="Restaurants" \
    BLOB_CONTAINER="mealimages"
```

## Update Frontend Configuration

After deployment, update `/config.js` in the frontend:

```javascript
const config = {
    azureFunctionsUrl: 'https://<your-function-app-name>.azurewebsites.net/api'
};
```

Then update `/app.js` to use these endpoints instead of direct table access.

## CORS Configuration

CORS is already enabled in all function responses with:
```javascript
'Access-Control-Allow-Origin': '*'
```

For production, consider restricting to specific origins:
```javascript
'Access-Control-Allow-Origin': 'https://yourdomain.com'
```

## Dependencies

- `@azure/functions`: Azure Functions Node.js SDK
- `@azure/data-tables`: Azure Table Storage client
- `@azure/storage-blob`: Azure Blob Storage client

## Troubleshooting

- **401 Unauthorized**: Check connection string and account key
- **404 Not Found**: Verify table/container names match Azure resources
- **CORS errors**: Ensure CORS headers are set in responses
- **Local testing fails**: Make sure `func` CLI tools are installed: `npm install -g azure-functions-core-tools@4`
