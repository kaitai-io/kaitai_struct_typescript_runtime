import { KaitaiStream } from './KaitaiStream';

export class KaitaiStruct {
  protected _io: KaitaiStream;
  constructor(io: KaitaiStream) {
    this._io = io
  }
}
