export interface EntityAddress {
  id: string;
  collection: string;
}

export type Editable<T = Record<string, unknown>> = T & EntityAddress;

export type Item = Record<string, unknown> & { id: string };

export type ItemMap = Record<string, Item[]>;

export interface PendingImage {
  file: File | null;
  localUrl: string;
  collection: string;
  itemId: string;
  fieldKey: string;
  isExternal?: boolean;
}

export interface ClientStorageAdapter {
  upload(file: File): Promise<{ url: string }>;
}

export interface CmsAuthState {
  isAdmin: boolean;
  isEditing: boolean;
  toggleEdit: () => void;
}
