"use client";

import { useQuery } from "@tanstack/react-query";
import { useCanister } from "@/hooks/use-canister";
import type { UserInfo } from "@volumetric/canister-types";

export function UserList() {
  const canister = useCanister();

  const {
    data: users,
    isLoading,
    refetch,
    error,
  } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      if (!canister) return [];
      return canister.list_users();
    },
    enabled: !!canister,
  });

  if (!canister) {
    return <div className="text-zinc-500 text-sm">Canister not available</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-400">
          {users?.length ?? 0} registered user(s)
        </span>
        <button
          onClick={() => refetch()}
          className="px-3 py-1 text-sm bg-zinc-700 text-white rounded hover:bg-zinc-600 transition-colors"
        >
          Refresh
        </button>
      </div>

      {isLoading && <div className="text-zinc-500 text-sm">Loading users...</div>}

      {error && (
        <div className="text-sm text-red-500 p-2 bg-red-950 rounded">
          {error instanceof Error ? error.message : "Failed to load users"}
        </div>
      )}

      {users && users.length > 0 && (
        <div className="flex flex-col gap-2">
          {users.map((user: UserInfo) => (
            <div
              key={user.principal.toText()}
              className="bg-zinc-800 rounded-lg p-4 space-y-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-200">
                  {user.username && user.username.length > 0
                    ? user.username[0]
                    : "Anonymous"}
                </span>
                {(!user.username || user.username.length === 0) && (
                  <span className="text-xs text-zinc-500">(no username)</span>
                )}
              </div>
              <div className="text-xs text-zinc-400 break-all">
                <span className="text-zinc-500">Address: </span>
                {user.address}
              </div>
              <div className="text-xs text-zinc-400 break-all">
                <span className="text-zinc-500">Principal: </span>
                {user.principal.toText()}
              </div>
            </div>
          ))}
        </div>
      )}

      {users && users.length === 0 && (
        <div className="text-zinc-500 text-sm text-center py-8">
          No users registered yet
        </div>
      )}
    </div>
  );
}
