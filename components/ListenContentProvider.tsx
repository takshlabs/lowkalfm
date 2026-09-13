"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { resolveListenCatalogue, type ListenContentValue, type SanityListenContent } from "@/lib/listen-content";
import { isSanityConfigured, listenContentQuery, sanityClient } from "@/lib/sanity";

const ListenContentContext = createContext<ListenContentValue | null>(null);

export function ListenContentProvider({ children }: { children: React.ReactNode }) {
  const [content, setContent] = useState<SanityListenContent | null>(null);

  useEffect(() => {
    if (!isSanityConfigured) return;
    let active = true;
    sanityClient.fetch<SanityListenContent>(listenContentQuery)
      .then((result) => { if (active) setContent(result); })
      .catch(() => { /* Keep public listen surfaces empty if Sanity is unavailable. */ });
    return () => { active = false; };
  }, []);

  const value = useMemo(() => resolveListenCatalogue(content), [content]);
  return <ListenContentContext.Provider value={value}>{children}</ListenContentContext.Provider>;
}

export function useListenContent() {
  const context = useContext(ListenContentContext);
  if (!context) throw new Error("useListenContent must be used inside ListenContentProvider");
  return context;
}
