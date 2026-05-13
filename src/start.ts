import { createStart } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

export const startInstance = createStart(() => ({
  serverFns: {
    fetch: async (url, init) => {
      const requestInit = init ?? {};
      const headers = new Headers(requestInit.headers);
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (token && !headers.has("authorization")) {
        headers.set("authorization", `Bearer ${token}`);
      }

      return fetch(url, { ...requestInit, headers });
    },
  },
}));