export const DB_NAME = 'yamanos';
export const DB_VERSION = 1;

export function migrate(db, oldVersion, newVersion, tx){
  // v1: object stores
  if(oldVersion < 1){
    db.createObjectStore('kv');                // key -> value
    db.createObjectStore('files', { keyPath: 'id' }); // file/folder records
    db.createObjectStore('recents', { keyPath: 'id' });
    db.createObjectStore('history', { keyPath: 'id' });
  }
}
