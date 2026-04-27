import {
  findAllSectors,
  insertSector,
  updateSector,
  deleteSector,
  findAllUsersWithSectors,
  updateUserSector,
} from "../repositories/sectors.repository.js";

export async function getAllSectors() {
  return await findAllSectors();
}

export async function createNewSector(data) {
  return await insertSector(data);
}

export async function updateSectorById(id, data) {
  return await updateSector(id, data);
}

export async function deleteSectorById(id) {
  return await deleteSector(id);
}

export async function getAllUsersWithSectors() {
  return await findAllUsersWithSectors();
}

export async function updateUserSectorById(userId, sectorId) {
  return await updateUserSector(userId, sectorId);
}