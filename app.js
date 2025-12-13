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


  // Normalize meal object to ensure consistent property names
  function normalizeMeal(meal) {
    meal.prepMinutes = meal.prepMinutes || meal.PrepMinutes || 0;
    meal.dishName = meal.dishName || meal.DishName || meal.dishname || '';
    meal.price = meal.price || meal.Price || 0;
    // Add more normalization as needed
    if (meal.ImageBlobName && !meal.ImageUrl) {
      meal.ImageUrl = blobUrl(meal.ImageBlobName);
    }
    return meal;
  }

  async function listByArea(area) {
    // $filter uses single quotes; escape single quotes in area
    const a = String(area).replace(/'/g, "''");
    const extra = `&$filter=PartitionKey eq '${encodeURIComponent(a)}'`;
    const res = await fetch(tableUrl(TABLE_MEALS, extra), { headers: ODATA_HEADERS });
    if (!res.ok) throw new Error(`Query failed: ${res.status}`);
    const data = await res.json();
    // nometadata still returns {value: [...]}; but handle both just in case
    const meals = Array.isArray(data) ? data : (data.value || []);
    // Normalize and add image URLs
    return meals.map(normalizeMeal);
  }

  // Put this somewhere in your config
const FUNCTION_BASE_URL = 'https://httpquerytablegroup5.azurewebsites.net';
const LIST_RESTAURANTS_PATH = '/api/HTTPQueryTable'; // from Azure

async function listRestaurantsByArea(area) {
  // Build the function URL
  const url = `${FUNCTION_BASE_URL}${LIST_RESTAURANTS_PATH}?area=${encodeURIComponent(area)}`;
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
    const area = formData.get('area').trim();
    const name = formData.get('name').trim();
    const file = formData.get('image');

    const entity = {
      PartitionKey: area,
      RowKey: slug(name),
      restaurantRowKey: formData.get('restaurant').trim(),
      dishName: name,
      description: formData.get('description')?.trim() || '',
      prepMinutes: Number(formData.get('prep')),
      price: Number(formData.get('price')),
      Timestamp: new Date().toISOString()
    };

    // If there's an image, upload it and store the blob name
    if (file && file.size > 0) {
      const blobName = await uploadMealImage(file, area, name);
      entity.ImageBlobName = blobName;
    }

    // Try insert first; on 409 (conflict) do MERGE to update
    let res = await insertEntity(TABLE_MEALS, entity);
    if (res.status === 409) {
      res = await mergeEntity(TABLE_MEALS, entity.PartitionKey, entity.RowKey, entity);
    }
    if (!res.ok && res.status !== 204) {
      const t = await res.text();
      throw new Error(`${res.status} ${res.statusText} – ${t}`);
    }
    return true;
  }

  // Expose a single global object
  window.MealHub = {
    addOrUpdateMeal,
    listMealsByArea: listByArea,
    listRestaurantsByArea,
    uploadMealImage
  };
})();





