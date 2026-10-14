/**
 * Where the shell mounts the catalog. The portals do not know each other, but a cart has to take the person back to what they were
 * buying: this is the one place that says where. It is the shell's registry (src/remotes/registry.ts in amaranta-shop-front).
 */
export const CATALOG_PATH = '/catalog';
