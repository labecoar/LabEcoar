import { useQuery } from "@tanstack/react-query";
import { adminUsersService } from "@/services/adminUsers.service";

export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin-users"],
    queryFn: () => adminUsersService.listUsers(),
  });
}