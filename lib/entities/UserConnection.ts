/* eslint-disable @typescript-eslint/no-explicit-any */
export default class UserConnection {
  lastPing: number = Date.now();
  userId!: string;
  metadata: Record<string, any> = {};

  constructor(userId: string) {
    this.userId = userId;
  }

  ping() {
    this.lastPing = Date.now();
  }

  setMeta(key, value) {
    this.metadata[key] = value;
  }

  getMeta(key) {
    return this.metadata[key];
  }

  hasMeta(key) {
    return !!this.metadata[key];
  }

  deleteMeta(key) {
    delete this.metadata[key];
  }
}
