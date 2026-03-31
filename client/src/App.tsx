import { useEffect, useState } from "react";
import { GithubCodePage } from "./GithubCodePage";
import { MainAuditPage } from "./MainAuditPage";

export const CODE_PAGE_HASH = "#/github-code";

export type PageMode = "main" | "github-code";

function App() {
  const [pageMode, setPageMode] = useState<PageMode>(getPageModeFromHash());

  useEffect(() => {
    const onHashChange = () => setPageMode(getPageModeFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return pageMode === "github-code" ? <GithubCodePage /> : <MainAuditPage />;
}

function getPageModeFromHash(): PageMode {
  return window.location.hash.startsWith(CODE_PAGE_HASH) ? "github-code" : "main";
}

export default App;
