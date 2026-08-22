import { seedData } from './seedData';

const STORAGE_KEYS = {
  categories: 'minishop_categories',
  products: 'minishop_products',
  inventoryTransactions: 'minishop_inventoryTransactions',
  orders: 'minishop_orders',
};

export const initSeedData = () => {
  if (typeof window === 'undefined' || !window.localStorage) return;

  const shouldSeedKey = (key) => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null || raw === undefined || raw === '' || raw === 'null' || raw === 'undefined') {
        return true;
      }
      JSON.parse(raw);
      return false;
    } catch {
      return true;
    }
  };

  if (shouldSeedKey(STORAGE_KEYS.categories)) {
    localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(seedData.categories));
  }
  if (shouldSeedKey(STORAGE_KEYS.products)) {
    localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(seedData.products));
  }
  if (shouldSeedKey(STORAGE_KEYS.inventoryTransactions)) {
    localStorage.setItem(STORAGE_KEYS.inventoryTransactions, JSON.stringify(seedData.inventoryTransactions));
  }
  if (shouldSeedKey(STORAGE_KEYS.orders)) {
    localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(seedData.orders));
  }
};

const getCollection = (resource) => {
  initSeedData();
  const key = STORAGE_KEYS[resource];
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error(`Error reading ${resource} from localStorage`, e);
    return [];
  }
};

const setCollection = (resource, data) => {
  const key = STORAGE_KEYS[resource];
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Error saving ${resource} to localStorage`, e);
  }
};

export const handleLocalStorageRequest = (method, url, body) => {
  initSeedData();

  const [path, queryString] = url.split('?');
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const parts = cleanPath.split('/').filter(Boolean);

  const resource = parts[0];
  const id = parts[1];

  const queryParams = new URLSearchParams(queryString || '');

  if (!STORAGE_KEYS[resource]) {
    return Promise.reject(new Error(`Unknown resource: ${resource}`));
  }

  if (method === 'GET') {
    if (id) {
      const items = getCollection(resource);
      const item = items.find(x => String(x.id) === String(id));
      if (!item) {
        return Promise.reject({ response: { status: 404, statusText: 'Not Found' } });
      }
      return Promise.resolve({ data: JSON.parse(JSON.stringify(item)) });
    } else {
      let items = getCollection(resource);
      for (const [key, value] of queryParams.entries()) {
        if (key && value !== undefined && value !== '') {
          items = items.filter(x => String(x[key]) === String(value));
        }
      }
      return Promise.resolve({ data: JSON.parse(JSON.stringify(items)) });
    }
  }

  if (method === 'POST') {
    const items = getCollection(resource);
    const newRecord = { ...body };
    items.push(newRecord);
    setCollection(resource, items);
    return Promise.resolve({ data: JSON.parse(JSON.stringify(newRecord)) });
  }

  if (method === 'PUT') {
    const items = getCollection(resource);
    const index = items.findIndex(x => String(x.id) === String(id));
    if (index !== -1) {
      items[index] = { ...body };
    } else {
      items.push({ ...body });
    }
    setCollection(resource, items);
    return Promise.resolve({ data: JSON.parse(JSON.stringify(body)) });
  }

  if (method === 'PATCH') {
    const items = getCollection(resource);
    const index = items.findIndex(x => String(x.id) === String(id));
    let updated = body;
    if (index !== -1) {
      items[index] = { ...items[index], ...body };
      updated = items[index];
    }
    setCollection(resource, items);
    return Promise.resolve({ data: JSON.parse(JSON.stringify(updated)) });
  }

  if (method === 'DELETE') {
    let items = getCollection(resource);
    items = items.filter(x => String(x.id) !== String(id));
    setCollection(resource, items);
    return Promise.resolve({ data: {} });
  }

  return Promise.reject(new Error(`Unsupported method: ${method}`));
};
