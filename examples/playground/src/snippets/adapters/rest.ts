import type { DataAdapter } from "better-content/core";

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`/api/content${path}`, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json() as Promise<T>;
};

export const adapter: DataAdapter = {
  fetchCollection(collection, query) {
    const params = new URLSearchParams({
      query: JSON.stringify(query ?? {}),
    });
    return request(`/${collection}?${params}`);
  },
  fetchById(collection, id) {
    return request(`/${collection}/${id}`);
  },
  create(collection, data) {
    return request(`/${collection}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  createWithId(collection, id, data) {
    return request(`/${collection}/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },
  update(collection, id, patch) {
    return request(`/${collection}/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },
  upsert(collection, id, data) {
    return request(`/${collection}/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },
  delete(collection, id) {
    return request(`/${collection}/${id}`, { method: "DELETE" });
  },
};
