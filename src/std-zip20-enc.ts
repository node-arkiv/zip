// from https://github.com/artem-karpenko/archiver-zip-encrypted/blob/master/lib/zip20/

import crc32 from './crc32';
import crypto from 'crypto';
import { UINT32 } from '@arkiv/buffer';

const _uint8 = n => n & 0xFF;
const _uint32 = n => n & 0xFFFFFFFF;

class CryptoChiper {

	private key: Buffer;
	private key0: number;
	private key1: number;
	private key2: number;

	constructor(key: string) {
		this.key = Buffer.from(key);

		this.key0 = 0x12345678;
		this.key1 = 0x23456789;
		this.key2 = 0x34567890;

		for (const b of this.key) {
			this.updateKeys(b);
		}
	}

	private updateKeys(b: number) {
		this.key0 = crc32(this.key0, b);
		this.key1 = _uint32(this.key1 + (this.key0 & 0xFF));
		this.key1 = _uint32(Math.imul(this.key1, 134775813) + 1);
		this.key2 = crc32(this.key2, this.key1 >>> 24);
	}

	private streamByte() {
		const tmp = this.key2 | 2;
		return _uint8(Math.imul(tmp, (tmp ^1)) >>> 8);
	}

	private encryptByte(b: number) {
		const encb = this.streamByte() ^ b;
		this.updateKeys(b);
		return encb;
	}

	private decryptByte(b: number) {
		const decb = this.streamByte() ^ b;
		this.updateKeys(decb);
		return decb;
	}

	public encrypt(data: Buffer) {
		const encData = Buffer.alloc(Buffer.byteLength(data));
		let offset = 0;
		for ( const b of data ) {
			encData.writeUInt8(this.encryptByte(b), offset++);
		}
		return encData;
	}

	public decrypt(data: Buffer) {
		const decData = Buffer.alloc(Buffer.byteLength(data));
		let offset = 0;
		for ( const b of data ) {
			decData.writeUInt8(this.decryptByte(b), offset++);
		}
		return decData;
	}

}

const HEADER_LENGTH = 12;

export default class ZIP20 {

	static Encrypt(buf: Buffer, key: string, crc: UINT32) {
		const chiper = new CryptoChiper(key);
		const crcBuf = Buffer.alloc(4);
		crcBuf.writeUInt32LE(crc);
		crc = crcBuf.readUInt16LE(0);

		let header = crypto.randomBytes(HEADER_LENGTH);
		header.writeUInt16LE(crc, HEADER_LENGTH - 2);
		header = chiper.encrypt(header);

		const data = chiper.encrypt(buf);
		return Buffer.concat([header, data]);
	}

	static Decrypt(buf: Buffer, key: string) {
		const chiper = new CryptoChiper(key);
		const decData = chiper.decrypt(buf);
		return decData.slice(HEADER_LENGTH);
	}

}
