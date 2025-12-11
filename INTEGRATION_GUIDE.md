# MealHub Integration Guide

## What We've Built

### Azure Functions (Backend API)
✅ Complete Azure Functions project in `/azure-functions/`
✅ 4 HTTP trigger functions:
- `getMealsByArea` - GET endpoint for meals by area
- `getRestaurantsByArea` - GET endpoint for restaurants by area  
- `addMeal` - POST endpoint to save meals
- `uploadImage` - POST endpoint to upload meal images

### Frontend
✅ Modern Uber Eats-themed UI with glassmorphism
✅ Customer ordering flow: area → restaurants → menu → cart → confirmation
✅ Restaurant meal registration form
✅ Areas updated to Madrid neighborhoods (Salamanca, Chamberí, Chamartín)

## Next Steps to Complete Integration

### 1. Deploy Azure Functions

```bash
cd azure-functions

# Install dependencies
npm install

# Install Azure Functions Core Tools (if not already installed)
npm install -g azure-functions-core-tools@4

# Test locally first
npm start
# Functions will run on http://localhost:7071

# Deploy to Azure (requires Azure CLI and login)
func azure functionapp publish <your-function-app-name>
```

### 2. Update Frontend Configuration

**Update `/config.js`** to add Azure Functions URL:

```javascript
const config = {
    // Add this after deployment
    azureFunctionsUrl: 'https://<your-function-app-name>.azurewebsites.net/api',
    // or for local testing:
    // azureFunctionsUrl: 'http://localhost:7071/api',
    
    // Keep existing Azure Storage config if needed for direct access
    storageAccountName: 'group5five',
    // ... rest of config
};
```

### 3. Update app.js to Use Azure Functions

**Replace direct Azure Table Storage calls with fetch() to Azure Functions:**

#### Example: Get Meals by Area
```javascript
// OLD (direct table access):
async function listMealsByArea(area) {
    const tableClient = TableClient.fromConnectionString(...);
    // ...
}

// NEW (Azure Functions):
async function listMealsByArea(area) {
    const response = await fetch(`${config.azureFunctionsUrl}/getMealsByArea?area=${area}`);
    return await response.json();
}
```

#### Example: Add Meal
```javascript
// NEW (Azure Functions):
async function addOrUpdateMeal(mealData) {
    const response = await fetch(`${config.azureFunctionsUrl}/addMeal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mealData)
    });
    return await response.json();
}
```

#### Example: Upload Image
```javascript
// NEW (Azure Functions):
async function uploadMealImage(file, mealName) {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('mealName', mealName);
    
    const response = await fetch(`${config.azureFunctionsUrl}/uploadImage`, {
        method: 'POST',
        body: formData
    });
    return await response.json();
}
```

### 4. Environment Configuration

**For Azure Functions deployment**, set these environment variables:

```bash
# Get your storage account key from Azure Portal
AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=group5five;AccountKey=YOUR_ACTUAL_KEY;EndpointSuffix=core.windows.net"

# Table and blob container names
TABLE_MEALS="meals1"
TABLE_RESTAURANTS="Restaurants"
BLOB_CONTAINER="mealimages"
```

### 5. Testing Workflow

1. **Test locally first**:
   - Start Azure Functions: `cd azure-functions && npm start`
   - Update config.js to point to `http://localhost:7071/api`
   - Start frontend server: `python3 -m http.server 8000`
   - Test in browser: http://localhost:8000/customer.html

2. **Test each function**:
   - Area selection → Should call getRestaurantsByArea
   - Restaurant selection → Should call getMealsByArea
   - Add meal (restaurant.html) → Should call uploadImage then addMeal

3. **Deploy to production**:
   - Deploy Azure Functions to Azure
   - Update config.js with production URL
   - Test complete flow

## Current Architecture

```
Frontend (HTML/CSS/JS)
    ↓ HTTP requests
Azure Functions (Node.js)
    ↓ SDK calls
Azure Table Storage (meals1, Restaurants)
Azure Blob Storage (mealimages)
```

## Benefits of This Architecture

✅ **Security**: Storage account keys stay server-side, not exposed in frontend
✅ **Flexibility**: Can add business logic, validation, and data transformation in Functions
✅ **CORS**: Properly handled in Azure Functions responses
✅ **Scalability**: Azure Functions auto-scale based on demand
✅ **Cost**: Pay-per-execution pricing (consumption plan)

## Files Modified/Created

### Created:
- `/azure-functions/package.json`
- `/azure-functions/host.json`
- `/azure-functions/local.settings.json`
- `/azure-functions/src/functions/getMealsByArea.js`
- `/azure-functions/src/functions/getRestaurantsByArea.js`
- `/azure-functions/src/functions/addMeal.js`
- `/azure-functions/src/functions/uploadImage.js`
- `/azure-functions/README.md`
- `/INTEGRATION_GUIDE.md` (this file)

### Need to Update:
- `/config.js` - Add azureFunctionsUrl
- `/app.js` - Replace direct table calls with fetch() to Azure Functions

## Questions?

Refer to `/azure-functions/README.md` for detailed deployment instructions and API documentation.
