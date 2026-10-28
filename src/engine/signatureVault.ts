import { SignatureMode } from '../types';

export interface VaultItem {
  id: string;
  label: string;
  createdAt: string;
  dataUrl: string;
  mode: SignatureMode;
}

const VAULT_STORAGE_KEY = 'esignature_vault_v1';

export function getVaultItems(): VaultItem[] {
  try {
    const raw = localStorage.getItem(VAULT_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to read signature vault:', err);
    return [];
  }
}

export function saveToVault(
  label: string,
  dataUrl: string,
  mode: SignatureMode
): VaultItem {
  const items = getVaultItems();
  const newItem: VaultItem = {
    id: `sig_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    label: label.trim() || `Signature ${items.length + 1}`,
    createdAt: new Date().toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }),
    dataUrl,
    mode,
  };

  items.unshift(newItem);
  // Cap at 12 items to preserve local storage limits
  const trimmed = items.slice(0, 12);
  localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(trimmed));
  return newItem;
}

export function deleteFromVault(id: string): VaultItem[] {
  const items = getVaultItems().filter((item) => item.id !== id);
  localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(items));
  return items;
}
