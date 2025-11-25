// Minimal Azure Table client for the browser using SAS
(function () {
  const cfg = window.APP_CONFIG;

  const BASE = `https://${cfg.STORAGE_ACCOUNT}.table.core.windows.net`;
  const TABLE_MEALS = cfg.TABLE_MEALS || 'meals1';
  const SAS = cfg.SAS_TOKEN; // must be URL-encoded (keep exactly as copied from Azure)

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
    return String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g,'');
  }

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
    // $filter uses single quotes; escape single quotes in area
    const a = String(area).replace(/'/g, "''");
    const extra = `&$filter=PartitionKey eq '${encodeURIComponent(a)}'`;
    const res = await fetch(tableUrl(TABLE_MEALS, extra), { headers: ODATA_HEADERS });
    if (!res.ok) throw new Error(`Query failed: ${res.status}`);
    const data = await res.json();
    // nometadata still returns {value: [...]}; but handle both just in case
    return Array.isArray(data) ? data : (data.value || []);
  }

  async function addOrUpdateMeal(formData) {
    const area = formData.get('area').trim();
    const name = formData.get('name').trim();

    const entity = {
      PartitionKey: area,
      RowKey: slug(name),
      Restaurant: formData.get('restaurant').trim(),
      Name: name,
      Description: formData.get('description')?.trim() || '',
      PrepMinutes: Number(formData.get('prep')),
      Price: Number(formData.get('price')),
      Timestamp: new Date().toISOString()
    };

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

  window.MealHub = {
    addOrUpdateMeal,
    listMealsByArea: listByArea
  };
})();
