import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchSession } from "../../API/auth";
import { followPostAuthPath } from "../../utils/postAuthPath";

function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await fetchSession();
      if (cancelled) return;
      if (!session) {
        navigate("/login?error=auth_failed", { replace: true });
        return;
      }
      followPostAuthPath(navigate, session);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return null;
}

export default AuthCallback;
