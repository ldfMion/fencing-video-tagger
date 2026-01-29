export interface Tag {
  id: string;
  timestamp: number; // seconds into video
  text: string;
  createdAt: number; // unix timestamp
}

export interface VideoSession {
  id: string;
  fileName: string;
  tags: Tag[];
  lastModified: number; // unix timestamp
}
