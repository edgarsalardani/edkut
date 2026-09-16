import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "edkut — conectando quem aprende, ensina e compartilha tecnologia",
  description:
    "edkut é a rede social acadêmica e tecnológica para estudantes, professores, pesquisadores e profissionais de Computação e Tecnologia.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="font-sans text-edkut-text">{children}</body>
    </html>
  );
}
