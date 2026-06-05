import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

export function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold">Evolui</span>
          </Link>
          <nav className="hidden items-center gap-5 text-sm md:flex">
            <Link to="/recursos" className="text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground" }}>Recursos</Link>
            <Link to="/precos" className="text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground" }}>Preços</Link>
            <Link to="/contato" className="text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground" }}>Contato</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">Entrar</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/login" search={{ signup: "1" } as never}>Começar grátis</Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t bg-muted/30">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold">Evolui</span>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Gestão de pessoas, performance e ponto eletrônico em uma só plataforma.</p>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Produto</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li><Link to="/recursos" className="hover:text-foreground">Recursos</Link></li>
              <li><Link to="/precos" className="hover:text-foreground">Preços</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Empresa</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li><Link to="/contato" className="hover:text-foreground">Contato</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Conta</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li><Link to="/login" className="hover:text-foreground">Entrar</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t py-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Evolui. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}
