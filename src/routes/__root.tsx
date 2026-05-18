import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { AppProviders } from "@/lib/providers";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">A página que você procura não existe.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Ir para o início</Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Evolui — Gestão de Performance e PDI" },
      { name: "description", content: "Plataforma de gestão de performance contínua, feedback estruturado e Plano de Desenvolvimento Individual com IA." },
      { property: "og:title", content: "Evolui — Gestão de Performance e PDI" },
      { name: "twitter:title", content: "Evolui — Gestão de Performance e PDI" },
      { property: "og:description", content: "Plataforma de gestão de performance contínua, feedback estruturado e Plano de Desenvolvimento Individual com IA." },
      { name: "twitter:description", content: "Plataforma de gestão de performance contínua, feedback estruturado e Plano de Desenvolvimento Individual com IA." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e66a2600-13c6-4a10-b523-c7ec629ba081/id-preview-ed836d2d--65866daf-b226-46bc-ab61-5edb8d363586.lovable.app-1778868734501.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e66a2600-13c6-4a10-b523-c7ec629ba081/id-preview-ed836d2d--65866daf-b226-46bc-ab61-5edb8d363586.lovable.app-1778868734501.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: () => <Outlet />,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head><HeadContent /></head>
      <body>
        <AppProviders>{children}</AppProviders>
        <Scripts />
      </body>
    </html>
  );
}
