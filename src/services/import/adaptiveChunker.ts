interface ChunkConfig { chunkSize: number; overlap: number; }

export function getAdaptiveChunkConfig(nodeType: string): ChunkConfig {
  const base = parseInt(process.env.IMPORT_CHUNK_SIZE  || '600', 10);
  const lap  = parseInt(process.env.IMPORT_CHUNK_OVERLAP || '100', 10);
  switch (nodeType.toLowerCase()) {
    case 'formula': case 'definition': case 'equation':
      return { chunkSize: 350, overlap: 70 };
    case 'case_study': case 'literature': case 'history': case 'essay':
      return { chunkSize: 800, overlap: 150 };
    default:
      return { chunkSize: base, overlap: lap };
  }
}
