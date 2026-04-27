type ConvexFunctionRef = any

const fn = (path: string): ConvexFunctionRef => path

export const api = {
  users: {
    createUser: fn('users:createUser'),
    getUserByEmail: fn('users:getUserByEmail'),
  },
  merchants: {
    listByUser: fn('merchants:listByUser'),
    listProducts: fn('merchants:listProducts'),
    getStoreForSync: fn('merchants:getStoreForSync'),
    getStoreForOwner: fn('merchants:getStoreForOwner'),
    updateStoreProfile: fn('merchants:updateStoreProfile'),
    upsertProduct: fn('merchants:upsertProduct'),
    upsertVariant: fn('merchants:upsertVariant'),
    deactivateMissingProducts: fn('merchants:deactivateMissingProducts'),
    recordSyncResult: fn('merchants:recordSyncResult'),
    saveStore: fn('merchants:saveStore'),
    updateToken: fn('merchants:updateToken'),
  },
  embedHelpers: {
    queueProductsForEmbedding: fn('embedHelpers:queueProductsForEmbedding'),
    claimPendingProducts: fn('embedHelpers:claimPendingProducts'),
    saveEmbedding: fn('embedHelpers:saveEmbedding'),
    markEmbeddingFailed: fn('embedHelpers:markEmbeddingFailed'),
    getEmbedStatus: fn('embedHelpers:getEmbedStatus'),
  },
}
