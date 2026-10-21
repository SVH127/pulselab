import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { firestoreDb, isFirebaseConfigured } from '@/api/firebaseClient';
import { isSupabaseConfigured } from '@/api/supabaseClient';
import { supabaseEntities } from '@/api/supabaseAdapter';

const STORAGE_PREFIX = 'virtual_beat';
const USER_STORAGE_KEY = `${STORAGE_PREFIX}_user`;

const readJson = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
  return value;
};

const getEntityKey = (name) => `${STORAGE_PREFIX}_${name}`;

const normalizeId = (record) => {
  const now = new Date().toISOString();
  return {
    ...record,
    id: record.id || crypto.randomUUID(),
    created_date: record.created_date || now,
    updated_date: now,
  };
};

const removeUndefined = (value) => {
  if (Array.isArray(value)) {
    return value.map(removeUndefined);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, removeUndefined(entryValue)])
    );
  }

  return value;
};

const sortRecords = (records, sortBy) => {
  if (!sortBy) return records;

  const descending = sortBy.startsWith('-');
  const field = descending ? sortBy.slice(1) : sortBy;

  return [...records].sort((a, b) => {
    const aValue = a[field] ?? '';
    const bValue = b[field] ?? '';
    if (aValue === bValue) return 0;
    return (aValue > bValue ? 1 : -1) * (descending ? -1 : 1);
  });
};

const callLocalPg = async (payload) => {
  const res = await fetch('/api/local-pg', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Error en PostgreSQL local');
  return json.data;
};

const localPgEntity = (entityKey) => ({
  list: (sortBy) => callLocalPg({ entity: entityKey, action: 'list', sortBy }),
  get: (id) => callLocalPg({ entity: entityKey, action: 'get', id }),
  filter: (criteria = {}, sortBy) =>
    callLocalPg({ entity: entityKey, action: 'filter', criteria, sortBy }),
  create: (data) => callLocalPg({ entity: entityKey, action: 'create', data }),
  update: (id, data) => callLocalPg({ entity: entityKey, action: 'update', id, data }),
  delete: (id) => callLocalPg({ entity: entityKey, action: 'delete', id }),
  bulkCreate: async (items = []) =>
    Promise.all(items.map((data) => callLocalPg({ entity: entityKey, action: 'create', data }))),
});

const firestoreEntity = (name) => {
  const col = () => collection(firestoreDb, name);
  const parseDoc = (snapshot) => ({ id: snapshot.id, ...snapshot.data() });

  return {
    list: async (sortBy) => {
      const descending = sortBy?.startsWith('-');
      const field = descending ? sortBy.slice(1) : sortBy;
      const snapshot = await getDocs(field ? query(col(), orderBy(field, descending ? 'desc' : 'asc')) : col());
      return snapshot.docs.map(parseDoc);
    },
    get: async (id) => {
      const snapshot = await getDoc(doc(firestoreDb, name, id));
      if (!snapshot.exists()) throw new Error(`${name} not found`);
      return parseDoc(snapshot);
    },
    filter: async (criteria = {}, sortBy) => {
      const constraints = Object.entries(criteria).map(([field, value]) => where(field, '==', value));
      const snapshot = await getDocs(query(col(), ...constraints));
      return sortRecords(snapshot.docs.map(parseDoc), sortBy);
    },
    create: async (data) => {
      const record = normalizeId(data);
      const { id, ...payload } = removeUndefined(record);
      if (data.id) {
        await setDoc(doc(firestoreDb, name, id), payload);
        return record;
      }
      const ref = await addDoc(col(), payload);
      return { ...record, id: ref.id };
    },
    update: async (id, data) => {
      const current = await getDoc(doc(firestoreDb, name, id));
      if (!current.exists()) throw new Error(`${name} not found`);
      const updatedRecord = normalizeId({
        ...current.data(),
        ...data,
        id,
        created_date: current.data().created_date,
      });
      const { id: _id, ...payload } = removeUndefined(updatedRecord);
      await updateDoc(doc(firestoreDb, name, id), payload);
      return updatedRecord;
    },
    delete: async (id) => {
      await deleteDoc(doc(firestoreDb, name, id));
      return true;
    },
    bulkCreate: async (items = []) => Promise.all(items.map((item) => firestoreEntity(name).create(item))),
  };
};

const localEntity = (name) => {
  const key = getEntityKey(name);

  const list = async (sortBy) => sortRecords(readJson(key, []), sortBy);

  return {
    list,
    get: async (id) => {
      const record = readJson(key, []).find((item) => item.id === id);
      if (!record) throw new Error(`${name} not found`);
      return record;
    },
    filter: async (criteria = {}, sortBy) => {
      const records = await list(sortBy);
      return records.filter((record) =>
        Object.entries(criteria).every(([field, value]) => record[field] === value)
      );
    },
    create: async (data) => {
      const records = readJson(key, []);
      const record = normalizeId(data);
      writeJson(key, [...records, record]);
      return record;
    },
    update: async (id, data) => {
      const records = readJson(key, []);
      let updatedRecord = null;
      const nextRecords = records.map((record) => {
        if (record.id !== id) return record;
        updatedRecord = normalizeId({ ...record, ...data, id, created_date: record.created_date });
        return updatedRecord;
      });
      if (!updatedRecord) throw new Error(`${name} not found`);
      writeJson(key, nextRecords);
      return updatedRecord;
    },
    delete: async (id) => {
      const records = readJson(key, []);
      writeJson(key, records.filter((record) => record.id !== id));
      return true;
    },
    bulkCreate: async (items = []) => {
      const records = readJson(key, []);
      const nextItems = items.map(normalizeId);
      writeJson(key, [...records, ...nextItems]);
      return nextItems;
    },
  };
};

const isLocalPostgresEnabled =
  import.meta.env.DEV &&
  !isSupabaseConfigured &&
  !isFirebaseConfigured &&
  import.meta.env.VITE_USE_LOCAL_PG !== 'false';

const createEntity = (name, supabaseEntityKey) => {
  if (isSupabaseConfigured && supabaseEntityKey && supabaseEntities[supabaseEntityKey]) {
    return supabaseEntities[supabaseEntityKey];
  }
  if (isLocalPostgresEnabled && supabaseEntityKey) {
    return localPgEntity(supabaseEntityKey);
  }
  return isFirebaseConfigured ? firestoreEntity(name) : localEntity(name);
};

const getUser = () => readJson(USER_STORAGE_KEY, null);

export const dataClient = {
  auth: {
    me: async () => {
      const user = getUser();
      if (!user) {
        const error = new Error('Authentication required');
        error.status = 401;
        throw error;
      }
      return user;
    },
    setSession: async (user) => writeJson(USER_STORAGE_KEY, user),
    logout: async () => {
      localStorage.removeItem(USER_STORAGE_KEY);
      window.location.href = '/login';
    },
    redirectToLogin: () => {
      window.location.href = '/login';
    },
  },
  entities: {
    ClinicalCase: createEntity('clinical_cases', 'ClinicalCase'),
    StudentAccount: createEntity('student_accounts', 'StudentAccount'),
    StudentResult: createEntity('student_results', 'StudentResult'),
    User: createEntity('users', 'User'),
    PendingUser: createEntity('pending_users', 'PendingUser'),
  },
  users: {
    inviteUser: async (email, role = 'user', data = {}) => {
      const normalizedEmail = email.trim().toLowerCase();
      const user = {
        id: normalizedEmail,
        email: normalizedEmail,
        role,
        full_name: data.full_name || normalizedEmail,
        is_active: true,
      };

      const existingUsers = await dataClient.entities.User.filter({ email: normalizedEmail });
      if (existingUsers[0]) {
        await dataClient.entities.User.update(existingUsers[0].id, user);
      }

      return dataClient.entities.PendingUser.create(user);
    },
  },
};

export const ClinicalCase = dataClient.entities.ClinicalCase;
export const StudentAccount = dataClient.entities.StudentAccount;
export const StudentResult = dataClient.entities.StudentResult;
export const User = dataClient.entities.User;
export const PendingUser = dataClient.entities.PendingUser;
