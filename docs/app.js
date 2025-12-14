// Minimal Azure Table + Blob client for the browser using SAS
(function () {
  const cfg = window.APP_CONFIG;

  // --- Table Storage base ---
  const BASE = `https://${cfg.STORAGE_ACCOUNT}.table.core.windows.net`;
  const TABLE_MEALS = cfg.TABLE_MEALS || 'meals1';
  const TABLE_RESTAURANTS = cfg.TABLE_RESTAURANTS || 'Restaurants';
  const SAS = cfg.SAS_TOKEN; // must be URL-encoded (keep exactly as copied from Azure)

  // --- Blob Storage base ---
  const BLOB_BASE = `https://${cfg.STORAGE_ACCOUNT}.blob.core.windows.net`;
  const BLOB_CONTAINER = cfg.BLOB_CONTAINER || 'mealimages';
  const RESTAURANT_LOGOS_CONTAINER = 'restaurantlogos';

  const ODATA_HEADERS = {
    'Accept': 'application/json;odata=nometadata',
    'Content-Type': 'application/json;odata=nometadata'
  };

  function entityUrl(table, pk, rk) {
    const p = encodeURIComponent(pk);
    const r = encodeURIComponent(rk);
    return `${BASE}/${table}(PartitionKey='${p}',RowKey='${r}')?${SAS}`;
  }

  function tableUrl(table, extra = '') {
    const amp = extra ? (extra.startsWith('&') ? '' : '&') : '';
    return `${BASE}/${table}?${SAS}${extra ? amp + extra : ''}`;
  }

  function slug(s) {
    return String(s)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  // ---------- BLOB HELPERS ----------
  function blobUrl(blobName, container = BLOB_CONTAINER) {
    return `${BLOB_BASE}/${container}/${encodeURIComponent(blobName)}?${SAS}`;
  }

  async function uploadMealImage(file, area, name) {
    if (!file) return;

    const blobName = `${slug(area || 'general')}/${slug(name || file.name)}-${file.name}`;
    const url = blobUrl(blobName);

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'x-ms-blob-type': 'BlockBlob',
        'Content-Type': file.type || 'application/octet-stream'
      },
      body: file
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Blob upload failed: ${res.status} ${res.statusText} – ${t}`);
    }

    return blobName;
  }

  // ---------- TABLE HELPERS ----------
  async function insertEntity(table, data) {
    const res = await fetch(tableUrl(table), {
      method: 'POST',
      headers: ODATA_HEADERS,
      body: JSON.stringify(data)
    });
    return res;
  }

  async function mergeEntity(table, pk, rk, data) {
    const res = await fetch(entityUrl(table, pk, rk), {
      method: 'MERGE',                  // Azure Tables supports MERGE
      headers: { ...ODATA_HEADERS, 'If-Match': '*' },
      body: JSON.stringify(data)
    });
    return res;
  }

  async function listByArea(area) {
    // Call the Python Azure Function instead of Table Storage directly
    const url = `${cfg.FUNCTION_BASE_URL}${cfg.GET_MEALS_PATH}?area=${encodeURIComponent(area)}`;
    console.log('Fetching meals from URL:', url);
  
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) {
      const text = await res.text();
      console.error('Error response from getMealsByArea:', text);
      throw new Error(`Query failed: ${res.status}`);
    }
  
    const meals = await res.json();
  
    // Add image URLs to meals (same logic you already had)
    return meals.map(meal => {
      if (meal.ImageBlobName) {
        meal.ImageUrl = blobUrl(meal.ImageBlobName);
      }
      return meal;
    });
  }  

async function listRestaurantsByArea(area) {
  // Build the function URL
  const url = `${cfg.FUNCTION_BASE_URL}${cfg.LIST_RESTAURANTS_PATH}?area=${encodeURIComponent(area)}`;
  console.log('Fetching restaurants from URL:', url);

  const res = await fetch(url, {
    method: 'GET'
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('Function error response:', text);
    throw new Error(`Error loading restaurants: HTTP ${res.status}`);
  }

  const data = await res.json();
  const restaurants = Array.isArray(data) ? data : (data.value || []);

  // Add image URLs if needed
  return restaurants.map(restaurant => {
    // If your Python function already returns logoUrl you can use that
    // If you still store only ImageBlobName and build a URL on the client:
    if (!restaurant.ImageUrl && restaurant.ImageBlobName) {
      restaurant.ImageUrl = blobUrl(restaurant.ImageBlobName, RESTAURANT_LOGOS_CONTAINER);
    }
    return restaurant;
  });
}


async function addOrUpdateMeal(formData) {
  const area = formData.get('area')?.trim();
  const name = formData.get('name')?.trim();
  const file = formData.get('image');

  const restaurant = formData.get('restaurant')?.trim();
  const description = formData.get('description')?.trim() || '';
  const prep = formData.get('prep');
  const price = formData.get('price');

  const payload = {
    restaurant,     
    name,
    description,
    prep,
    price,
    area
  };

  if (file && file.size > 0) {
    const blobName = await uploadMealImage(file, area, name);
    payload.ImageBlobName = blobName;
  }

  const url = `${cfg.FUNCTION_BASE_URL}${cfg.ADD_MEAL_PATH}`;
  console.log('Calling addMeal at:', url, 'with payload:', payload);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
      },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('addMeal error response:', text);
    throw new Error(`Error saving meal: ${res.status} – ${text}`);
  }

  const result = await res.json();
  console.log('addMeal result:', result);
  return result;
}

  // Expose a single global object
  window.MealHub = {
    addOrUpdateMeal,
    listMealsByArea: listByArea,
    listRestaurantsByArea,
    uploadMealImage
  };
})();