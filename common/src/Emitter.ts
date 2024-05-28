export type EmitterCallback<T, K extends keyof T> = (arg: T[K]) => void;

export abstract class Emitter<T extends object> {
  private readonly _map: Record<
    keyof T,
    { callback: EmitterCallback<T, any>, key?: string | number, caller?: object }[]
  > = <any> {};

  public on<K extends keyof T>(evt: K, callback: (arg: T[K]) => void, ref?: string | number | object) {
    let lookup = this._map[evt];
    if (!lookup) {
      lookup = this._map[evt] = [];
    }

    switch (typeof ref) {
      case 'object':
        lookup.push({ callback, caller: ref });
        break;
      case 'string':
      case 'number':
        lookup.push({ callback, key: ref });
        break;
      default:
        lookup.push({ callback });
        break;
    }
  }

  public off<K extends keyof T>(evt: K, criteria: ((arg: T[K]) => void) | (string | number)) {
    let lookup = this._map[evt];
    if (!lookup) return;

    if (typeof criteria !== 'function') {
      lookup.splice(lookup.findIndex(e => e.key === criteria), 1);
    } else {
      lookup.splice(lookup.findIndex(e => e.callback === criteria), 1);
    }
  }

  protected emit<K extends keyof T>(evt: K, arg: T[K] = null): void {
    const lookup = this._map[evt];
    if (!lookup) return;

    for (const entry of lookup) {
      try {
        if (entry.caller) {
          entry.callback.call(entry.caller, arg);
        } else {
          entry.callback(arg);
        }

      } catch (err) {
        console.error(err);
      }
    }
  }
}