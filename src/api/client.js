import AsyncStorage from '@react-native-async-storage/async-storage';
import { USE_MOCK, BASE_URL, SEED_VERSION } from '../config';
import seed from '../data/seed';

const mockKey = (r) => `furworld:mock:v${SEED_VERSION}:${r}`;
const delay = (ms = 150) => new Promise((r) => setTimeout(r, ms));

async function readMock(resource) {
  const raw = await AsyncStorage.getItem(mockKey(resource));
  if (raw) return JSON.parse(raw);
  const initial = seed[resource] || [];
  await AsyncStorage.setItem(mockKey(resource), JSON.stringify(initial));
  return initial;
}
const writeMock = (resource, data) => AsyncStorage.setItem(mockKey(resource), JSON.stringify(data));

async function http(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Giao diện giống mockapi.io: list / create / update / remove
export const client = {
  async list(resource) {
    if (USE_MOCK) { await delay(); return readMock(resource); }
    return http('GET', `/${resource}`);
  },
  async create(resource, item) {
    if (USE_MOCK) {
      const all = await readMock(resource);
      const rec = { ...item, id: String(Date.now()) };
      await writeMock(resource, [...all, rec]);
      return rec;
    }
    return http('POST', `/${resource}`, item);
  },
  async update(resource, id, patch) {
    if (USE_MOCK) {
      const all = await readMock(resource);
      let out;
      await writeMock(resource, all.map((x) => (String(x.id) === String(id) ? (out = { ...x, ...patch, id: x.id }) : x)));
      return out;
    }
    return http('PUT', `/${resource}/${id}`, patch);
  },
  async remove(resource, id) {
    if (USE_MOCK) {
      const all = await readMock(resource);
      await writeMock(resource, all.filter((x) => String(x.id) !== String(id)));
      return {};
    }
    return http('DELETE', `/${resource}/${id}`);
  },
};
