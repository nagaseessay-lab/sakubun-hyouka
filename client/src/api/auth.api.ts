import { gasPost } from './client';

export async function login(_loginId: string, _password: string) {
  // GAS版ではGoogle Sign-Inを使用するため、このメソッドは互換用
  // AuthContextのhandleCredentialResponseから直接gasPostが呼ばれる
  throw new Error('Google Sign-Inを使用してください');
}

export async function getMe() {
  return gasPost('auth.me');
}
