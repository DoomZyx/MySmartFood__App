import { useAuth } from "./useAuth";
import { getAccountStatus } from "../utils/accountStatus";
import { getUserAvatarUrl, getUserFirstName, getUserInitial } from "../utils/userDisplay";

export function useUserIdentity() {
  const { user, isAuthenticated, isInitialized } = useAuth();
  const status = getAccountStatus(isAuthenticated ? user : null);

  return {
    isReady: isInitialized,
    isAuthenticated,
    firstName: getUserFirstName(user),
    avatarUrl: getUserAvatarUrl(user),
    initial: getUserInitial(user),
    status,
  };
}
