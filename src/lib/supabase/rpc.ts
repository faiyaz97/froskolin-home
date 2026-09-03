export type RpcResponse<T = unknown> = { data: T | null; error: { message?: string } | null };

type RpcCapableClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<RpcResponse>;
};

/** A local untyped bridge until generated Supabase database types are added. */
export function callRpc<T = unknown>(
  client: unknown,
  name: string,
  args: Record<string, unknown>,
): Promise<RpcResponse<T>> {
  return (client as RpcCapableClient).rpc(name, args) as Promise<RpcResponse<T>>;
}
