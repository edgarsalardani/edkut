import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "edkut — conectando quem vive tecnologia",
  description:
    "Um espaço para estudantes que vivem tecnologia. Faça amizades, participe de comunidades, compartilhe conhecimentos e aprenda com quem tem os mesmos interesses que você.",
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
