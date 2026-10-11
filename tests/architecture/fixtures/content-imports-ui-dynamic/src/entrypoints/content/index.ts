export async function open(): Promise<unknown> {
  return import('../../ui');
}
