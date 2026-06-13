import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import type { Employee, Machine, Material, Company } from '../types';

export function useEmployees(activeOnly = true) {
  return useLiveQuery(
    () => activeOnly
      ? db.employees.filter(e => !!e.active).sortBy('lastName')
      : db.employees.orderBy('lastName').toArray(),
    [activeOnly]
  );
}

export function useMachines(activeOnly = true) {
  return useLiveQuery(
    () => activeOnly
      ? db.machines.filter(e => !!e.active).sortBy('name')
      : db.machines.orderBy('name').toArray(),
    [activeOnly]
  );
}

export function useMaterials(activeOnly = true) {
  return useLiveQuery(
    () => activeOnly
      ? db.materials.filter(e => !!e.active).sortBy('name')
      : db.materials.orderBy('name').toArray(),
    [activeOnly]
  );
}

export function useCompany() {
  return useLiveQuery(() => db.company.toCollection().first());
}

export async function saveEmployee(data: Omit<Employee, 'id'>): Promise<string> {
  const id = uuidv4();
  await db.employees.add({ ...data, id });
  return id;
}

export async function updateEmployee(id: string, data: Partial<Employee>): Promise<void> {
  await db.employees.update(id, data);
}

export async function saveMachine(data: Omit<Machine, 'id'>): Promise<string> {
  const id = uuidv4();
  await db.machines.add({ ...data, id });
  return id;
}

export async function updateMachine(id: string, data: Partial<Machine>): Promise<void> {
  await db.machines.update(id, data);
}

export async function saveMaterial(data: Omit<Material, 'id'>): Promise<string> {
  const id = uuidv4();
  await db.materials.add({ ...data, id });
  return id;
}

export async function updateMaterial(id: string, data: Partial<Material>): Promise<void> {
  await db.materials.update(id, data);
}

export async function saveCompany(data: Omit<Company, 'id'>): Promise<void> {
  const existing = await db.company.toCollection().first();
  if (existing) {
    await db.company.update(existing.id, data);
  } else {
    await db.company.add({ ...data, id: uuidv4() });
  }
}
